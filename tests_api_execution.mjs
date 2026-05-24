import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

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

  console.log(JSON.stringify({ ok: true, test: 'api-execution' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
