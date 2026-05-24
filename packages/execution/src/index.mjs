import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

function predictedActionTypes(step) {
  return new Set((step?.pre_execution_check?.predicted_actions || []).map(action => action.type));
}

function workspacePath({ run, cwd }) {
  return path.resolve(cwd || run?.task?.repo || process.cwd());
}

function ensureAllowedStep(step) {
  if (step?.status !== 'pending' || step?.pre_execution_check?.decision !== 'allow') {
    throw new Error('execution requires a pending allowed step');
  }
}

function executionEnvelope({ run, step, adapter, status, exit_code, stdout = '', stderr = '', target_path = null, started_at }) {
  return {
    execution_id: `exec_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    run_id: run.run_id,
    step_id: step.step_id,
    adapter,
    status,
    exit_code,
    target_path,
    stdout,
    stderr,
    started_at,
    completed_at: new Date().toISOString()
  };
}

function executeFileRead({ run, step, cwd, started_at }) {
  const root = workspacePath({ run, cwd });
  const targetPath = 'README.md';
  const absolutePath = path.join(root, targetPath);
  try {
    return executionEnvelope({
      run,
      step,
      adapter: 'file_read',
      status: 'completed',
      exit_code: 0,
      target_path: targetPath,
      stdout: fs.readFileSync(absolutePath, 'utf8'),
      started_at
    });
  } catch (error) {
    return executionEnvelope({
      run,
      step,
      adapter: 'file_read',
      status: 'failed',
      exit_code: 1,
      target_path: targetPath,
      stderr: error.message,
      started_at
    });
  }
}

function executeGitStatus({ run, step, cwd, started_at }) {
  const result = spawnSync('git', ['status', '--short'], {
    cwd: workspacePath({ run, cwd }),
    encoding: 'utf8'
  });

  return executionEnvelope({
    run,
    step,
    adapter: 'git_status',
    status: result.status === 0 ? 'completed' : 'failed',
    exit_code: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || '',
    started_at
  });
}

function nodeTestScriptForAction(action) {
  const text = action || '';
  if (/\bfixture\b/i.test(text) && /\bnode\s+test\b/i.test(text)) return 'tests_execution_fixture.mjs';
  if (/\bdashboard\s+static\s+test\b/i.test(text)) return 'tests/tests_dashboard_static.mjs';
  return null;
}

function executeNodeTest({ run, step, cwd, started_at }) {
  const targetPath = nodeTestScriptForAction(step?.action);
  const result = spawnSync(process.execPath, [targetPath], {
    cwd: workspacePath({ run, cwd }),
    encoding: 'utf8'
  });

  return executionEnvelope({
    run,
    step,
    adapter: 'node_test',
    status: result.status === 0 ? 'completed' : 'failed',
    exit_code: result.status ?? 1,
    target_path: targetPath,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || '',
    started_at
  });
}

export function resolveExecutionAdapter(step) {
  const actionTypes = predictedActionTypes(step);
  if (actionTypes.has('file_read')) return 'file_read';
  if (actionTypes.has('shell') && /\bgit\s+status\b/i.test(step?.action || '')) return 'git_status';
  if (actionTypes.has('shell') && nodeTestScriptForAction(step?.action)) return 'node_test';
  return 'manual';
}

export function executeStep({ run, step, cwd }) {
  ensureAllowedStep(step);
  const started_at = new Date().toISOString();
  const adapter = resolveExecutionAdapter(step);

  if (adapter === 'file_read') {
    return executeFileRead({ run, step, cwd, started_at });
  }

  if (adapter === 'git_status') {
    return executeGitStatus({ run, step, cwd, started_at });
  }

  if (adapter === 'node_test') {
    return executeNodeTest({ run, step, cwd, started_at });
  }

  return executionEnvelope({
    run,
    step,
    adapter,
    status: 'failed',
    exit_code: 1,
    stderr: `no execution adapter for step action: ${step.action || 'unknown'}`,
    started_at
  });
}
