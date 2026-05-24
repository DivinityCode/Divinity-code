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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-agent-activity-test-'));

try {
  runCli(tmpDir, 'init');
  const result = runCli(tmpDir, 'run', 'Run a migration shell command');

  assert.equal(result.ok, true);
  assert.deepEqual(result.agent_activity.map(item => item.role), ['planner', 'executor', 'verifier']);
  assert.equal(result.agent_activity.find(item => item.role === 'executor').status, 'gated');
  assert.ok(result.agent_activity.every(item => item.run_id === result.run_id));
  assert.ok(result.agent_activity.every(item => Number.isFinite(item.budget_estimate_usd)));
  assert.ok(result.agent_activity.every(item => item.evidence_refs.length > 0));

  console.log(JSON.stringify({ ok: true, test: 'cli-agent-activity' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
