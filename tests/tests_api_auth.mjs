import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.DIVINITY_API_KEYS = 'test-secret';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = response.status === 204 ? null : await response.json();
  return { response, body };
}

const task = {
  task_id: 'task_api_auth',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: healthRes, body: health } = await requestJson(`${baseUrl}/health`);
  assert.equal(healthRes.status, 200);
  assert.deepEqual(health, { ok: true });

  const { response: optionsRes } = await requestJson(`${baseUrl}/tasks`, { method: 'OPTIONS' });
  assert.equal(optionsRes.status, 204);
  assert.match(optionsRes.headers.get('access-control-allow-headers'), /authorization/);

  const { response: missingAuthRes, body: missingAuth } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });
  assert.equal(missingAuthRes.status, 401);
  assert.equal(missingAuth.error, 'authentication required');
  assert.equal(missingAuthRes.headers.get('www-authenticate'), 'Bearer');

  const { response: invalidAuthRes, body: invalidAuth } = await requestJson(`${baseUrl}/runs`, {
    headers: { authorization: 'Bearer wrong-secret' }
  });
  assert.equal(invalidAuthRes.status, 403);
  assert.equal(invalidAuth.error, 'invalid credentials');

  const { response: createTaskRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { authorization: 'Bearer test-secret' },
    body: JSON.stringify(task)
  });
  assert.equal(createTaskRes.status, 201);
  assert.equal(run.task_id, task.task_id);
  assert.deepEqual(run.task.scope, task.scope);

  const { response: getRunRes, body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`, {
    headers: { authorization: 'Bearer test-secret' }
  });
  assert.equal(getRunRes.status, 200);
  assert.equal(storedRun.run_id, run.run_id);

  console.log(JSON.stringify({ ok: true, test: 'api-auth' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
