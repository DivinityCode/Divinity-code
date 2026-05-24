import assert from 'assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunStore } from '../packages/run-store/src/index.mjs';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-run-store-test-'));
const storePath = path.join(tmpDir, 'api-runs.json');

const seeded = createRunStore({ filePath: storePath });
seeded.runs.set('run_seeded', {
  run_id: 'run_seeded',
  task_id: 'task_seeded',
  status: 'queued',
  risk_level: 'low',
  events: [],
  artifacts: [],
  executions: [],
  steps: []
});
seeded.persist();

process.env.DIVINITY_API_AUTOSTART = '0';
process.env.DIVINITY_RUN_STORE_PATH = storePath;
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
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response: initialListRes, body: initialList } = await requestJson(`${baseUrl}/runs`);
  assert.equal(initialListRes.status, 200);
  assert.ok(initialList.runs.some(candidate => candidate.run_id === 'run_seeded'));

  const { response: createRes, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_api_run_store',
      objective: 'Read the repository README',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(createRes.status, 201);

  const { response: stepRes, body: stepResult } = await requestJson(`${baseUrl}/runs/${run.run_id}/steps`, {
    method: 'POST',
    body: JSON.stringify({ step_id: 'step_persisted', action: 'Read README' })
  });
  assert.equal(stepRes.status, 201);
  assert.equal(stepResult.step.status, 'pending');

  const persisted = createRunStore({ filePath: storePath });
  const persistedRun = persisted.runs.get(run.run_id);
  assert.equal(persistedRun.task_id, 'task_api_run_store');
  assert.equal(persistedRun.steps.length, 1);
  assert.equal(persistedRun.steps[0].step_id, 'step_persisted');
  assert.ok(persisted.auditRecords.some(record => record.type === 'run_created' && record.run_id === run.run_id));
  assert.ok(Array.from(persisted.artifacts.values()).some(artifact => artifact.run_id === run.run_id));

  console.log(JSON.stringify({ ok: true, test: 'api-run-store' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
