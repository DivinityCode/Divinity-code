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
  const localRevision = await runCli(
    'approval-revision',
    'run_local_revision',
    '--actor',
    'operator@example.com',
    '--reason',
    'Need rollback plan.',
    '--change',
    'Attach rollback plan'
  );
  assert.equal(localRevision.ok, true);
  assert.equal(localRevision.command, 'approval-revision');
  assert.equal(localRevision.run_id, 'run_local_revision');
  assert.equal(localRevision.status, 'paused');
  assert.equal(localRevision.revision.status, 'requested');
  assert.equal(localRevision.revision.actor, 'operator@example.com');
  assert.deepEqual(localRevision.revision.requested_changes, ['Attach rollback plan']);

  const localResubmit = await runCli(
    'approval-resubmit',
    'run_local_revision',
    '--actor',
    'builder@example.com',
    '--reason',
    'Rollback plan attached.'
  );
  assert.equal(localResubmit.ok, true);
  assert.equal(localResubmit.command, 'approval-resubmit');
  assert.equal(localResubmit.run_id, 'run_local_revision');
  assert.equal(localResubmit.status, 'awaiting_approval');
  assert.equal(localResubmit.revision.status, 'resubmitted');
  assert.equal(localResubmit.revision.resubmitted_by, 'builder@example.com');

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_approval_revision',
      objective: 'Run a migration shell command',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(run.status, 'awaiting_approval');

  const apiRevision = await runCli(
    'approval-revision',
    run.run_id,
    '--api',
    baseUrl,
    '--actor',
    'cli@example.com',
    '--reason',
    'Need release evidence.',
    '--change',
    'Attach release checklist'
  );
  assert.equal(apiRevision.ok, true);
  assert.equal(apiRevision.command, 'approval-revision');
  assert.equal(apiRevision.status_code, 200);
  assert.equal(apiRevision.run.status, 'paused');
  assert.equal(apiRevision.revision.status, 'requested');
  assert.deepEqual(apiRevision.revision.requested_changes, ['Attach release checklist']);

  const snapshot = await runCli('approval', run.run_id, '--api', baseUrl);
  assert.equal(snapshot.status, 'paused');
  assert.equal(snapshot.revision.status, 'requested');

  const apiResubmit = await runCli(
    'approval-resubmit',
    run.run_id,
    '--api',
    baseUrl,
    '--actor',
    'builder@example.com',
    '--reason',
    'Release checklist attached.'
  );
  assert.equal(apiResubmit.ok, true);
  assert.equal(apiResubmit.command, 'approval-resubmit');
  assert.equal(apiResubmit.status_code, 200);
  assert.equal(apiResubmit.run.status, 'awaiting_approval');
  assert.equal(apiResubmit.revision.status, 'resubmitted');

  console.log(JSON.stringify({ ok: true, test: 'cli-approval-revisions' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
