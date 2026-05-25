import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const task = {
  task_id: 'task_success_criteria',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  success_criteria: [
    'Return a concise summary',
    'Do not mutate repository files'
  ],
  created_at: '2026-05-25T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });

  assert.equal(response.status, 201);
  assert.deepEqual(run.task.success_criteria, task.success_criteria);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.deepEqual(storedRun.task.success_criteria, task.success_criteria);

  console.log(JSON.stringify({ ok: true, test: 'api-success-criteria' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
