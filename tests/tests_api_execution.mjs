import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-execution-test-'));

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# API Execution Fixture\n\nExecuted by adapter.\n');
  mkdirSync(path.join(tmpDir, 'scripts'));
  writeFileSync(path.join(tmpDir, 'scripts', 'api-package.mjs'), "console.log('api package script ok');\n");
  writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    scripts: {
      'fixture:api': 'node scripts/api-package.mjs'
    }
  }, null, 2));
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  writeFileSync(path.join(tmpDir, 'changed.txt'), 'pending API change\n');
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_execution',
      objective: 'Review the README',
      repo: tmpDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });

  const { body: stepResult } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_readme', action: 'Read README' })
  });
  assert.equal(stepResult.step.status, 'pending');

  const { response: executeRes, body: executed } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(executeRes.status, 200);
  assert.equal(executed.execution.adapter, 'file_read');
  assert.equal(executed.execution.status, 'completed');
  assert.equal(executed.execution.exit_code, 0);
  assert.match(executed.execution.stdout, /Executed by adapter/);
  assert.equal(executed.step.status, 'completed');
  assert.equal(executed.step.execution.execution_id, executed.execution.execution_id);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(storedRun.executions.length, 1);
  assert.equal(storedRun.executions[0].execution_id, executed.execution.execution_id);

  const { body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  const executionEvent = timeline.events.find(event => event.type === 'step_executed');
  assert.ok(executionEvent);
  assert.equal(executionEvent.metadata.step_id, 'step_readme');
  assert.equal(executionEvent.metadata.execution_id, executed.execution.execution_id);

  const { body: audit } = await requestJson(`${baseUrl}/audit`);
  assert.ok(audit.records.some(record => (
    record.type === 'execution_record'
      && record.run_id === run.run_id
      && record.payload.execution_id === executed.execution.execution_id
  )));

  const { body: gitRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_git_status',
      objective: 'Run git status command',
      repo: tmpDir,
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(gitRun.status, 'queued');

  const { response: gitStepRes, body: gitStepResult } = await requestJson(`${baseUrl}/runs/${gitRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_git_status', action: 'Run git status command' })
  });
  assert.equal(gitStepRes.status, 201);
  assert.equal(gitStepResult.step.status, 'pending');

  const { response: gitExecuteRes, body: gitExecuted } = await requestJson(`${baseUrl}/runs/${gitRun.run_id}/steps/step_git_status/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(gitExecuteRes.status, 200);
  assert.equal(gitExecuted.execution.adapter, 'git_status');
  assert.equal(gitExecuted.execution.status, 'completed');
  assert.match(gitExecuted.execution.stdout, /\?\? changed\.txt/);

  const { body: nodeTestRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_node_test',
      objective: 'Run dashboard static test command',
      repo: process.cwd(),
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(nodeTestRun.status, 'queued');

  const { response: nodeStepRes, body: nodeStepResult } = await requestJson(`${baseUrl}/runs/${nodeTestRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_dashboard_static', action: 'Run dashboard static test command' })
  });
  assert.equal(nodeStepRes.status, 201);
  assert.equal(nodeStepResult.step.status, 'pending');

  const { response: nodeExecuteRes, body: nodeExecuted } = await requestJson(`${baseUrl}/runs/${nodeTestRun.run_id}/steps/step_dashboard_static/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(nodeExecuteRes.status, 200);
  assert.equal(nodeExecuted.execution.adapter, 'node_test');
  assert.equal(nodeExecuted.execution.status, 'completed');
  assert.equal(nodeExecuted.execution.target_path, 'tests/tests_dashboard_static.mjs');
  assert.match(nodeExecuted.execution.stdout, /dashboard/);

  const { body: packageRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_package_script',
      objective: 'Run package script fixture:api',
      repo: tmpDir,
      policy_id: 'full_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(packageRun.status, 'queued');

  const { response: packageStepRes, body: packageStepResult } = await requestJson(`${baseUrl}/runs/${packageRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_package_script', action: 'Run package script fixture:api' })
  });
  assert.equal(packageStepRes.status, 201);
  assert.equal(packageStepResult.step.status, 'pending');

  const { response: packageExecuteRes, body: packageExecuted } = await requestJson(`${baseUrl}/runs/${packageRun.run_id}/steps/step_package_script/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(packageExecuteRes.status, 200);
  assert.equal(packageExecuted.execution.adapter, 'package_script');
  assert.equal(packageExecuted.execution.status, 'completed');
  assert.equal(packageExecuted.execution.target_path, 'package.json#scripts.fixture:api');
  assert.match(packageExecuted.execution.stdout, /api package script ok/);

  console.log(JSON.stringify({ ok: true, test: 'api-execution' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
