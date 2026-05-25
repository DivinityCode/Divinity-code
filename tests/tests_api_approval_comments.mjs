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
  task_id: 'task_approval_comment',
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
  assert.deepEqual(run.approval_comments, []);

  const { response: commentRes, body: commentPayload } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/comments`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'operator@example.com',
      body: 'Please confirm migration rollback plan before approval.'
    })
  });
  assert.equal(commentRes.status, 201);
  assert.equal(commentPayload.comment.actor, 'operator@example.com');
  assert.equal(commentPayload.comment.body, 'Please confirm migration rollback plan before approval.');
  assert.equal(commentPayload.comment.run_id, run.run_id);
  assert.equal(commentPayload.run.approval_comments.length, 1);
  assert.equal(commentPayload.run.approval_comments[0].comment_id, commentPayload.comment.comment_id);
  assert.ok(commentPayload.run.events.some(event => event.type === 'approval_comment_added'));

  const { response: listRes, body: commentList } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/comments`);
  assert.equal(listRes.status, 200);
  assert.deepEqual(commentList.comments.map(comment => comment.body), [
    'Please confirm migration rollback plan before approval.'
  ]);

  const { response: emptyRes, body: emptyComment } = await requestJson(`${baseUrl}/runs/${run.run_id}/approval/comments`, {
    method: 'POST',
    body: JSON.stringify({ body: ' ' })
  });
  assert.equal(emptyRes.status, 400);
  assert.equal(emptyComment.error, 'approval comment body must be non-empty');

  const { body: audit } = await requestJson(`${baseUrl}/audit?from=2000-01-01T00:00:00Z&to=2100-01-01T00:00:00Z`);
  const commentRecords = audit.records.filter(record => record.type === 'approval_comment' && record.run_id === run.run_id);
  assert.equal(commentRecords.length, 1);
  assert.equal(commentRecords[0].payload.comment_id, commentPayload.comment.comment_id);

  console.log(JSON.stringify({ ok: true, test: 'api-approval-comments' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
