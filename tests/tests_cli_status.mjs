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
  const localStatus = await runCli('status');
  assert.equal(localStatus.ok, true);
  assert.equal(localStatus.command, 'status');
  assert.equal(localStatus.status, 'queued');

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_status',
      objective: 'Run a migration shell command',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.status, 'awaiting_approval');

  const remoteStatus = await runCli('status', run.run_id, '--api', baseUrl);
  assert.equal(remoteStatus.ok, true);
  assert.equal(remoteStatus.command, 'status');
  assert.equal(remoteStatus.status_code, 200);
  assert.equal(remoteStatus.run_id, run.run_id);
  assert.equal(remoteStatus.status, 'awaiting_approval');
  assert.equal(remoteStatus.run.task.objective, 'Run a migration shell command');

  console.log(JSON.stringify({ ok: true, test: 'cli-status' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  await new Promise((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  });
}
