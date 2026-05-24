import assert from 'assert/strict';
import { existsSync, mkdtempSync, rmSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunStore } from './packages/run-store/src/index.mjs';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-run-store-test-'));
const storePath = path.join(tmpDir, 'runs.json');

try {
  const store = createRunStore({ filePath: storePath });
  store.runs.set('run_persisted', {
    run_id: 'run_persisted',
    task_id: 'task_persisted',
    status: 'queued',
    risk_level: 'low',
    events: []
  });
  store.artifacts.set('artifact_persisted', {
    artifact_id: 'artifact_persisted',
    run_id: 'run_persisted',
    type: 'report',
    uri: 'memory://artifact_persisted'
  });
  store.auditRecords.push({
    record_id: 'audit_persisted',
    type: 'run_created',
    run_id: 'run_persisted',
    created_at: '2026-05-24T00:00:00.000Z',
    payload: { status: 'queued' },
    hash: 'abc123'
  });
  store.persist();

  assert.equal(existsSync(storePath), true);
  const raw = JSON.parse(readFileSync(storePath, 'utf8'));
  assert.equal(raw.version, 1);
  assert.equal(raw.runs.length, 1);
  assert.equal(raw.artifacts.length, 1);
  assert.equal(raw.auditRecords.length, 1);

  const reloaded = createRunStore({ filePath: storePath });
  assert.equal(reloaded.runs.get('run_persisted').status, 'queued');
  assert.equal(reloaded.artifacts.get('artifact_persisted').type, 'report');
  assert.equal(reloaded.auditRecords[0].type, 'run_created');

  reloaded.runs.get('run_persisted').status = 'completed';
  reloaded.persist();

  const updated = createRunStore({ filePath: storePath });
  assert.equal(updated.runs.get('run_persisted').status, 'completed');

  const memoryStore = createRunStore();
  memoryStore.runs.set('run_memory', { run_id: 'run_memory', task_id: 'task_memory', status: 'queued', risk_level: 'low' });
  memoryStore.persist();
  assert.equal(memoryStore.runs.get('run_memory').status, 'queued');

  console.log(JSON.stringify({ ok: true, test: 'run-store' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
