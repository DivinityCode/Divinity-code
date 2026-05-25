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
  assert.ok(result.preflight.evidence_refs.some(evidence => evidence.source === 'task.objective' && evidence.claim_type === 'inferred'));
  assert.ok(result.preflight.evidence_refs.some(evidence => evidence.source === 'policy.permissions' && evidence.claim_type === 'observed'));
  assert.equal(result.task.repo, tmpDir);
  assert.deepEqual(result.task.scope, { org_id: 'default-org', project_id: 'default-project' });

  const blockedByHook = runCli(tmpDir, 'run', 'Run shell command rm -rf build output');
  assert.equal(blockedByHook.status, 'failed');
  assert.equal(blockedByHook.preflight.decision, 'block');
  assert.ok(blockedByHook.preflight.blocked_reasons.includes('policy_hook:block_destructive_shell'));
  assert.ok(blockedByHook.preflight.policy_hooks.some(hook => hook.hook_id === 'block_destructive_shell' && hook.outcome === 'blocked'));
  assert.ok(blockedByHook.preflight.evidence_refs.some(evidence => evidence.source === 'policy_pack.pre_execution_hooks.block_destructive_shell'));

  runCli(tmpDir, 'init', '--soft-limit', '0.1', '--hard-limit', '0.1', '--org', 'acme', '--project', 'billing');
  const paused = runCli(tmpDir, 'run', 'Update source files');
  assert.deepEqual(paused.task.scope, { org_id: 'acme', project_id: 'billing' });
  assert.equal(paused.ok, true);
  assert.equal(paused.status, 'paused');
  assert.equal(paused.preflight.decision, 'block');
  assert.equal(paused.preflight.run_status, 'paused');
  assert.equal(paused.preflight.budget.hard_cap_exceeded, true);
  assert.ok(paused.preflight.blocked_reasons.includes('estimated_cost_exceeds_hard_limit'));
  assert.ok(paused.preflight.evidence_refs.some(evidence => evidence.source === 'task.budget' && evidence.claim_type === 'observed'));

  console.log(JSON.stringify({ ok: true, test: 'cli-preflight' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
