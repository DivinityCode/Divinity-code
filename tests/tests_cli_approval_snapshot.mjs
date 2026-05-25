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
  const localSnapshot = await runCli('approval', 'run_local_snapshot');
  assert.equal(localSnapshot.ok, true);
  assert.equal(localSnapshot.command, 'approval');
  assert.equal(localSnapshot.run_id, 'run_local_snapshot');
  assert.deepEqual(localSnapshot.comments, []);

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_approval_snapshot',
      objective: 'Run a migration shell command',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(run.status, 'awaiting_approval');

  await requestJson(`${baseUrl}/runs/${run.run_id}/approval/comments`, {
    method: 'POST',
    body: JSON.stringify({
      actor: 'cli@example.com',
      body: 'Reviewed risk evidence before decision.'
    })
  });

  const snapshot = await runCli('approval', run.run_id, '--api', baseUrl);
  assert.equal(snapshot.ok, true);
  assert.equal(snapshot.command, 'approval');
  assert.equal(snapshot.status_code, 200);
  assert.equal(snapshot.status, 'awaiting_approval');
  assert.equal(snapshot.approval_required, true);
  assert.equal(snapshot.approval, null);
  assert.equal(snapshot.comments.length, 1);

  await runCli(
    'approve',
    run.run_id,
    '--api',
    baseUrl,
    '--actor',
    'operator@example.com',
    '--reason',
    'approved after snapshot review'
  );

  const decided = await runCli('approval', run.run_id, '--api', baseUrl);
  assert.equal(decided.status, 'queued');
  assert.equal(decided.approval_required, false);
  assert.equal(decided.approval.decision, 'approve');

  console.log(JSON.stringify({ ok: true, test: 'cli-approval-snapshot' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
