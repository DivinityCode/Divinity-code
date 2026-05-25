import assert from 'assert/strict';
import { execFile } from 'child_process';
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
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-goal-completion-test-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# CLI Goal Completion Fixture\n');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const local = await runCli(
    'goal-complete',
    'run_local_goal',
    'goal_run_local_goal_001',
    '--verification',
    'verify_exec_local'
  );
  assert.equal(local.ok, true);
  assert.equal(local.command, 'goal-complete');
  assert.equal(local.status, 'completed');
  assert.equal(local.goal.goal_id, 'goal_run_local_goal_001');
  assert.equal(local.goal.completion_evidence_refs[0].source, 'verification.result');

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_cli_goal_completion',
      objective: 'Read the repository README',
      repo: tmpDir,
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      success_criteria: ['README evidence is verified'],
      created_at: '2026-05-25T00:00:00Z'
    })
  });

  await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_cli_goal_readme', action: 'Read README' })
  });
  const { body: executed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_cli_goal_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });

  const completed = await runCli(
    'goal-complete',
    run.run_id,
    run.goals[0].goal_id,
    '--api',
    baseUrl,
    '--verification',
    executed.verification.verification_id
  );
  assert.equal(completed.ok, true);
  assert.equal(completed.command, 'goal-complete');
  assert.equal(completed.status_code, 200);
  assert.equal(completed.goal.status, 'completed');
  assert.equal(completed.run.goals[0].status, 'completed');

  console.log(JSON.stringify({ ok: true, test: 'cli-goal-completion' }));
} finally {
  server.closeIdleConnections?.();
  server.closeAllConnections?.();
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
