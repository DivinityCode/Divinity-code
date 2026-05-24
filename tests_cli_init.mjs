import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, args, input = '') {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8', input }
  );
  return JSON.parse(output);
}

function readConfig(tmpDir) {
  return JSON.parse(readFileSync(path.join(tmpDir, '.divinity.json'), 'utf8'));
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-init-test-'));

try {
  const defaultResult = runCli(tmpDir, ['init']);
  assert.equal(defaultResult.ok, true);
  assert.equal(defaultResult.command, 'init');
  assert.equal(defaultResult.config.policy_id, 'safe_exec');
  assert.deepEqual(readConfig(tmpDir), {
    policy_id: 'safe_exec',
    budget: { soft_limit_usd: 2, hard_limit_usd: 5 },
    scope: { org_id: 'default-org', project_id: 'default-project' }
  });

  const flagResult = runCli(tmpDir, ['init', '--policy', 'scoped_edit', '--soft-limit', '3.5', '--hard-limit', '9', '--org', 'acme', '--project', 'platform']);
  assert.equal(flagResult.ok, true);
  assert.deepEqual(readConfig(tmpDir), {
    policy_id: 'scoped_edit',
    budget: { soft_limit_usd: 3.5, hard_limit_usd: 9 },
    scope: { org_id: 'acme', project_id: 'platform' }
  });

  const wizardResult = runCli(tmpDir, ['init', '--wizard'], 'read_only\n1.25\n2.5\nops\nsandbox\n');
  assert.equal(wizardResult.ok, true);
  assert.deepEqual(readConfig(tmpDir), {
    policy_id: 'read_only',
    budget: { soft_limit_usd: 1.25, hard_limit_usd: 2.5 },
    scope: { org_id: 'ops', project_id: 'sandbox' }
  });

  assert.throws(() => runCli(tmpDir, ['init', '--policy', 'unknown']));
  assert.throws(() => runCli(tmpDir, ['init', '--soft-limit', '4', '--hard-limit', '2']));

  console.log(JSON.stringify({ ok: true, test: 'cli-init' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
