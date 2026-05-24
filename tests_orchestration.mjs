import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createOrchestrationTrace } from './packages/orchestration/src/index.mjs';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

function assertTrace(trace, expectedStatus) {
  assert.match(trace.pipeline_id, /^pipeline_/);
  assert.deepEqual(trace.stages.map(stage => stage.role), ['planner', 'executor', 'verifier']);
  assert.equal(trace.stages[0].status, 'completed');
  assert.ok(Array.isArray(trace.stages[0].output.steps));
  assert.ok(trace.stages[0].output.steps.length >= 2);
  assert.equal(trace.stages[1].status, expectedStatus === 'queued' ? 'ready' : 'gated');
  assert.equal(trace.stages[1].output.side_effects, 'none');
  assert.equal(trace.stages[2].status, 'completed');
  assert.equal(trace.stages[2].output.result, expectedStatus === 'queued' ? 'verified' : 'waiting_for_gate_resolution');
}

const task = {
  task_id: 'task_orchestration',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

const trace = createOrchestrationTrace({
  run_id: 'run_orchestration',
  task,
  status: 'queued',
  preflight: {
    decision: 'allow',
    risk_level: 'low',
    evidence_refs: [{ evidence_id: 'evidence_task', source: 'task.objective' }]
  }
});
assertTrace(trace, 'queued');
assert.equal(trace.stages[0].evidence_refs[0].source, 'task.objective');

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-orchestration-test-'));
try {
  runCli(tmpDir, 'init');
  const cliRun = runCli(tmpDir, 'run', 'Read the repository README');
  assertTrace(cliRun.orchestration, cliRun.status);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });
  assert.equal(response.status, 201);
  assertTrace(run.orchestration, run.status);

  console.log(JSON.stringify({ ok: true, test: 'orchestration' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
