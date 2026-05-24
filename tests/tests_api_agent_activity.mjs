import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

const task = {
  task_id: 'task_api_agent_activity',
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

  const createTaskRes = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(task)
  });
  assert.equal(createTaskRes.status, 201);
  const run = await createTaskRes.json();

  assert.deepEqual(run.agent_activity.map(item => item.role), ['planner', 'executor', 'verifier']);
  assert.equal(run.agent_activity.find(item => item.role === 'executor').status, 'ready');
  assert.ok(run.agent_activity.every(item => item.run_id === run.run_id));
  assert.ok(run.agent_activity.every(item => item.evidence_refs.length > 0));

  const getRunRes = await fetch(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(getRunRes.status, 200);
  const storedRun = await getRunRes.json();
  assert.deepEqual(storedRun.agent_activity, run.agent_activity);

  console.log(JSON.stringify({ ok: true, test: 'api-agent-activity' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
