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
  task_id: 'task_approval_snapshot',
  objective: 'Run a migration shell command',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-25T00:00:00Z'
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

  const { body: commentPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/comments`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'operator@example.com',
      body: 'Need release window confirmation before approval.'
    })
  });

  const { response: snapshotRes, body: snapshot } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`);
  assert.equal(snapshotRes.status, 200);
  assert.equal(snapshot.run_id, run.run_id);
  assert.equal(snapshot.status, 'awaiting_approval');
  assert.equal(snapshot.approval_required, true);
  assert.equal(snapshot.approval, null);
  assert.equal(snapshot.comments.length, 1);
  assert.equal(snapshot.comments[0].comment_id, commentPayload.comment.comment_id);
  assert.equal(snapshot.run.run_id, run.run_id);

  await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'approve',
      actor: 'operator@example.com',
      reason: 'release window confirmed'
    })
  });

  const { response: decidedRes, body: decided } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`);
  assert.equal(decidedRes.status, 200);
  assert.equal(decided.status, 'queued');
  assert.equal(decided.approval_required, false);
  assert.equal(decided.approval.decision, 'approve');
  assert.equal(decided.comments.length, 1);

  const { response: missingRes, body: missing } = await requestJson(`${baseUrl}/runs/run_missing/approval`);
  assert.equal(missingRes.status, 404);
  assert.equal(missing.error, 'run not found');

  console.log(JSON.stringify({ ok: true, test: 'api-approval-snapshot' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
