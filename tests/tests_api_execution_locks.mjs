import assert from 'assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunStore } from '../packages/run-store/src/index.mjs';

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

function pendingReadStep(step_id) {
  return {
    step_id,
    run_id: '',
    action: 'Read README',
    status: 'pending',
    pre_execution_check: {
      decision: 'allow',
      status: 'allowed',
      risk_level: 'low',
      predicted_actions: [{ type: 'file_read', confidence: 0.8 }],
      blocked_reasons: [],
      warnings: [],
      budget: { estimated_cost_usd: 0.05, soft_limit_usd: 2.5, hard_limit_usd: 5 },
      evidence_refs: []
    }
  };
}

function seedRun({ run_id, repo, step, execution_locks = [] }) {
  step.run_id = run_id;
  return {
    run_id,
    task_id: `task_${run_id}`,
    task: {
      task_id: `task_${run_id}`,
      objective: 'Read README',
      repo,
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      scope: { org_id: 'default-org', project_id: 'default-project' }
    },
    created_at: '2026-05-25T00:00:00.000Z',
    status: 'queued',
    risk_level: 'low',
    preflight: {
      decision: 'allow',
      run_status: 'queued',
      risk_level: 'low',
      predicted_actions: [{ type: 'file_read', confidence: 0.8 }],
      blocked_reasons: [],
      warnings: [],
      budget: { estimated_cost_usd: 0.05, soft_limit_usd: 2.5, hard_limit_usd: 5 },
      evidence_refs: []
    },
    events: [],
    heartbeats: [],
    execution_locks,
    active_execution_lock: execution_locks.find(lock => lock.status === 'locked') || null,
    artifacts: [],
    executions: [],
    verifications: [],
    steps: [step],
    workspace: { type: 'local', source: repo, path: repo, created_at: '2026-05-25T00:00:00.000Z' }
  };
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-api-execution-locks-test-'));
const storePath = path.join(tmpDir, 'api-runs.json');

try {
  writeFileSync(path.join(tmpDir, 'README.md'), '# Execution Lock Fixture\n');
  const store = createRunStore({ filePath: storePath });
  store.runs.set('run_locked', seedRun({
    run_id: 'run_locked',
    repo: tmpDir,
    step: pendingReadStep('step_locked'),
    execution_locks: [
      {
        lock_id: 'lock_run_locked_step_locked_2026-05-25T00:00:00.000Z',
        run_id: 'run_locked',
        step_id: 'step_locked',
        actor: 'executor@divinity',
        status: 'locked',
        locked_at: '2026-05-25T00:00:00.000Z',
        expires_at: '2999-05-25T00:05:00.000Z',
        released_at: null
      }
    ]
  }));
  store.runs.set('run_available', seedRun({
    run_id: 'run_available',
    repo: tmpDir,
    step: pendingReadStep('step_available')
  }));
  store.runs.set('run_stale', seedRun({
    run_id: 'run_stale',
    repo: tmpDir,
    step: pendingReadStep('step_stale'),
    execution_locks: [
      {
        lock_id: 'lock_run_stale_step_stale_2026-05-25T00:00:00.000Z',
        run_id: 'run_stale',
        step_id: 'step_stale',
        actor: 'executor@divinity',
        status: 'locked',
        locked_at: '2026-05-25T00:00:00.000Z',
        expires_at: '2000-05-25T00:05:00.000Z',
        released_at: null
      }
    ]
  }));
  store.persist();

  process.env.DIVINITY_API_AUTOSTART = '0';
  process.env.DIVINITY_RUN_STORE_PATH = storePath;
  const { server } = await import('../apps/api/src/server.mjs');

  try {
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address();
    const baseUrl = `http://127.0.0.1:${port}`;

    const { response: lockedRes, body: locked } = await requestJson(`${baseUrl}/runs/run_locked/steps/step_locked/execute`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(lockedRes.status, 409);
    assert.equal(locked.error, 'run has active execution lock');
    assert.equal(locked.lock.lock_id, 'lock_run_locked_step_locked_2026-05-25T00:00:00.000Z');

    const { response: executeRes, body: executed } = await requestJson(`${baseUrl}/runs/run_available/steps/step_available/execute`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(executeRes.status, 200);
    assert.equal(executed.execution.status, 'completed');
    assert.equal(executed.lock.status, 'released');
    assert.equal(executed.run.active_execution_lock, null);
    assert.equal(executed.run.execution_locks.length, 1);
    assert.equal(executed.run.execution_locks[0].status, 'released');

    const { body: timeline } = await requestJson(`${baseUrl}/runs/run_available/events`);
    assert.ok(timeline.events.some(event => event.type === 'execution_lock_acquired'));
    assert.ok(timeline.events.some(event => event.type === 'execution_lock_released'));

    const { body: audit } = await requestJson(`${baseUrl}/audit`);
    assert.ok(audit.records.some(record => (
      record.type === 'execution_lock_record'
        && record.run_id === 'run_available'
        && record.payload.status === 'released'
    )));

    const { response: recoverRes, body: recovered } = await requestJson(`${baseUrl}/runs/run_stale/execution-locks/recover`, {
      method: 'POST',
      body: JSON.stringify({})
    });
    assert.equal(recoverRes.status, 200);
    assert.equal(recovered.recovered_locks.length, 1);
    assert.equal(recovered.recovered_locks[0].status, 'stale');
    assert.equal(recovered.run.active_execution_lock, null);
    assert.equal(recovered.run.execution_locks[0].status, 'stale');

    const { body: recoveredTimeline } = await requestJson(`${baseUrl}/runs/run_stale/events`);
    assert.ok(recoveredTimeline.events.some(event => event.type === 'execution_lock_recovered'));

    const { body: recoveredAudit } = await requestJson(`${baseUrl}/audit`);
    assert.ok(recoveredAudit.records.some(record => (
      record.type === 'execution_lock_record'
        && record.run_id === 'run_stale'
        && record.payload.status === 'stale'
    )));

    console.log(JSON.stringify({ ok: true, test: 'api-execution-locks' }));
  } finally {
    if (server.listening) {
      await new Promise((resolve, reject) => {
        server.close((error) => error ? reject(error) : resolve());
      });
    }
  }
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
