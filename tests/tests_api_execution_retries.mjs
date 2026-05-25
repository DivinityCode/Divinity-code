import assert from 'assert/strict';
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
  return { response, body: await response.json() };
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-execution-retries-'));
const sourceDir = path.join(tmpDir, 'source');

try {
  mkdirSync(sourceDir, { recursive: true });

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_execution_retry',
      objective: 'Read the repository README',
      repo: sourceDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);

  const { response: stepRes } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_retry_readme', action: 'Read README' })
  });
  assert.equal(stepRes.status, 201);

  const { response: firstRes, body: first } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_retry_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  assert.equal(firstRes.status, 200);
  assert.equal(first.execution.status, 'failed');
  assert.equal(first.execution.attempt, 1);
  assert.equal(first.execution.max_attempts, 2);
  assert.equal(first.execution.retry_of, null);
  assert.equal(first.verification.result, 'failed');
  assert.equal(first.step.status, 'failed');

  writeFileSync(path.join(run.workspace.path, 'README.md'), '# Retry Fixture\n\nRecovered on retry.\n');

  const { response: retryRes, body: retry } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps/step_retry_readme/execute`, {
    method: 'POST',
    body: JSON.stringify({ retry: true })
  });
  assert.equal(retryRes.status, 200);
  assert.equal(retry.execution.status, 'completed');
  assert.equal(retry.execution.attempt, 2);
  assert.equal(retry.execution.max_attempts, 2);
  assert.equal(retry.execution.retry_of, first.execution.execution_id);
  assert.match(retry.execution.stdout, /Recovered on retry/);
  assert.equal(retry.verification.result, 'passed');
  assert.equal(retry.step.status, 'completed');
  assert.equal(retry.step.execution.execution_id, retry.execution.execution_id);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.equal(storedRun.executions.length, 2);
  assert.deepEqual(storedRun.executions.map(execution => execution.attempt), [1, 2]);
  assert.equal(storedRun.executions[1].retry_of, first.execution.execution_id);
  assert.ok(storedRun.events.some(event => (
    event.type === 'step_executed'
      && event.metadata.step_id === 'step_retry_readme'
      && event.metadata.attempt === 2
      && event.metadata.retry_of === first.execution.execution_id
  )));

  const { body: exhaustedRun } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_execution_retry_exhausted',
      objective: 'Read the repository README',
      repo: sourceDir,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-25T00:00:00Z'
    })
  });

  await requestJson(`${baseUrl}/runs/${exhaustedRun.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_retry_exhausted', action: 'Read README' })
  });
  const { body: exhaustedFirst } = await requestJson(`${baseUrl}/runs/${exhaustedRun.run_id}/steps/step_retry_exhausted/execute`, {
    method: 'POST',
    body: JSON.stringify({})
  });
  rmSync(path.join(exhaustedRun.workspace.path, 'README.md'), { force: true });
  const { body: exhaustedSecond } = await requestJson(`${baseUrl}/runs/${exhaustedRun.run_id}/steps/step_retry_exhausted/execute`, {
    method: 'POST',
    body: JSON.stringify({ retry: true })
  });
  assert.equal(exhaustedSecond.execution.status, 'failed');
  assert.equal(exhaustedSecond.execution.attempt, 2);
  assert.equal(exhaustedSecond.execution.retry_of, exhaustedFirst.execution.execution_id);

  const { response: limitRes, body: limit } = await requestJson(`${baseUrl}/runs/${exhaustedRun.run_id}/steps/step_retry_exhausted/execute`, {
    method: 'POST',
    body: JSON.stringify({ retry: true })
  });
  assert.equal(limitRes.status, 409);
  assert.equal(limit.error, 'execution retry limit exceeded');
  assert.equal(limit.retry.max_attempts, 2);
  assert.equal(limit.retry.attempts_used, 2);

  console.log(JSON.stringify({ ok: true, test: 'api-execution-retries' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
