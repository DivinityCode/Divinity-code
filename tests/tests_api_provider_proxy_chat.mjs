import assert from 'assert/strict';
import http from 'http';

async function createMockChatServer() {
  const requests = [];
  const server = http.createServer((req, res) => {
    let rawBody = '';
    req.setEncoding('utf8');
    req.on('data', chunk => rawBody += chunk);
    req.on('end', () => {
      const body = rawBody ? JSON.parse(rawBody) : {};
      requests.push({ req, body });
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

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.OPENROUTER_API_KEY = apiSecret;
const { server } = await import('../apps/api/src/server.mjs');
const mock = await createMockChatServer();

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
} finally {
  await mock.close();
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}

console.log(JSON.stringify({ ok: true, test: 'api-provider-proxy-chat' }));
