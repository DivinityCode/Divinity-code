import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

const task = {
  task_id: 'task_api_123',
  objective: 'Run a migration shell command',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const preflightRes = await fetch(`${baseUrl}/preflight`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(task)
  });
  assert.equal(preflightRes.status, 200);
  const preflight = await preflightRes.json();
  assert.equal(preflight.decision, 'requires_approval');
  assert.equal(preflight.risk_level, 'high');
  assert.equal(preflight.approval_required, true);

  const createTaskRes = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(task)
  });
  assert.equal(createTaskRes.status, 201);
  const run = await createTaskRes.json();
  assert.equal(run.task_id, task.task_id);
  assert.equal(run.status, 'awaiting_approval');
  assert.equal(run.risk_level, 'high');
  assert.equal(run.preflight.decision, 'requires_approval');

  const getRunRes = await fetch(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(getRunRes.status, 200);
  const storedRun = await getRunRes.json();
  assert.equal(storedRun.run_id, run.run_id);
  assert.equal(storedRun.preflight.decision, 'requires_approval');

  console.log(JSON.stringify({ ok: true, test: 'api-preflight' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
