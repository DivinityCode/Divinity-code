import assert from 'assert/strict';
import { execFile } from 'child_process';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
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
const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-approval-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# Approval CLI Fixture\n');
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });

  const localApproval = await runCli(
    'approve',
    'run_local_approval',
    '--actor',
    'operator@example.com',
    '--reason',
    'approved from cli'
  );
  assert.equal(localApproval.ok, true);
  assert.equal(localApproval.command, 'approve');
  assert.equal(localApproval.run_id, 'run_local_approval');
  assert.equal(localApproval.status, 'queued');
  assert.equal(localApproval.approval.decision, 'approve');
  assert.equal(localApproval.approval.actor, 'operator@example.com');
  assert.equal(localApproval.approval.reason, 'approved from cli');
  assert.match(localApproval.approval.decided_at, /^\d{4}-\d{2}-\d{2}T/);

  const localRejection = await runCli(
    'reject',
    'run_local_reject',
    '--actor',
    'operator@example.com',
    '--reason',
    'unsafe command'
  );
  assert.equal(localRejection.ok, true);
  assert.equal(localRejection.command, 'reject');
  assert.equal(localRejection.run_id, 'run_local_reject');
  assert.equal(localRejection.status, 'failed');
  assert.equal(localRejection.approval.decision, 'reject');
  assert.equal(localRejection.approval.reason, 'unsafe command');

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_approval',
      objective: 'Run a migration shell command',
      repo: tmpDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'awaiting_approval');

  const queue = await runCli('approvals', '--api', baseUrl);
  assert.equal(queue.ok, true);
  assert.equal(queue.command, 'approvals');
  assert.equal(queue.runs.length, 1);
  assert.equal(queue.runs[0].run_id, run.run_id);

  const approved = await runCli(
    'approve',
    run.run_id,
    '--api',
    baseUrl,
    '--actor',
    'cli@example.com',
    '--reason',
    'approved by cli'
  );
  assert.equal(approved.ok, true);
  assert.equal(approved.command, 'approve');
  assert.equal(approved.run.status, 'queued');
  assert.equal(approved.run.approval.decision, 'approve');
  assert.equal(approved.run.approval.actor, 'cli@example.com');
  assert.equal(approved.run.approval.reason, 'approved by cli');

  const emptyQueue = await runCli('approvals', '--api', baseUrl);
  assert.equal(emptyQueue.runs.length, 0);

  console.log(JSON.stringify({ ok: true, test: 'cli-approval' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
  rmSync(tmpDir, { recursive: true, force: true });
}
