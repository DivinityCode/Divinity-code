import assert from 'assert/strict';
import http from 'http';

async function createMockChatServer(handler) {
  const requests = [];
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => rawBody += chunk);
    req.on('end', () => {
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ req, body });
      if (handler) {
        handler({ req, res, body });
        return;
      }
      res.statusCode = 200;
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        id: 'chatcmpl_api_mock',
        object: 'chat.completion',
        model: body.model,
        choices: [
          {
            index: 0,
            message: { role: 'assistant', content: 'api mock response' },
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

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const apiSecret = 'openrouter-secret-value';
const secretPrompt = 'secret prompt for api proxy';
const toolSecret = 'secret tool argument for api proxy';

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.OPENROUTER_API_KEY = apiSecret;
process.env.CEREBRAS_API_KEY = 'cerebras-secret';
const { server } = await import('../apps/api/src/server.mjs');
const mock = await createMockChatServer();
const ledgerLimitedMock = await createMockChatServer(({ res }) => {
  res.statusCode = 429;
  res.setHeader('content-type', 'application/json');
  res.setHeader('retry-after', '60');
  res.end(JSON.stringify({ error: { message: 'rate limited' } }));
});
const ledgerBackupMock = await createMockChatServer(({ req, res, body }) => {
  assert.equal(req.url, '/v1/messages');
  assert.equal(body.model, 'claude-mock');
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_api_ledger_backup',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: 'api ledger backup' }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 4,
      output_tokens: 3
    }
  }));
});
const toolCallMock = await createMockChatServer(({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_api_tool_mock',
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
              id: 'call_api_search',
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
const anthropicMock = await createMockChatServer(({ req, res, body }) => {
  assert.equal(req.url, '/v1/messages');
  assert.equal(req.headers['anthropic-version'], '2023-06-01');
  assert.equal(body.max_tokens, 40);
  assert.equal('max_completion_tokens' in body, false);
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'msg_api_mock',
    type: 'message',
    role: 'assistant',
    model: body.model,
    content: [{ type: 'text', text: 'api anthropic mock' }],
    stop_reason: 'end_turn',
    usage: {
      input_tokens: 4,
      output_tokens: 3
    }
  }));
});

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'custom_openai_compatible', base_url: mock.base_url }],
      model: 'mock-model',
      messages: [{ role: 'user', content: secretPrompt }],
      max_completion_tokens: 32
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.result.format, 'divinity.provider_proxy_chat_result.v1');
  assert.equal(body.result.status, 'completed');
  assert.equal(body.result.message.content, 'api mock response');
  assert.equal(mock.requests.length, 1);
  assert.equal(JSON.stringify(body).includes(secretPrompt), false);
  assert.equal(JSON.stringify(body).includes(apiSecret), false);

  const { response: toolCallResponse, body: toolCallBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'custom_openai_compatible', base_url: toolCallMock.base_url }],
      model: 'mock-model',
      messages: [{ role: 'user', content: secretPrompt }],
      max_completion_tokens: 32
    })
  });

  assert.equal(toolCallResponse.status, 202);
  assert.equal(toolCallBody.result.status, 'requires_action');
  assert.equal(toolCallBody.result.tool_call_requests[0].name, 'web_search');
  assert.deepEqual(toolCallBody.result.tool_call_requests[0].argument_keys, ['query']);
  assert.equal(toolCallBody.result.tool_call_requests[0].arguments_redacted, true);
  assert.equal(toolCallBody.result.operator_controls[0].control_id, 'tool_call_review');
  assert.equal(JSON.stringify(toolCallBody).includes(toolSecret), false);
  assert.equal(JSON.stringify(toolCallBody).includes(secretPrompt), false);
  assert.equal(JSON.stringify(toolCallBody).includes(apiSecret), false);

  const { response: blockedResponse, body: blocked } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'custom_openai_compatible', base_url: mock.base_url }],
      messages: [{ role: 'user', content: secretPrompt }],
      request_budget: { max_prompt_chars: 3, max_completion_tokens: 32 }
    })
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(blocked.result.status, 'blocked');
  assert.match(blocked.result.error, /prompt budget/);
  assert.equal(mock.requests.length, 1);

  const { response: exfilResponse, body: exfilBlocked } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'openrouter', base_url: mock.base_url }],
      messages: [{ role: 'user', content: secretPrompt }],
      max_completion_tokens: 32
    })
  });

  assert.equal(exfilResponse.status, 400);
  assert.equal(exfilBlocked.result.status, 'blocked');
  assert.match(exfilBlocked.result.error, /base_url overrides/);
  assert.equal(mock.requests.length, 1);
  assert.equal(JSON.stringify(exfilBlocked).includes(apiSecret), false);

  const incompatiblePrompt = 'secret prompt for api incompatible provider';
  const { response: incompatibleResponse, body: incompatibleBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['cerebras'],
      toolsets: { enabled: ['web'] },
      messages: [{ role: 'user', content: incompatiblePrompt }],
      request_budget: { max_prompt_chars: 1 }
    })
  });

  assert.equal(incompatibleResponse.status, 400);
  assert.equal(incompatibleBody.result.status, 'blocked');
  assert.match(incompatibleBody.result.error, /provider missing required tool capability/);
  assert.equal(incompatibleBody.result.toolset_resolution.provider_capability_checks[0].status, 'missing');
  assert.equal(
    incompatibleBody.result.toolset_resolution.operator_controls[0].control_id,
    'provider_capability_review'
  );
  assert.equal(JSON.stringify(incompatibleBody).includes(incompatiblePrompt), false);

  const { response: anthropicResponse, body: anthropicBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'custom_anthropic_compatible', base_url: anthropicMock.base_url }],
      model: 'claude-mock',
      messages: [{ role: 'user', content: secretPrompt }],
      max_output_tokens: 40
    })
  });

  assert.equal(anthropicResponse.status, 200);
  assert.equal(anthropicBody.result.status, 'completed');
  assert.equal(anthropicBody.result.transport, 'anthropic_messages');
  assert.equal(anthropicBody.result.output_text, 'api anthropic mock');
  assert.equal(anthropicMock.requests.length, 1);
  assert.equal(JSON.stringify(anthropicBody).includes(secretPrompt), false);
  assert.equal(JSON.stringify(anthropicBody).includes(apiSecret), false);

  const { response: limitedLedgerResponse, body: limitedLedgerBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [{ provider_id: 'custom_openai_compatible', base_url: ledgerLimitedMock.base_url }],
      model: 'mock-model',
      messages: [{ role: 'user', content: secretPrompt }],
      max_completion_tokens: 32
    })
  });

  assert.equal(limitedLedgerResponse.status, 429);
  assert.equal(limitedLedgerBody.result.status, 'limited');
  assert.equal(limitedLedgerBody.result.limit_ledger_record.provider_id, 'custom_openai_compatible');
  assert.equal(limitedLedgerBody.result.retry_after_seconds, 60);
  assert.equal(ledgerLimitedMock.requests.length, 1);
  assert.equal(JSON.stringify(limitedLedgerBody).includes(secretPrompt), false);
  assert.equal(JSON.stringify(limitedLedgerBody).includes(apiSecret), false);

  const { response: reroutedResponse, body: reroutedBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: [
        { provider_id: 'custom_openai_compatible', base_url: ledgerLimitedMock.base_url },
        { provider_id: 'custom_anthropic_compatible', base_url: ledgerBackupMock.base_url }
      ],
      model: 'claude-mock',
      messages: [{ role: 'user', content: secretPrompt }],
      max_output_tokens: 32
    })
  });

  assert.equal(reroutedResponse.status, 200);
  assert.equal(reroutedBody.result.status, 'completed');
  assert.equal(reroutedBody.result.provider_id, 'custom_anthropic_compatible');
  assert.equal(reroutedBody.result.output_text, 'api ledger backup');
  assert.equal(ledgerLimitedMock.requests.length, 1);
  assert.equal(ledgerBackupMock.requests.length, 1);
  assert.equal(reroutedBody.result.route.candidate_results[0].status, 'limited');
  assert.equal(JSON.stringify(reroutedBody).includes(secretPrompt), false);
  assert.equal(JSON.stringify(reroutedBody).includes(apiSecret), false);
} finally {
  await mock.close();
  await ledgerLimitedMock.close();
  await ledgerBackupMock.close();
  await toolCallMock.close();
  await anthropicMock.close();
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

console.log(JSON.stringify({ ok: true, test: 'api-provider-proxy-chat' }));
