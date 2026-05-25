import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: tmpDir,
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'OPENROUTER_API_KEY_VALUE'
      }
    }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-criteria-test-'));

try {
  runCli(tmpDir, 'init');
  const result = runCli(
    tmpDir,
    'run',
    '--criteria',
    'All contract examples validate',
    '--success-criteria=Smoke test leaves no repo config behind',
    'Stabilize',
    'bootstrap',
    'checks'
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'run');
  assert.equal(result.task.objective, 'Stabilize bootstrap checks');
  assert.deepEqual(result.task.success_criteria, [
    'All contract examples validate',
    'Smoke test leaves no repo config behind'
  ]);
  assert.equal(result.task.llm_provider.provider_id, 'openrouter');
  assert.equal(result.task.provider_runtime.provider_id, 'openrouter');
  assert.equal(result.task.provider_runtime.auth.credential_configured, true);
  assert.equal(JSON.stringify(result.task.provider_runtime).includes('OPENROUTER_API_KEY_VALUE'), false);
  assert.ok(result.task.toolset_resolution.tools.includes('read_file'));
  assert.equal(
    result.task.toolset_resolution.toolsets.some(toolset => toolset.toolset_id === 'terminal'),
    false
  );

  console.log(JSON.stringify({ ok: true, test: 'cli-success-criteria' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
