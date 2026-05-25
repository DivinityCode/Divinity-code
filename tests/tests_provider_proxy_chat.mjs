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
  assert.equal(JSON.stringify(completed).includes(secretPrompt), false);
  assert.equal(JSON.stringify(completed).includes(apiSecret), false);
} finally {
  await completedServer.close();
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

const unsupported = await executeProviderProxyChat({
  candidates: ['anthropic'],
  env: { ANTHROPIC_API_KEY: 'anthropic-secret' },
  messages: [{ role: 'user', content: secretPrompt }]
});

assert.equal(unsupported.status, 'blocked');
assert.match(unsupported.error, /unsupported transport/);
assert.equal(JSON.stringify(unsupported).includes('anthropic-secret'), false);

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
