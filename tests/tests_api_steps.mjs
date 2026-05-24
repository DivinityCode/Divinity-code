import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

const task = {
  task_id: 'task_step_api',
  objective: 'Review the README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });

  const { response: allowedRes, body: allowed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_read', action: 'Read README' })
  });
  assert.equal(allowedRes.status, 201);
  assert.equal(allowed.step.status, 'pending');
  assert.equal(allowed.step.pre_execution_check.decision, 'allow');
  assert.ok(allowed.step.pre_execution_check.evidence_refs.some(evidence => evidence.source === 'step.action' && evidence.claim_type === 'inferred'));

  const { response: approvalRes, body: approvalBlocked } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_shell', action: 'Run database migration shell command' })
  });
  assert.equal(approvalRes.status, 409);
  assert.equal(approvalBlocked.error, 'step requires approval before execution');
  assert.equal(approvalBlocked.step.status, 'blocked');
  assert.equal(approvalBlocked.step.pre_execution_check.decision, 'requires_approval');
  assert.ok(approvalBlocked.step.pre_execution_check.evidence_refs.length > 0);

  const { response: deniedRes, body: denied } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_push', action: 'Push branch to origin' })
  });
  assert.equal(deniedRes.status, 403);
  assert.equal(denied.error, 'step blocked by policy');
  assert.equal(denied.step.status, 'blocked');
  assert.ok(denied.step.pre_execution_check.blocked_reasons.includes('permission_denied:git_push'));
  assert.ok(denied.step.pre_execution_check.evidence_refs.some(evidence => evidence.source === 'policy.permissions' && evidence.claim_type === 'observed'));

  const { body: hardCapRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      ...task,
      task_id: 'task_step_hard_cap',
      objective: 'Review the README',
      budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.5 }
    })
  });
  assert.equal(hardCapRun.status, 'queued');

  const { response: pausedStepRes, body: pausedStep } = await requestJson(`${baseUrl}/runs/${hardCapRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_update', action: 'Update source files' })
  });
  assert.equal(pausedStepRes.status, 409);
  assert.equal(pausedStep.error, 'run paused by hard budget cap');
  assert.equal(pausedStep.run.status, 'paused');
  assert.equal(pausedStep.step.status, 'blocked');
  assert.equal(pausedStep.step.pre_execution_check.run_status, 'paused');
  assert.ok(pausedStep.step.pre_execution_check.blocked_reasons.includes('estimated_cost_exceeds_hard_limit'));
  assert.ok(pausedStep.step.pre_execution_check.evidence_refs.some(evidence => evidence.source === 'task.budget' && evidence.claim_type === 'observed'));

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(storedRun.steps.length, 3);
  assert.equal(storedRun.steps.filter(step => step.status === 'blocked').length, 2);

  console.log(JSON.stringify({ ok: true, test: 'api-steps' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
