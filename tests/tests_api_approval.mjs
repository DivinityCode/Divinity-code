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

const highRiskTask = {
  task_id: 'task_approval_123',
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

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(highRiskTask)
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'awaiting_approval');

  const { response: queueRes, body: queue } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(queueRes.status, 200);
  assert.equal(queue.runs.length, 1);
  assert.equal(queue.runs[0].run_id, run.run_id);
  assert.equal(queue.runs[0].status, 'awaiting_approval');

  const { response: approveRes, body: approvedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'approve',
      actor: 'operator@example.com',
      reason: 'migration approved for smoke test'
    })
  });
  assert.equal(approveRes.status, 200);
  assert.equal(approvedRun.status, 'queued');
  assert.equal(approvedRun.approval.decision, 'approve');
  assert.equal(approvedRun.approval.actor, 'operator@example.com');

  const { body: emptyQueue } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(emptyQueue.runs.length, 0);

  const { body: secondRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({ ...highRiskTask, task_id: 'task_approval_456' })
  });

  const { response: rejectRes, body: rejectedRun } = await requestJson(`${baseUrl}/runs/${secondRun.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'reject',
      actor: 'operator@example.com',
      reason: 'unsafe operation'
    })
  });
  assert.equal(rejectRes.status, 200);
  assert.equal(rejectedRun.status, 'failed');
  assert.equal(rejectedRun.approval.decision, 'reject');
  assert.equal(rejectedRun.approval.reason, 'unsafe operation');

  const { response: duplicateRes, body: duplicate } = await requestJson(`${baseUrl}/runs/${secondRun.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve' })
  });
  assert.equal(duplicateRes.status, 409);
  assert.equal(duplicate.error, 'run is not awaiting approval');

  console.log(JSON.stringify({ ok: true, test: 'api-approval' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
