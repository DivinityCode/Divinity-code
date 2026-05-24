import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { executeStep } from './packages/execution/src/index.mjs';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-execution-test-'));

try {
  mkdirSync(path.join(tmpDir, 'docs'));
  writeFileSync(path.join(tmpDir, 'README.md'), '# Fixture README\n\nExecution evidence.\n');
  execFileSync('git', ['init'], { cwd: tmpDir, stdio: 'ignore' });
  writeFileSync(path.join(tmpDir, 'changed.txt'), 'pending change\n');

  const run = {
    run_id: 'run_execution',
    task: {
      repo: tmpDir
    }
  };

  const allowedStep = {
    step_id: 'step_read',
    run_id: run.run_id,
    action: 'Read README',
    status: 'pending',
    pre_execution_check: {
      decision: 'allow',
      predicted_actions: [{ type: 'file_read', risk_level: 'low', permission: 'file:read' }]
    }
  };

  const result = executeStep({ run, step: allowedStep, cwd: tmpDir });
  assert.match(result.execution_id, /^exec_/);
  assert.equal(result.run_id, run.run_id);
  assert.equal(result.step_id, allowedStep.step_id);
  assert.equal(result.adapter, 'file_read');
  assert.equal(result.status, 'completed');
  assert.equal(result.exit_code, 0);
  assert.equal(result.target_path, 'README.md');
  assert.match(result.stdout, /Execution evidence/);
  assert.equal(result.stderr, '');
  assert.match(result.started_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.match(result.completed_at, /^\d{4}-\d{2}-\d{2}T/);

  const gitStatusStep = {
    step_id: 'step_git_status',
    run_id: run.run_id,
    action: 'Run git status command',
    status: 'pending',
    pre_execution_check: {
      decision: 'allow',
      predicted_actions: [{ type: 'shell', risk_level: 'high', permission: 'shell:execute' }]
    }
  };
  const gitStatus = executeStep({ run, step: gitStatusStep, cwd: tmpDir });
  assert.equal(gitStatus.adapter, 'git_status');
  assert.equal(gitStatus.status, 'completed');
  assert.equal(gitStatus.exit_code, 0);
  assert.equal(gitStatus.target_path, null);
  assert.match(gitStatus.stdout, /\?\? README\.md/);
  assert.match(gitStatus.stdout, /\?\? changed\.txt/);

  assert.throws(() => executeStep({
    run,
    cwd: tmpDir,
    step: {
      ...allowedStep,
      step_id: 'step_blocked',
      status: 'blocked',
      pre_execution_check: {
        ...allowedStep.pre_execution_check,
        decision: 'block'
      }
    }
  }), /pending allowed step/);

  console.log(JSON.stringify({ ok: true, test: 'execution-adapter' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
