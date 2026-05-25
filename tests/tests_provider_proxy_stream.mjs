import assert from 'assert/strict';
import http from 'http';

import {
  createProviderLimitLedger,
  createProviderUsageLedger,
  executeProviderProxyChatStream
} from '../packages/provider-proxy/src/index.mjs';

async function createMockStreamServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
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

function writeSse(res, events) {
  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream');
  for (const event of events) {
    if (event.event) res.write(`event: ${event.event}\n`);
    res.write(`data: ${typeof event.data === 'string' ? event.data : JSON.stringify(event.data)}\n\n`);
  }
  res.end();
}

const secretPrompt = 'secret prompt for streaming';
const apiSecret = 'stream-api-secret';
const toolSecret = 'secret-stream-tool-value';

const chatStreamServer = await createMockStreamServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/chat/completions');
  assert.equal(body.model, 'mock-model');
  assert.equal(body.stream, true);
  assert.equal(body.max_completion_tokens, 16);
  assert.deepEqual(body.messages, [{ role: 'user', content: secretPrompt }]);
  assert.equal(body.tools[0].type, 'function');
  assert.deepEqual(body.tools.map(tool => tool.function.name), ['web_extract', 'web_search']);
  assert.equal(body.tools[1].function.parameters.properties.query.type, 'string');

  writeSse(res, [
    {
      data: {
        id: 'chatcmpl_stream',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [{ index: 0, delta: { content: 'Hello ' }, finish_reason: null }]
      }
    },
    {
      data: {
        id: 'chatcmpl_stream',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [{ index: 0, delta: { content: 'stream' }, finish_reason: 'stop' }],
        usage: {
          prompt_tokens: 5,
          completion_tokens: 4,
          total_tokens: 9
        }
      }
    },
    { data: '[DONE]' }
  ]);
});

try {
  const observedEvents = [];
  const providerUsageLedger = createProviderUsageLedger({
    now: () => new Date('2026-05-25T12:00:00.000Z')
  });
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: chatStreamServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    enabled_toolsets: ['web'],
    max_completion_tokens: 16,
    usage_ledger: providerUsageLedger,
    on_event: event => observedEvents.push(event)
  });

  assert.equal(result.format, 'divinity.provider_proxy_stream_result.v1');
  assert.equal(result.status, 'completed');
  assert.equal(result.provider_id, 'custom_openai_compatible');
  assert.equal(result.transport, 'chat_completions');
  assert.equal(result.output_text, 'Hello stream');
  assert.equal(result.stream_events.filter(event => event.type === 'text_delta').length, 2);
  assert.equal(observedEvents.filter(event => event.type === 'text_delta').length, 2);
  assert.equal(result.event_counts.text_delta, 2);
  assert.equal(result.usage_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(result.usage_ledger_record.model, 'mock-model');
  assert.equal(result.usage_ledger_record.request_count, 1);
  assert.equal(result.usage_ledger_record.input_tokens, 5);
  assert.equal(result.usage_ledger_record.output_tokens, 4);
  assert.equal(result.usage_ledger_record.total_tokens, 9);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await chatStreamServer.close();
}

const anthropicStreamServer = await createMockStreamServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/v1/messages');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.stream, true);
  assert.equal(body.model, 'claude-mock');
  assert.equal(body.max_tokens, 24);

  writeSse(res, [
    {
      event: 'message_start',
      data: {
        type: 'message_start',
        message: {
          id: 'msg_stream',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-mock',
          stop_reason: null,
          usage: { input_tokens: 5, output_tokens: 1 }
        }
      }
    },
    {
      event: 'content_block_delta',
      data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Hi ' } }
    },
    {
      event: 'content_block_delta',
      data: { type: 'content_block_delta', index: 0, delta: { type: 'thinking_delta', thinking: 'private chain of thought' } }
    },
    {
      event: 'content_block_delta',
      data: { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'private-signature' } }
    },
    {
      event: 'content_block_delta',
      data: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: 'Claude' } }
    },
    {
      event: 'message_delta',
      data: { type: 'message_delta', delta: { stop_reason: 'end_turn' }, usage: { output_tokens: 7 } }
    },
    { event: 'message_stop', data: { type: 'message_stop' } }
  ]);
});

try {
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicStreamServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 24
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.transport, 'anthropic_messages');
  assert.equal(result.output_text, 'Hi Claude');
  assert.equal(result.finish_reason, 'end_turn');
  assert.equal(result.usage.output_tokens, 7);
  assert.equal(result.event_counts.redacted_reasoning_delta, 2);
  assert.equal(JSON.stringify(result).includes('private chain of thought'), false);
  assert.equal(JSON.stringify(result).includes('private-signature'), false);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await anthropicStreamServer.close();
}

const responsesStreamServer = await createMockStreamServer(async ({ req, res, body }) => {
  assert.equal(req.method, 'POST');
  assert.equal(req.url, '/responses');
  assert.equal(body.stream, true);
  assert.equal(body.model, 'gpt-mock');
  assert.equal(body.max_output_tokens, 32);

  writeSse(res, [
    { event: 'response.output_text.delta', data: { type: 'response.output_text.delta', delta: 'OpenAI ' } },
    { event: 'response.output_text.delta', data: { type: 'response.output_text.delta', delta: 'stream' } },
    {
      event: 'response.completed',
      data: {
        type: 'response.completed',
        response: {
          id: 'resp_stream',
          status: 'completed',
          model: 'gpt-mock',
          usage: { input_tokens: 6, output_tokens: 2, total_tokens: 8 }
        }
      }
    }
  ]);
});

try {
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesStreamServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 32
  });

  assert.equal(result.status, 'completed');
  assert.equal(result.transport, 'codex_responses');
  assert.equal(result.output_text, 'OpenAI stream');
  assert.equal(result.response_id, 'resp_stream');
  assert.equal(result.usage.total_tokens, 8);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await responsesStreamServer.close();
}

const chatToolStreamServer = await createMockStreamServer(async ({ res }) => {
  writeSse(res, [
    {
      data: {
        id: 'chatcmpl_tool_stream',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                {
                  index: 0,
                  id: 'call_search_stream',
                  type: 'function',
                  function: { name: 'web_search', arguments: '{"query":"' }
                }
              ]
            },
            finish_reason: null
          }
        ]
      }
    },
    {
      data: {
        id: 'chatcmpl_tool_stream',
        object: 'chat.completion.chunk',
        model: 'mock-model',
        choices: [
          {
            index: 0,
            delta: {
              tool_calls: [
                { index: 0, function: { arguments: `${toolSecret}"}` } }
              ]
            },
            finish_reason: 'tool_calls'
          }
        ]
      }
    },
    { data: '[DONE]' }
  ]);
});

try {
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: chatToolStreamServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 16
  });

  assert.equal(result.status, 'requires_action');
  assert.equal(result.tool_call_requests[0].tool_call_id, 'call_search_stream');
  assert.equal(result.tool_call_requests[0].name, 'web_search');
  assert.deepEqual(result.tool_call_requests[0].argument_keys, ['query']);
  assert.equal(result.tool_call_requests[0].arguments_redacted, true);
  assert.equal(result.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(result.event_counts.tool_call_delta >= 1, true);
  assert.equal(JSON.stringify(result).includes(toolSecret), false);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await chatToolStreamServer.close();
}

const anthropicToolStreamServer = await createMockStreamServer(async ({ res }) => {
  writeSse(res, [
    {
      event: 'content_block_start',
      data: {
        type: 'content_block_start',
        index: 1,
        content_block: { type: 'tool_use', id: 'toolu_stream_read', name: 'read_file', input: {} }
      }
    },
    {
      event: 'content_block_delta',
      data: {
        type: 'content_block_delta',
        index: 1,
        delta: { type: 'input_json_delta', partial_json: `{"path":"${toolSecret}"}` }
      }
    },
    {
      event: 'message_delta',
      data: { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 10 } }
    },
    { event: 'message_stop', data: { type: 'message_stop' } }
  ]);
});

try {
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicToolStreamServer.base_url }],
    env: { CUSTOM_ANTHROPIC_API_KEY: apiSecret },
    requested_model: 'claude-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 24
  });

  assert.equal(result.status, 'requires_action');
  assert.equal(result.tool_call_requests[0].tool_call_id, 'toolu_stream_read');
  assert.equal(result.tool_call_requests[0].name, 'read_file');
  assert.deepEqual(result.tool_call_requests[0].argument_keys, ['path']);
  assert.equal(result.event_counts.tool_call_delta >= 1, true);
  assert.equal(JSON.stringify(result).includes(toolSecret), false);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await anthropicToolStreamServer.close();
}

const responsesToolStreamServer = await createMockStreamServer(async ({ res }) => {
  writeSse(res, [
    {
      event: 'response.output_item.added',
      data: {
        type: 'response.output_item.added',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'fc_stream',
          call_id: 'call_patch_stream',
          name: 'patch_file',
          arguments: ''
        }
      }
    },
    {
      event: 'response.function_call_arguments.delta',
      data: {
        type: 'response.function_call_arguments.delta',
        item_id: 'fc_stream',
        output_index: 0,
        delta: `{"file":"${toolSecret}"}`
      }
    },
    {
      event: 'response.function_call_arguments.done',
      data: {
        type: 'response.function_call_arguments.done',
        output_index: 0,
        item: {
          type: 'function_call',
          id: 'fc_stream',
          call_id: 'call_patch_stream',
          name: 'patch_file',
          arguments: `{"file":"${toolSecret}"}`
        }
      }
    }
  ]);
});

try {
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_openai_responses', base_url: responsesToolStreamServer.base_url }],
    env: { CUSTOM_RESPONSES_API_KEY: apiSecret },
    requested_model: 'gpt-mock',
    messages: [{ role: 'user', content: secretPrompt }],
    max_output_tokens: 32
  });

  assert.equal(result.status, 'requires_action');
  assert.equal(result.tool_call_requests[0].tool_call_id, 'call_patch_stream');
  assert.equal(result.tool_call_requests[0].name, 'patch_file');
  assert.deepEqual(result.tool_call_requests[0].argument_keys, ['file']);
  assert.equal(result.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(result.event_counts.tool_call_delta >= 1, true);
  assert.equal(JSON.stringify(result).includes(toolSecret), false);
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await responsesToolStreamServer.close();
}

const limitedStreamServer = await createMockStreamServer(async ({ res }) => {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json');
  res.setHeader('retry-after', '45');
  res.end(JSON.stringify({ error: { message: 'rate limited' } }));
});

try {
  const providerLimitLedger = createProviderLimitLedger({
    now: () => new Date('2026-05-25T10:00:00.000Z')
  });
  const result = await executeProviderProxyChatStream({
    candidates: [{ provider_id: 'custom_openai_compatible', base_url: limitedStreamServer.base_url }],
    env: { CUSTOM_LLM_API_KEY: apiSecret },
    requested_model: 'mock-model',
    messages: [{ role: 'user', content: secretPrompt }],
    max_completion_tokens: 16,
    limit_ledger: providerLimitLedger
  });

  assert.equal(result.status, 'limited');
  assert.equal(result.upstream_status, 429);
  assert.equal(result.retry_after_seconds, 45);
  assert.equal(result.limit_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(JSON.stringify(result).includes(secretPrompt), false);
  assert.equal(JSON.stringify(result).includes(apiSecret), false);
} finally {
  await limitedStreamServer.close();
}

console.log(JSON.stringify({ ok: true, test: 'provider-proxy-stream' }));
