import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-test-'));

try {
  runCli(tmpDir, 'init');
  const result = runCli(tmpDir, 'run', 'Run a migration shell command');

  assert.equal(result.ok, true);
  assert.equal(result.command, 'run');
  assert.match(result.run_id, /^run_/);
  assert.equal(result.status, 'awaiting_approval');
  assert.equal(result.preflight.decision, 'requires_approval');
  assert.equal(result.preflight.risk_level, 'high');
  assert.ok(result.preflight.evidence_refs.some(evidence => evidence.source === 'task.objective'));
  assert.equal(result.task.repo, tmpDir);

  runCli(tmpDir, 'init', '--soft-limit', '0.1', '--hard-limit', '0.1');
  const paused = runCli(tmpDir, 'run', 'Update source files');
  assert.equal(paused.ok, true);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.preflight.decision, 'block');
  assert.equal(paused.preflight.run_status, 'paused');
  assert.equal(paused.preflight.budget.hard_cap_exceeded, true);
  assert.ok(paused.preflight.blocked_reasons.includes('estimated_cost_exceeds_hard_limit'));
  assert.ok(paused.preflight.evidence_refs.some(evidence => evidence.source === 'task.budget'));

  console.log(JSON.stringify({ ok: true, test: 'cli-preflight' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
