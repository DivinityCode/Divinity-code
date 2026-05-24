import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

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

  const { response: approvalRes, body: approvalBlocked } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_shell', action: 'Run database migration shell command' })
  });
  assert.equal(approvalRes.status, 409);
  assert.equal(approvalBlocked.error, 'step requires approval before execution');
  assert.equal(approvalBlocked.step.status, 'blocked');
  assert.equal(approvalBlocked.step.pre_execution_check.decision, 'requires_approval');

  const { response: deniedRes, body: denied } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_push', action: 'Push branch to origin' })
  });
  assert.equal(deniedRes.status, 403);
  assert.equal(denied.error, 'step blocked by policy');
  assert.equal(denied.step.status, 'blocked');
  assert.ok(denied.step.pre_execution_check.blocked_reasons.includes('permission_denied:git_push'));

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
