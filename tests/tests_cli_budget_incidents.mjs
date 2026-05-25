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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-budget-incidents-'));

try {
  runCli(tmpDir, 'init', '--soft-limit', '0.1', '--hard-limit', '5', '--org', 'acme', '--project', 'platform');
  const result = runCli(tmpDir, 'run', 'Update source files');

  assert.equal(result.ok, true);
  assert.equal(result.status, 'queued');
  assert.ok(result.preflight.warnings.includes('estimated_cost_exceeds_soft_limit'));
  assert.equal(result.budget_incidents.length, 1);
  assert.equal(result.budget_incidents[0].severity, 'warning');
  assert.equal(result.budget_incidents[0].threshold, 'soft_limit');
  assert.equal(result.budget_incidents[0].run_id, result.run_id);
  assert.deepEqual(result.budget_incidents[0].scope, { org_id: 'acme', project_id: 'platform' });

  console.log(JSON.stringify({ ok: true, test: 'cli-budget-incidents' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
