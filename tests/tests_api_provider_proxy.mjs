import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.OPENROUTER_API_KEY = 'openrouter-secret';
process.env.GROQ_API_KEY = 'groq-secret';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

try {
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body } = await requestJson(`${baseUrl}/provider-proxy/route`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['openrouter', 'groq'],
      limit_state: {
        openrouter: { limit_reached: true, retry_after_seconds: 60 }
      }
    })
  });

  assert.equal(response.status, 200);
  assert.equal(body.route.format, 'divinity.provider_proxy_route.v1');
  assert.equal(body.route.status, 'ready');
  assert.equal(body.route.selected_provider_runtime.provider_id, 'groq');
  assert.equal(JSON.stringify(body).includes('openrouter-secret'), false);
  assert.equal(JSON.stringify(body).includes('groq-secret'), false);

  const { response: blockedResponse, body: blocked } = await requestJson(`${baseUrl}/provider-proxy/route`, {
    method: 'POST',
    body: JSON.stringify({
      candidates: ['openrouter'],
      rotation_intent: 'bypass_limits'
    })
  });

  assert.equal(blockedResponse.status, 400);
  assert.equal(blocked.route.status, 'blocked');
  assert.match(blocked.route.error, /limit bypass/);

  console.log(JSON.stringify({ ok: true, test: 'api-provider-proxy' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
}
