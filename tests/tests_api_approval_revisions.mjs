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
  task_id: 'task_approval_revision',
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

  const { response: revisionRes, body: revisionRun } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/revision`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'operator@example.com',
      reason: 'Rollback evidence is missing.',
      requested_changes: ['Attach rollback plan', 'Confirm maintenance window']
    })
  });
  assert.equal(revisionRes.status, 200);
  assert.equal(revisionRun.status, 'paused');
  assert.equal(revisionRun.approval_revision.status, 'requested');
  assert.equal(revisionRun.approval_revision.actor, 'operator@example.com');
  assert.deepEqual(revisionRun.approval_revision.requested_changes, [
    'Attach rollback plan',
    'Confirm maintenance window'
  ]);
  assert.equal(revisionRun.events.at(-2).type, 'approval_revision_requested');
  assert.equal(revisionRun.events.at(-1).type, 'status_changed');

  const { body: queueAfterRevision } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(queueAfterRevision.runs.length, 0);

  const { response: approvePausedRes, body: approvePaused } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({
      decision: 'approve',
      actor: 'operator@example.com',
      reason: 'approve while paused'
    })
  });
  assert.equal(approvePausedRes.status, 409);
  assert.equal(approvePaused.error, 'run is not awaiting approval');

  const { response: snapshotRes, body: snapshot } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval`);
  assert.equal(snapshotRes.status, 200);
  assert.equal(snapshot.status, 'paused');
  assert.equal(snapshot.approval_required, false);
  assert.equal(snapshot.revision.status, 'requested');

  const { response: resubmitRes, body: resubmittedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/resubmit`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'builder@example.com',
      reason: 'Rollback evidence attached.'
    })
  });
  assert.equal(resubmitRes.status, 200);
  assert.equal(resubmittedRun.status, 'awaiting_approval');
  assert.equal(resubmittedRun.approval_revision.status, 'resubmitted');
  assert.equal(resubmittedRun.approval_revision.resubmitted_by, 'builder@example.com');
  assert.equal(resubmittedRun.approval_revision.resubmission_reason, 'Rollback evidence attached.');
  assert.equal(resubmittedRun.events.at(-2).type, 'approval_resubmitted');
  assert.equal(resubmittedRun.events.at(-1).type, 'status_changed');

  const { body: queueAfterResubmit } = await requestJson(`${baseUrl}/approvals`);
  assert.equal(queueAfterResubmit.runs.length, 1);
  assert.equal(queueAfterResubmit.runs[0].run_id, run.run_id);

  const { response: duplicateResubmitRes, body: duplicateResubmit } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/resubmit`, {
    method: 'POST',
    body: JSON.stringify({ actor: 'builder@example.com', reason: 'second attempt' })
  });
  assert.equal(duplicateResubmitRes.status, 409);
  assert.equal(duplicateResubmit.error, 'run does not have a requested approval revision');

  console.log(JSON.stringify({ ok: true, test: 'api-approval-revisions' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
