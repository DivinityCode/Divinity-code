import assert from 'assert/strict';
import { execFile } from 'child_process';
import { promisify } from 'util';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');
const execFileAsync = promisify(execFile);

async function runCli(...args) {
  const { stdout } = await execFileAsync(
    process.execPath,
    ['apps/cli/src/index.mjs', ...args],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  return JSON.parse(stdout);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await response.json();
  return { response, body };
}

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const baseUrl = `http://127.0.0.1:${port}`;

try {
  const localComment = await runCli(
    'approval-comment',
    'run_local_comment',
    '--actor',
    'operator@example.com',
    '--body',
    'Needs rollback plan.'
  );
  assert.equal(localComment.ok, true);
  assert.equal(localComment.command, 'approval-comment');
  assert.equal(localComment.comment.run_id, 'run_local_comment');
  assert.equal(localComment.comment.actor, 'operator@example.com');
  assert.equal(localComment.comment.body, 'Needs rollback plan.');

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_approval_comment',
      objective: 'Run a migration shell command',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'awaiting_approval');

  const remoteComment = await runCli(
    'approval-comment',
    run.run_id,
    '--api',
    baseUrl,
    '--actor',
    'cli@example.com',
    '--body',
    'Reviewed preflight evidence before approval.'
  );
  assert.equal(remoteComment.ok, true);
  assert.equal(remoteComment.command, 'approval-comment');
  assert.equal(remoteComment.status_code, 201);
  assert.equal(remoteComment.comment.actor, 'cli@example.com');
  assert.equal(remoteComment.comment.body, 'Reviewed preflight evidence before approval.');
  assert.equal(remoteComment.run.approval_comments.length, 1);

  const commentList = await runCli('approval-comments', run.run_id, '--api', baseUrl);
  assert.equal(commentList.ok, true);
  assert.equal(commentList.command, 'approval-comments');
  assert.equal(commentList.comments.length, 1);
  assert.equal(commentList.comments[0].comment_id, remoteComment.comment.comment_id);

  console.log(JSON.stringify({ ok: true, test: 'cli-approval-comments' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
