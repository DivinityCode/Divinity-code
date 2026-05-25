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

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-goals-test-'));

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
  assert.equal(result.goals.length, 2);
  assert.deepEqual(result.goals.map(goal => goal.title), [
    'All contract examples validate',
    'Smoke test leaves no repo config behind'
  ]);
  assert.ok(result.goals.every(goal => goal.run_id === result.run_id));
  assert.ok(result.goals.every(goal => goal.task_id === result.task.task_id));
  assert.ok(result.goals.every(goal => goal.status === 'pending'));
  assert.ok(result.goals.every(goal => goal.source === 'task.success_criteria'));

  console.log(JSON.stringify({ ok: true, test: 'cli-goal-records' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
