import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-workspaces-test-'));
const sourceDir = path.join(tmpDir, 'source');
const remoteSourceDir = path.join(tmpDir, 'remote-source');
const bareRemoteDir = path.join(tmpDir, 'remote.git');
const workspaceRoot = path.join(tmpDir, 'workspaces');

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.DIVINITY_WORKSPACE_ROOT = workspaceRoot;
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

try {
  writeFileSync(path.join(tmpDir, '.placeholder'), '');
  mkdirSync(sourceDir, { recursive: true });
  writeFileSync(path.join(sourceDir, 'README.md'), '# Workspace Fixture\n\nSnapshot read.\n');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_workspace',
      objective: 'Read the repository README',
      repo: sourceDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);
  assert.equal(run.workspace.kind, 'local_snapshot');
  assert.equal(run.workspace.source_path, sourceDir);
  assert.equal(run.workspace.isolation.profile_id, 'workspace_snapshot');
  assert.equal(run.workspace.isolation.requires_runtime, false);
  assert.match(readFileSync(path.join(run.workspace.path, 'README.md'), 'utf8'), /Snapshot read/);

  writeFileSync(path.join(sourceDir, 'README.md'), '# Workspace Fixture\n\nSource changed.\n');

  const { response: stepRes } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_workspace_read', action: 'Read README' })
  });
  assert.equal(stepRes.status, 201);

  const { response: executeRes, body: executed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_workspace_read/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(executeRes.status, 200);
  assert.equal(executed.execution.adapter, 'file_read');
  assert.match(executed.execution.stdout, /Snapshot read/);
  assert.doesNotMatch(executed.execution.stdout, /Source changed/);

  const { response: cleanupRes, body: cleanup } = await requestJson(`${baseUrl}/runs/${run.run_id}/workspace/cleanup`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(cleanupRes.status, 200);
  assert.equal(cleanup.workspace.cleaned, true);
  assert.equal(cleanup.workspace.path, run.workspace.path);
  assert.equal(existsSync(run.workspace.path), false);
  assert.equal(cleanup.run.workspace.cleaned, true);
  assert.match(cleanup.run.workspace.cleaned_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.ok(cleanup.run.events.some(event => event.type === 'workspace_cleaned'));

  const { response: secondCleanupRes, body: secondCleanup } = await requestJson(`${baseUrl}/runs/${run.run_id}/workspace/cleanup`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(secondCleanupRes.status, 409);
  assert.equal(secondCleanup.error, 'workspace cleanup skipped');
  assert.equal(secondCleanup.workspace.reason, 'workspace_not_found');

  mkdirSync(remoteSourceDir, { recursive: true });
  writeFileSync(path.join(remoteSourceDir, 'README.md'), '# API Remote Fixture\n\nRemote clone read.\n');
  execFileSync('git', ['init'], { cwd: remoteSourceDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: remoteSourceDir });
  execFileSync('git', ['config', 'user.name', 'Divinity Test'], { cwd: remoteSourceDir });
  execFileSync('git', ['add', 'README.md'], { cwd: remoteSourceDir });
  execFileSync('git', ['commit', '-m', 'seed remote'], { cwd: remoteSourceDir, stdio: 'ignore' });
  execFileSync('git', ['clone', '--bare', remoteSourceDir, bareRemoteDir], { stdio: 'ignore' });

  const remoteUrl = `file://${bareRemoteDir}`;
  const { response: remoteCreateRes, body: remoteRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_remote_workspace',
      objective: 'Read the repository README',
      repo: remoteUrl,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(remoteCreateRes.status, 201);
  assert.equal(remoteRun.workspace.kind, 'remote_git_clone');
  assert.equal(remoteRun.workspace.repo_url, remoteUrl);
  assert.equal(remoteRun.workspace.isolation.profile_id, 'workspace_snapshot');
  assert.match(readFileSync(path.join(remoteRun.workspace.path, 'README.md'), 'utf8'), /Remote clone read/);

  const { response: remoteStepRes } = await requestJson(`${baseUrl}/runs/${remoteRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_remote_read', action: 'Read README' })
  });
  assert.equal(remoteStepRes.status, 201);

  const { response: remoteExecuteRes, body: remoteExecuted } = await requestJson(`${baseUrl}/runs/${remoteRun.run_id}/steps/step_remote_read/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(remoteExecuteRes.status, 200);
  assert.equal(remoteExecuted.execution.adapter, 'file_read');
  assert.match(remoteExecuted.execution.stdout, /Remote clone read/);

  const { response: remoteCleanupRes, body: remoteCleanup } = await requestJson(`${baseUrl}/runs/${remoteRun.run_id}/workspace/cleanup`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(remoteCleanupRes.status, 200);
  assert.equal(remoteCleanup.workspace.cleaned, true);
  assert.equal(existsSync(remoteRun.workspace.path), false);

  console.log(JSON.stringify({ ok: true, test: 'api-workspaces' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
