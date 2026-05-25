import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { executeStep } from '../packages/execution/src/index.mjs';
import { resolveRunnerIsolationProfile } from '../packages/runner-isolation/src/index.mjs';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-execution-test-'));
const originalPath = process.env.PATH;

try {
  const binDir = path.join(tmpDir, 'bin');
  mkdirSync(path.join(tmpDir, 'docs'));
  mkdirSync(binDir);
  mkdirSync(path.join(tmpDir, 'scripts'));
  writeFileSync(path.join(tmpDir, 'README.md'), '# Fixture README\n\nExecution evidence.\n');
  writeFileSync(path.join(tmpDir, 'tests_execution_fixture.mjs'), "console.log('fixture node test ok');\n");
  writeFileSync(path.join(tmpDir, 'scripts', 'fixture-package.mjs'), "console.log('fixture package script ok');\n");
  const fakeDockerPath = path.join(binDir, 'docker');
  writeFileSync(fakeDockerPath, `#!${process.execPath}
const args = process.argv.slice(2);
const command = args.slice(args.indexOf('node:22-bookworm-slim') + 1);
console.log('fake docker argv ' + JSON.stringify(args));
console.log('fake docker command ' + command.join(' '));
if (!args.includes('--network') || args[args.indexOf('--network') + 1] !== 'none') process.exit(11);
if (!args.some(arg => arg.startsWith('type=bind,source=') && arg.endsWith(',target=/workspace'))) process.exit(12);
if (!args.includes('-w') || args[args.indexOf('-w') + 1] !== '/workspace') process.exit(13);
if (!args.includes('node:22-bookworm-slim')) process.exit(14);
if (![
  'git status --short',
  'node tests_execution_fixture.mjs',
  'node scripts/fixture-package.mjs'
].includes(command.join(' '))) process.exit(15);
`);
  chmodSync(fakeDockerPath, 0o755);
  process.env.PATH = `${binDir}${path.delimiter}${originalPath || ''}`;
  writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({
    scripts: {
      'fixture:ok': 'node scripts/fixture-package.mjs',
      'fixture:unsafe': 'echo unsafe'
    }
  }, null, 2));
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

  const containerRun = {
    run_id: 'run_container_execution',
    task: {
      repo: tmpDir
    },
    workspace: {
      kind: 'local_snapshot',
      path: tmpDir,
      isolation: resolveRunnerIsolationProfile({ profile_id: 'container_sandbox' })
    }
  };
  const containerGitStatus = executeStep({
    run: containerRun,
    step: {
      ...gitStatusStep,
      step_id: 'step_container_git_status',
      run_id: containerRun.run_id
    },
    cwd: tmpDir
  });
  assert.equal(containerGitStatus.adapter, 'git_status');
  assert.equal(containerGitStatus.status, 'completed');
  assert.equal(containerGitStatus.exit_code, 0);
  assert.match(containerGitStatus.stdout, /fake docker argv/);
  assert.ok(containerGitStatus.stdout.includes('git status --short'));

  const nodeTestStep = {
    step_id: 'step_node_test',
    run_id: run.run_id,
    action: 'Run fixture node test command',
    status: 'pending',
    pre_execution_check: {
      decision: 'allow',
      predicted_actions: [{ type: 'shell', risk_level: 'high', permission: 'shell:execute' }]
    }
  };
  const nodeTest = executeStep({ run, step: nodeTestStep, cwd: tmpDir });
  assert.equal(nodeTest.adapter, 'node_test');
  assert.equal(nodeTest.status, 'completed');
  assert.equal(nodeTest.exit_code, 0);
  assert.equal(nodeTest.target_path, 'tests_execution_fixture.mjs');
  assert.match(nodeTest.stdout, /fixture node test ok/);

  const containerNodeTest = executeStep({
    run: containerRun,
    step: {
      ...nodeTestStep,
      step_id: 'step_container_node_test',
      run_id: containerRun.run_id
    },
    cwd: tmpDir
  });
  assert.equal(containerNodeTest.adapter, 'node_test');
  assert.equal(containerNodeTest.status, 'completed');
  assert.equal(containerNodeTest.exit_code, 0);
  assert.match(containerNodeTest.stdout, /fake docker argv/);
  assert.ok(containerNodeTest.stdout.includes('--network'));
  assert.ok(containerNodeTest.stdout.includes('none'));
  assert.ok(containerNodeTest.stdout.includes(`type=bind,source=${path.resolve(tmpDir)},target=/workspace`));
  assert.ok(containerNodeTest.stdout.includes('node tests_execution_fixture.mjs'));

  const packageScriptStep = {
    step_id: 'step_package_script',
    run_id: run.run_id,
    action: 'Run package script fixture:ok',
    status: 'pending',
    pre_execution_check: {
      decision: 'allow',
      predicted_actions: [{ type: 'shell', risk_level: 'high', permission: 'shell:execute' }]
    }
  };
  const packageScript = executeStep({ run, step: packageScriptStep, cwd: tmpDir });
  assert.equal(packageScript.adapter, 'package_script');
  assert.equal(packageScript.status, 'completed');
  assert.equal(packageScript.exit_code, 0);
  assert.equal(packageScript.target_path, 'package.json#scripts.fixture:ok');
  assert.match(packageScript.stdout, /fixture package script ok/);

  const containerPackageScript = executeStep({
    run: containerRun,
    cwd: tmpDir,
    step: {
      ...packageScriptStep,
      step_id: 'step_container_package_script',
      run_id: containerRun.run_id
    }
  });
  assert.equal(containerPackageScript.adapter, 'package_script');
  assert.equal(containerPackageScript.status, 'completed');
  assert.equal(containerPackageScript.exit_code, 0);
  assert.equal(containerPackageScript.target_path, 'package.json#scripts.fixture:ok');
  assert.match(containerPackageScript.stdout, /fake docker argv/);
  assert.ok(containerPackageScript.stdout.includes('node scripts/fixture-package.mjs'));

  const unsafePackageScript = executeStep({
    run,
    cwd: tmpDir,
    step: {
      ...packageScriptStep,
      step_id: 'step_package_script_unsafe',
      action: 'Run package script fixture:unsafe'
    }
  });
  assert.equal(unsafePackageScript.adapter, 'package_script');
  assert.equal(unsafePackageScript.status, 'failed');
  assert.equal(unsafePackageScript.exit_code, 1);
  assert.match(unsafePackageScript.stderr, /unsupported package script command/);

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
  process.env.PATH = originalPath;
  rmSync(tmpDir, { recursive: true, force: true });
}
