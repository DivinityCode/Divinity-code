import assert from 'assert/strict';
import http from 'http';

import { executeProviderProxyChat } from '../packages/provider-proxy/src/index.mjs';

async function createMockChatServer(handler) {
  const requests = [];
  const server = http.createServer(async (req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => rawBody += chunk);
    req.on('end', async () => {
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ req, body });
      await handler({ req, res, body });
    });
  });

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  return {
    base_url: `http://127.0.0.1:${port}`,
    requests,
    close: () => new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    })
  };
}

const secretPrompt = 'secret prompt for proxy test';
const apiSecret = 'openrouter-secret-value';

const completedServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/chat/completions');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(body.model, 'mock-model');
  assert.equal(body.max_completion_tokens, 32);
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: { role: 'assistant', content: 'mock response' },
        finish_reason: 'stop'
      }
    ],
    usage: {
      prompt_tokens: 4,
      completion_tokens: 3,
      total_tokens: 7
    }
  }));
});

try {
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: completedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(completed.format, 'divinity.provider_proxy_chat_result.v1');
  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_openai_compatible');
  assert.equal(completed.model, 'mock-model');
  assert.equal(completed.message.content, 'mock response');
  assert.equal(completed.finish_reason, 'stop');
  assert.equal(completed.usage.total_tokens, 7);
  assert.equal(completed.toolset_resolution.provider_capability_checks[0].status, 'supported');
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await completedServer.close();
}

const toolSecret = 'secret tool argument value';
const toolCallServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_tool_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: 'call_search_1',
              type: 'function',
              function: {
                name: 'web_search',
                arguments: JSON.stringify({ query: toolSecret })
              }
            }
          ]
        },
        finish_reason: 'tool_calls'
      }
    ],
    usage: {
      prompt_tokens: 4,
      completion_tokens: 3,
      total_tokens: 7
    }
  }));
});

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: toolCallServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'web_search');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['query']);
  assert.equal(toolCallResult.tool_call_requests[0].arguments_redacted, true);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await toolCallServer.close();
}

const limitedServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json');
  res.setHeader('retry-after', '11');
  res.end(JSON.stringify({ error: { message: 'rate limited' } }));
});

try {
  const limited = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: limitedServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(limited.status, 'limited');
  assert.equal(limited.upstream_status, 429);
  assert.equal(limited.retry_after_seconds, 11);
  assert.equal(limitedServer.requests.length, 1);
  assert.equal(JSON.stringify(limited).includes(secretPrompt), false);
  assert.equal(JSON.stringify(limited).includes(apiSecret), false);
} finally {
  await limitedServer.close();
}

const exfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'openrouter', base_url: exfilServer.base_url }],
    env: { OPENROUTER_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(exfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes(apiSecret), false);
} finally {
  await exfilServer.close();
}

const anthropicExfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'anthropic', base_url: anthropicExfilServer.base_url }],
    env: { ANTHROPIC_API_KEY: 'anthropic-secret' },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(anthropicExfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes('anthropic-secret'), false);
} finally {
  await anthropicExfilServer.close();
}

const responsesExfilServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const exfilBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'openai_api', base_url: responsesExfilServer.base_url }],
    env: { OPENAI_API_KEY: 'openai-secret' },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 32
  });

  assert.equal(exfilBlocked.status, 'blocked');
  assert.match(exfilBlocked.error, /base_url overrides/);
  assert.equal(responsesExfilServer.requests.length, 0);
  assert.equal(JSON.stringify(exfilBlocked).includes('openai-secret'), false);
} finally {
  await responsesExfilServer.close();
}

const incompatiblePrompt = 'secret prompt for incompatible provider toolset';

const incompatibleToolset = await executeProviderProxyChat({
  candidates: ['cerebras'],
  env: { CEREBRAS_API_KEY: 'cerebras-secret' },
  requested_model: 'gpt-oss-120b',
  messages: [{ role: 'user', content: incompatiblePrompt }],
  enabled_toolsets: ['web'],
  request_budget: { max_prompt_chars: 1 }
});

assert.equal(incompatibleToolset.status, 'blocked');
assert.match(incompatibleToolset.error, /provider missing required tool capability/);
assert.equal(incompatibleToolset.toolset_resolution.provider_capability_checks[0].status, 'missing');
assert.equal(
  incompatibleToolset.toolset_resolution.operator_controls[0].control_id,
  'provider_capability_review'
);
assert.equal(JSON.stringify(incompatibleToolset).includes(incompatiblePrompt), false);
assert.equal(JSON.stringify(incompatibleToolset).includes('cerebras-secret'), false);

const anthropicServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/v1/messages');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(req.headers['x-api-key'], undefined);
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.model, 'claude-mock');
  assert.equal(body.system, 'system safety prompt');
  assert.equal(body.max_tokens, 64);
  assert.equal('max_completion_tokens' in body, false);
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_mock',
    type: 'message',
    role: 'assistant',
    model: 'claude-mock',
    content: [{ type: 'text', text: 'anthropic mock response' }],
    stop_reason: 'end_turn',
    stop_sequence: null,
    usage: {
      input_tokens: 5,
      output_tokens: 4
    }
  }));
});

try {
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [
      { role: 'system', content: 'system safety prompt' },
      { role: 'user', content: secretPrompt }
    ],
    max_completion_tokens: 64
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_anthropic_compatible');
  assert.equal(completed.transport, 'anthropic_messages');
  assert.equal(completed.message.content[0].text, 'anthropic mock response');
  assert.equal(completed.output_text, 'anthropic mock response');
  assert.equal(completed.finish_reason, 'end_turn');
  assert.equal(completed.usage.input_tokens, 5);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await anthropicServer.close();
}

const anthropicToolServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_tool_mock',
    type: 'message',
    role: 'assistant',
    model: 'claude-mock',
    content: [
      { type: 'text', text: 'I need to inspect a file.' },
      {
        type: 'tool_use',
        id: 'toolu_read_1',
        name: 'read_file',
        input: { path: toolSecret }
      }
    ],
    stop_reason: 'tool_use',
    usage: {
      input_tokens: 5,
      output_tokens: 4
    }
  }));
});

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicToolServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 64
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].tool_call_id, 'toolu_read_1');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'read_file');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['path']);
  assert.equal(toolCallResult.message.content[1].input_redacted, true);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await anthropicToolServer.close();
}

const responsesServer = await createMockChatServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/responses');
  assert.equal(req.headers.authorization, undefined);
  assert.equal(body.model, 'gpt-mock');
  assert.equal(body.instructions, 'responses system prompt');
  assert.equal(body.max_output_tokens, 48);
  assert.equal('max_completion_tokens' in body, false);
  assert.equal('max_tokens' in body, false);
  assert.deepEqual(body.input, [{ role: 'user', content: secretPrompt }]);

  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'resp_mock',
    object: 'response',
    status: 'completed',
    model: 'gpt-mock',
    output: [
      {
        type: 'message',
        id: 'msg_resp_mock',
        status: 'completed',
        role: 'assistant',
        content: [
          { type: 'output_text', text: 'responses mock response', annotations: [] }
        ]
      }
    ],
    usage: {
      input_tokens: 6,
      output_tokens: 5,
      total_tokens: 11
    }
  }));
});

try {
  const completed = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [
      { role: 'system', content: 'responses system prompt' },
      { role: 'user', content: secretPrompt }
    ],
    max_output_tokens: 48
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.provider_id, 'custom_openai_responses');
  assert.equal(completed.transport, 'codex_responses');
  assert.equal(completed.message.content[0].text, 'responses mock response');
  assert.equal(completed.output_text, 'responses mock response');
  assert.equal(completed.finish_reason, 'completed');
  assert.equal(completed.usage.total_tokens, 11);
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await responsesServer.close();
}

const responsesToolServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'resp_tool_mock',
    object: 'response',
    status: 'completed',
    model: 'gpt-mock',
    output: [
      {
        type: 'function_call',
        id: 'fc_1',
        call_id: 'call_patch_1',
        name: 'patch_file',
        arguments: JSON.stringify({ file: toolSecret })
      }
    ],
    usage: {
      input_tokens: 6,
      output_tokens: 5,
      total_tokens: 11
    }
  }));
});

try {
  const toolCallResult = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesToolServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 48
  });

  assert.equal(toolCallResult.status, 'requires_action');
  assert.equal(toolCallResult.tool_call_requests[0].tool_call_id, 'call_patch_1');
  assert.equal(toolCallResult.tool_call_requests[0].name, 'patch_file');
  assert.deepEqual(toolCallResult.tool_call_requests[0].argument_keys, ['file']);
  assert.equal(toolCallResult.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallResult).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallResult).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallResult).includes(apiSecret), false);
} finally {
  await responsesToolServer.close();
}

const budgetServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const budgetBlocked = await executeProviderProxyChat({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: budgetServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    messages: [{ role: 'user', content: secretPrompt }],
    request_budget: { max_prompt_chars: 3, max_completion_tokens: 32 }
  });

  assert.equal(budgetBlocked.status, 'blocked');
  assert.match(budgetBlocked.error, /prompt budget/);
  assert.equal(budgetServer.requests.length, 0);
} finally {
  await budgetServer.close();
}

console.log(JSON.stringify({ ok: true, test: 'provider-proxy-chat' }));
