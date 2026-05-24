import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

const task = {
  task_id: 'task_api_123',
  objective: 'Run a migration shell command',
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
  assert.ok(preflight.evidence_refs.length > 0);
  assert.ok(preflight.evidence_refs.some(evidence => evidence.claim_type === 'inferred'));
  assert.ok(preflight.evidence_refs.some(evidence => evidence.claim_type === 'observed'));

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
  assert.deepEqual(run.task.scope, task.scope);
  assert.equal(run.preflight.decision, 'requires_approval');
  assert.ok(run.preflight.evidence_refs.some(evidence => evidence.source === 'task.objective' && evidence.claim_type === 'inferred'));

  const getRunRes = await fetch(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(getRunRes.status, 200);
  const storedRun = await getRunRes.json();
  assert.equal(storedRun.run_id, run.run_id);
  assert.deepEqual(storedRun.task.scope, task.scope);
  assert.equal(storedRun.preflight.decision, 'requires_approval');
  assert.ok(storedRun.preflight.evidence_refs.length > 0);

  const hardCapRes = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...task,
      task_id: 'task_hard_cap',
      objective: 'Update source files',
      budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 }
    })
  });
  assert.equal(hardCapRes.status, 201);
  const pausedRun = await hardCapRes.json();
  assert.equal(pausedRun.status, 'paused');
  assert.deepEqual(pausedRun.task.scope, task.scope);
  assert.equal(pausedRun.preflight.decision, 'block');
  assert.equal(pausedRun.preflight.run_status, 'paused');
  assert.equal(pausedRun.preflight.budget.hard_cap_exceeded, true);
  assert.ok(pausedRun.preflight.blocked_reasons.includes('estimated_cost_exceeds_hard_limit'));
  assert.ok(pausedRun.preflight.evidence_refs.some(evidence => evidence.source === 'task.budget' && evidence.claim_type === 'observed'));

  const defaultScopeRes = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      ...task,
      task_id: 'task_default_scope',
      scope: undefined
    })
  });
  assert.equal(defaultScopeRes.status, 201);
  const defaultScopeRun = await defaultScopeRes.json();
  assert.deepEqual(defaultScopeRun.task.scope, { org_id: 'default-org', project_id: 'default-project' });

  console.log(JSON.stringify({ ok: true, test: 'api-preflight' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
