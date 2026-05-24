import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

export const EXECUTION_ADAPTERS = [
  {
    adapter: 'file_read',
    description: 'Read README.md from the run workspace.',
    action_types: ['file_read'],
    shell_interpolation: false
  },
  {
    adapter: 'git_status',
    description: 'Run git status --short in the run workspace.',
    action_types: ['shell'],
    shell_interpolation: false
  },
  {
    adapter: 'node_test',
    description: 'Run whitelisted Node test scripts with process.execPath.',
    action_types: ['shell'],
    shell_interpolation: false
  },
  {
    adapter: 'package_script',
    description: 'Run named Node-based package scripts without shell interpolation.',
    action_types: ['shell'],
    shell_interpolation: false
  },
  {
    adapter: 'manual',
    description: 'Record an unsupported action as a non-executed manual adapter result.',
    action_types: [],
    shell_interpolation: false
  }
];

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

function packageScriptNameForAction(action) {
  const text = action || '';
  return text.match(/\b(?:package|npm|pnpm)\s+script\s+([a-zA-Z0-9:_-]+)/i)?.[1]
    || text.match(/\b(?:npm|pnpm)\s+run\s+([a-zA-Z0-9:_-]+)/i)?.[1]
    || null;
}

function nodeTestScriptForAction(action) {
  const text = action || '';
  if (/\bfixture\b/i.test(text) && /\bnode\s+test\b/i.test(text)) return 'tests_execution_fixture.mjs';
  if (/\bdashboard\s+static\s+test\b/i.test(text)) return 'tests/tests_dashboard_static.mjs';
  return null;
}

function readPackageScript(root, scriptName) {
  const packagePath = path.join(root, 'package.json');
  const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
  const script = manifest.scripts?.[scriptName];
  if (!script) throw new Error(`package script not found: ${scriptName}`);
  return script;
}

function nodeCommandsForScript(script) {
  return script.split(/\s+&&\s+/).map(command => {
    const parts = command.trim().split(/\s+/).filter(Boolean);
    if (parts[0] !== 'node' || parts.length !== 2 || !parts[1].endsWith('.mjs')) {
      throw new Error(`unsupported package script command: ${command}`);
    }
    return parts[1];
  });
}

function assertWorkspaceRelative(root, targetPath) {
  const absolutePath = path.resolve(root, targetPath);
  const relativePath = path.relative(root, absolutePath);
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`package script target escapes workspace: ${targetPath}`);
  }
  return relativePath;
}

function executePackageScript({ run, step, cwd, started_at }) {
  const root = workspacePath({ run, cwd });
  const scriptName = packageScriptNameForAction(step?.action);
  const targetPath = `package.json#scripts.${scriptName || 'unknown'}`;

  try {
    const script = readPackageScript(root, scriptName);
    const commands = nodeCommandsForScript(script);
    let stdout = '';
    let stderr = '';

    for (const commandTarget of commands) {
      const relativeTarget = assertWorkspaceRelative(root, commandTarget);
      const result = spawnSync(process.execPath, [relativeTarget], {
        cwd: root,
        encoding: 'utf8'
      });
      stdout += result.stdout || '';
      stderr += result.stderr || result.error?.message || '';
      if (result.status !== 0) {
        return executionEnvelope({
          run,
          step,
          adapter: 'package_script',
          status: 'failed',
          exit_code: result.status ?? 1,
          target_path: targetPath,
          stdout,
          stderr,
          started_at
        });
      }
    }

    return executionEnvelope({
      run,
      step,
      adapter: 'package_script',
      status: 'completed',
      exit_code: 0,
      target_path: targetPath,
      stdout,
      stderr,
      started_at
    });
  } catch (error) {
    return executionEnvelope({
      run,
      step,
      adapter: 'package_script',
      status: 'failed',
      exit_code: 1,
      target_path: targetPath,
      stderr: error.message,
      started_at
    });
  }
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
  if (actionTypes.has('shell') && packageScriptNameForAction(step?.action)) return 'package_script';
  return 'manual';
}

export function publicExecutionAdapters() {
  return EXECUTION_ADAPTERS.map(adapter => ({
    ...adapter,
    action_types: [...adapter.action_types]
  }));
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

  if (adapter === 'package_script') {
    return executePackageScript({ run, step, cwd, started_at });
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
