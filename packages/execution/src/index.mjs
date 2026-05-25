import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { createContainerCommandPlan } from '../../runner-isolation/src/index.mjs';

export const DEFAULT_MAX_EXECUTION_ATTEMPTS = 2;

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

function containerIsolationProfile(run) {
  const isolation = run?.workspace?.isolation;
  return isolation?.kind === 'container' ? isolation : null;
}

function spawnConstrainedCommand({
  run,
  cwd,
  localCommand,
  containerCommand = localCommand
}) {
  const root = workspacePath({ run, cwd });
  const containerProfile = containerIsolationProfile(run);

  if (containerProfile) {
    try {
      const plan = createContainerCommandPlan({
        workspacePath: root,
        command: containerCommand,
        profile_id: containerProfile.profile_id
      });
      return spawnSync(plan.argv[0], plan.argv.slice(1), {
        encoding: 'utf8'
      });
    } catch (error) {
      return {
        status: 1,
        stdout: '',
        stderr: error.message
      };
    }
  }

  return spawnSync(localCommand[0], localCommand.slice(1), {
    cwd: root,
    encoding: 'utf8'
  });
}

function ensureAllowedStep(step) {
  if (step?.status !== 'pending' || step?.pre_execution_check?.decision !== 'allow') {
    throw new Error('execution requires a pending allowed step');
  }
}

function executionEnvelope({
  run,
  step,
  adapter,
  status,
  exit_code,
  stdout = '',
  stderr = '',
  target_path = null,
  started_at,
  attempt = 1,
  max_attempts = DEFAULT_MAX_EXECUTION_ATTEMPTS,
  retry_of = null
}) {
  return {
    execution_id: `exec_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    run_id: run.run_id,
    step_id: step.step_id,
    adapter,
    status,
    exit_code,
    attempt,
    max_attempts,
    retry_of,
    target_path,
    stdout,
    stderr,
    started_at,
    completed_at: new Date().toISOString()
  };
}

function executeFileRead({ run, step, cwd, started_at, attemptState }) {
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
      started_at,
      ...attemptState
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
      started_at,
      ...attemptState
    });
  }
}

function executeGitStatus({ run, step, cwd, started_at, attemptState }) {
  const result = spawnConstrainedCommand({
    run,
    cwd,
    localCommand: ['git', 'status', '--short']
  });

  return executionEnvelope({
    run,
    step,
    adapter: 'git_status',
    status: result.status === 0 ? 'completed' : 'failed',
    exit_code: result.status ?? 1,
    stdout: result.stdout || '',
    stderr: result.stderr || result.error?.message || '',
    started_at,
    ...attemptState
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

function executePackageScript({ run, step, cwd, started_at, attemptState }) {
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
      const result = spawnConstrainedCommand({
        run,
        cwd,
        localCommand: [process.execPath, relativeTarget],
        containerCommand: ['node', relativeTarget]
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
          started_at,
          ...attemptState
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
      started_at,
      ...attemptState
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
      started_at,
      ...attemptState
    });
  }
}

function executeNodeTest({ run, step, cwd, started_at, attemptState }) {
  const targetPath = nodeTestScriptForAction(step?.action);
  const result = spawnConstrainedCommand({
    run,
    cwd,
    localCommand: [process.execPath, targetPath],
    containerCommand: ['node', targetPath]
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
    started_at,
    ...attemptState
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

function executionsForStep(run, step) {
  return (run?.executions || []).filter(execution => execution.step_id === step?.step_id);
}

export function createExecutionAttemptState({
  run,
  step,
  retry = false,
  max_attempts = DEFAULT_MAX_EXECUTION_ATTEMPTS
} = {}) {
  const attempts = executionsForStep(run, step);
  const attempts_used = attempts.length;
  const last = attempts[attempts.length - 1] || null;
  const maxAttempts = Math.max(1, Number(max_attempts || DEFAULT_MAX_EXECUTION_ATTEMPTS));
  const baseRetry = { attempts_used, max_attempts: maxAttempts };

  if (attempts_used === 0) {
    return {
      allowed: true,
      attempt: 1,
      max_attempts: maxAttempts,
      retry_of: null,
      retry: baseRetry
    };
  }

  if (!retry) {
    return {
      allowed: false,
      error: 'step has already been executed; pass retry=true to retry failed execution',
      retry: baseRetry
    };
  }

  if (step?.status !== 'failed' || last?.status !== 'failed') {
    return {
      allowed: false,
      error: 'execution retry requires failed previous execution',
      retry: baseRetry
    };
  }

  if (attempts_used >= maxAttempts) {
    return {
      allowed: false,
      error: 'execution retry limit exceeded',
      retry: baseRetry
    };
  }

  return {
    allowed: true,
    attempt: attempts_used + 1,
    max_attempts: maxAttempts,
    retry_of: last.execution_id,
    retry: baseRetry
  };
}

function ensureExecutableStep(step, attemptState) {
  if (attemptState?.attempt > 1) {
    if (step?.status !== 'failed' || step?.pre_execution_check?.decision !== 'allow') {
      throw new Error('execution retry requires a failed allowed step');
    }
    return;
  }
  ensureAllowedStep(step);
}

export function executeStep({ run, step, cwd, attemptState }) {
  const state = attemptState || createExecutionAttemptState({ run, step });
  if (!state.allowed) throw new Error(state.error);
  ensureExecutableStep(step, state);
  const started_at = new Date().toISOString();
  const adapter = resolveExecutionAdapter(step);
  const envelopeState = {
    attempt: state.attempt,
    max_attempts: state.max_attempts,
    retry_of: state.retry_of
  };

  if (adapter === 'file_read') {
    return executeFileRead({ run, step, cwd, started_at, attemptState: envelopeState });
  }

  if (adapter === 'git_status') {
    return executeGitStatus({ run, step, cwd, started_at, attemptState: envelopeState });
  }

  if (adapter === 'node_test') {
    return executeNodeTest({ run, step, cwd, started_at, attemptState: envelopeState });
  }

  if (adapter === 'package_script') {
    return executePackageScript({ run, step, cwd, started_at, attemptState: envelopeState });
  }

  return executionEnvelope({
    run,
    step,
    adapter,
    status: 'failed',
    exit_code: 1,
    stderr: `no execution adapter for step action: ${step.action || 'unknown'}`,
    started_at,
    ...envelopeState
  });
}
