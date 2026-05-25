#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline/promises';

import { createAgentActivityRecords } from '../../../packages/agent-activity/src/index.mjs';
import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createCapabilitiesCatalog } from '../../../packages/capabilities/src/index.mjs';
import { createConnectorReferences } from '../../../packages/connectors/src/index.mjs';
import { createInitialRunEvents } from '../../../packages/events/src/index.mjs';
import { createRunMemoryEntries } from '../../../packages/memory/src/index.mjs';
import { createOrchestrationTrace } from '../../../packages/orchestration/src/index.mjs';
import { resolvePolicyPackForTask } from '../../../packages/policy-packs/src/index.mjs';
import { evaluatePreflight, POLICY_PRESETS } from '../../../packages/policy-engine/src/index.mjs';
import { publicStarterRecipes } from '../../../packages/recipes/src/index.mjs';

const [, , command, ...args] = process.argv;
const cwd = process.cwd();
const configPath = path.join(cwd, '.divinity.json');
const DEFAULT_CONFIG = {
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2, hard_limit_usd: 5 },
  scope: { org_id: 'default-org', project_id: 'default-project' }
};
const POLICY_IDS = Object.keys(POLICY_PRESETS);

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function commandCheck(check_id, executable, values = [], { required = true } = {}) {
  const result = spawnSync(executable, values, { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/)[0];
  return {
    check_id,
    ok: result.status === 0,
    required,
    summary: output || result.error?.message || `command exited with ${result.status}`
  };
}

function optionalCommandCheck(check_id, executable, values = []) {
  return commandCheck(check_id, executable, values, { required: false });
}

function fileCheck(check_id, filePath) {
  return {
    check_id,
    ok: fs.existsSync(filePath),
    required: true,
    summary: filePath
  };
}

function directoryCheck(check_id, directoryPath) {
  let ok = false;
  try {
    ok = fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory();
  } catch {
    ok = false;
  }

  return {
    check_id,
    ok,
    required: true,
    summary: directoryPath
  };
}

function dependencyCheck(check_id, packageNames) {
  const missing = packageNames.filter(name => !fs.existsSync(path.join(cwd, 'node_modules', name)));
  return {
    check_id,
    ok: missing.length === 0,
    required: true,
    summary: missing.length ? `missing: ${missing.join(', ')}` : `installed: ${packageNames.join(', ')}`
  };
}

function cachedPnpmCheck() {
  const home = process.env.HOME || '';
  const corepackPnpmRoot = path.join(home, '.cache/node/corepack/v1/pnpm');
  const candidates = [];
  try {
    for (const version of fs.readdirSync(corepackPnpmRoot)) {
      candidates.push(path.join(corepackPnpmRoot, version, 'bin/pnpm.cjs'));
      candidates.push(path.join(corepackPnpmRoot, version, 'dist/pnpm.cjs'));
    }
  } catch {
    // Fall back to PATH lookup below when no Corepack cache is present.
  }
  const candidate = candidates.find(filePath => fs.existsSync(filePath));

  if (!candidate) return optionalCommandCheck('pnpm', 'pnpm', ['--version']);

  const result = spawnSync(process.execPath, [candidate, '--version'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`.trim().split(/\r?\n/)[0];
  return {
    check_id: 'pnpm',
    ok: result.status === 0,
    required: false,
    summary: `${candidate}${output ? ` ${output}` : ''}` || result.error?.message || `command exited with ${result.status}`
  };
}

function packageManagerCheck(npmCheck, pnpmCheck) {
  const available = [npmCheck, pnpmCheck].filter(check => check.ok);
  return {
    check_id: 'package_manager',
    ok: available.length > 0,
    required: true,
    summary: available.length ? available.map(check => check.check_id).join(', ') : 'no npm or pnpm executable available'
  };
}

function buildDoctorChecks() {
  const npmCheck = optionalCommandCheck('npm', 'npm', ['--version']);
  const pnpmCheck = cachedPnpmCheck();
  const dockerCheck = optionalCommandCheck('docker', 'docker', ['--version']);
  return [
    { check_id: 'node', ok: true, required: true, summary: process.version },
    npmCheck,
    pnpmCheck,
    packageManagerCheck(npmCheck, pnpmCheck),
    dockerCheck,
    commandCheck('git', 'git', ['--version']),
    fileCheck('package_json', path.join(cwd, 'package.json')),
    directoryCheck('node_modules', path.join(cwd, 'node_modules')),
    dependencyCheck('ajv_dependencies', ['ajv', 'ajv-cli', 'ajv-formats']),
    fileCheck('api_server_source', path.join(cwd, 'apps/api/src/server.mjs'))
  ];
}

function runGit(values) {
  const result = spawnSync('git', values, {
    cwd,
    encoding: 'utf8'
  });
  return result.status === 0 ? (result.stdout || '').trim() : '';
}

function gitContext() {
  return {
    branch: runGit(['branch', '--show-current']),
    head: runGit(['rev-parse', '--short', 'HEAD']),
    status_short: runGit(['status', '--short'])
  };
}

function renderBugMarkdown(report) {
  const diagnostics = report.diagnostics.checks.map(check => (
    `- ${check.check_id}: ${check.ok ? 'ok' : 'needs attention'} - ${check.summary}`
  )).join('\n');

  return [
    '## Summary',
    report.summary,
    '',
    '## Environment',
    `- Node: ${report.environment.node}`,
    `- Platform: ${report.environment.platform}/${report.environment.arch}`,
    `- CWD: ${report.cwd}`,
    '',
    '## Git',
    `- Branch: ${report.git.branch || '(unknown)'}`,
    `- Head: ${report.git.head || '(unknown)'}`,
    '```text',
    report.git.status_short || '(clean)',
    '```',
    '',
    '## Diagnostics',
    diagnostics || '(no diagnostics)',
    ''
  ].join('\n');
}

function parseInitArgs(values) {
  const options = {
    wizard: false,
    policy_id: DEFAULT_CONFIG.policy_id,
    soft_limit_usd: DEFAULT_CONFIG.budget.soft_limit_usd,
    hard_limit_usd: DEFAULT_CONFIG.budget.hard_limit_usd,
    org_id: DEFAULT_CONFIG.scope.org_id,
    project_id: DEFAULT_CONFIG.scope.project_id
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--wizard') {
      options.wizard = true;
    } else if (value === '--policy' || value === '--policy-id') {
      options.policy_id = next;
      index += 1;
    } else if (value === '--soft-limit' || value === '--soft-limit-usd') {
      options.soft_limit_usd = next;
      index += 1;
    } else if (value === '--hard-limit' || value === '--hard-limit-usd') {
      options.hard_limit_usd = next;
      index += 1;
    } else if (value === '--org' || value === '--org-id') {
      options.org_id = next;
      index += 1;
    } else if (value === '--project' || value === '--project-id') {
      options.project_id = next;
      index += 1;
    } else {
      throw new Error(`unknown init option: ${value}`);
    }
  }

  return options;
}

function parseConnectorReferenceFlag(value) {
  const [adapter, resource_type, resource_id, ...urlParts] = String(value || '').split(':');
  const reference = {
    adapter,
    resource_type,
    resource_id
  };
  const url = urlParts.join(':').trim();
  if (url) reference.url = url;
  return reference;
}

function parseRunArgs(values) {
  const objectiveParts = [];
  const connectorReferences = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--connector') {
      connectorReferences.push(parseConnectorReferenceFlag(values[index + 1]));
      index += 1;
    } else if (value.startsWith('--connector=')) {
      connectorReferences.push(parseConnectorReferenceFlag(value.slice('--connector='.length)));
    } else {
      objectiveParts.push(value);
    }
  }

  return {
    objective: objectiveParts.join(' ').trim() || 'No objective provided',
    connector_references: connectorReferences
  };
}

function asBudgetNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
  }
  return parsed;
}

function asScopeId(value, label) {
  const parsed = String(value || '').trim();
  if (!parsed) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return parsed;
}

function buildConfig(options) {
  if (!POLICY_IDS.includes(options.policy_id)) {
    throw new Error(`policy_id must be one of: ${POLICY_IDS.join(', ')}`);
  }

  const softLimit = asBudgetNumber(options.soft_limit_usd, 'soft_limit_usd');
  const hardLimit = asBudgetNumber(options.hard_limit_usd, 'hard_limit_usd');
  if (hardLimit < softLimit) {
    throw new Error('hard_limit_usd must be greater than or equal to soft_limit_usd');
  }

  return {
    policy_id: options.policy_id,
    budget: {
      soft_limit_usd: softLimit,
      hard_limit_usd: hardLimit
    },
    scope: {
      org_id: asScopeId(options.org_id, 'org_id'),
      project_id: asScopeId(options.project_id, 'project_id')
    }
  };
}

async function askForConfig(options) {
  if (!process.stdin.isTTY) {
    process.stderr.write(`Policy presets: ${POLICY_IDS.join(', ')}\n`);
    process.stderr.write(`Policy preset [${options.policy_id}]: `);
    process.stderr.write(`Soft budget USD [${options.soft_limit_usd}]: `);
    process.stderr.write(`Hard budget USD [${options.hard_limit_usd}]: `);
    process.stderr.write(`Org ID [${options.org_id}]: `);
    process.stderr.write(`Project ID [${options.project_id}]: `);
    const [policy = '', soft = '', hard = '', org = '', project = ''] = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd,
      org_id: org.trim() || options.org_id,
      project_id: project.trim() || options.project_id
    };
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write(`Policy presets: ${POLICY_IDS.join(', ')}\n`);
    const policy = await rl.question(`Policy preset [${options.policy_id}]: `);
    const soft = await rl.question(`Soft budget USD [${options.soft_limit_usd}]: `);
    const hard = await rl.question(`Hard budget USD [${options.hard_limit_usd}]: `);
    const org = await rl.question(`Org ID [${options.org_id}]: `);
    const project = await rl.question(`Project ID [${options.project_id}]: `);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd,
      org_id: org.trim() || options.org_id,
      project_id: project.trim() || options.project_id
    };
  } finally {
    rl.close();
  }
}

async function init() {
  try {
    const options = parseInitArgs(args);
    const config = buildConfig(options.wizard ? await askForConfig(options) : options);

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
    print({ ok: true, command: 'init', config_path: configPath, config, starter_recipes: publicStarterRecipes() });
  } catch (error) {
    print({ ok: false, command: 'init', error: error.message });
    process.exitCode = 1;
  }
}

function run() {
  const parsedArgs = parseRunArgs(args);
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : DEFAULT_CONFIG;
  const payload = {
    task_id: `task_${Date.now()}`,
    objective: parsedArgs.objective,
    repo: cwd,
    scope: config.scope || DEFAULT_CONFIG.scope,
    policy_id: config.policy_id,
    budget: config.budget,
    connector_references: parsedArgs.connector_references,
    created_at: new Date().toISOString()
  };
  const preflight = evaluatePreflight({ task: payload });
  const run_id = `run_${Date.now()}`;
  const status = preflight.run_status;
  const connector_references = createConnectorReferences({
    run_id,
    references: parsedArgs.connector_references,
    attached_by: 'cli',
    attached_at: payload.created_at
  });
  const agent_activity = createAgentActivityRecords({
    run_id,
    task: payload,
    status,
    preflight,
    created_at: payload.created_at
  });

  print({
    ok: true,
    command: 'run',
    run_id,
    status,
    preflight,
    policy_pack: resolvePolicyPackForTask(payload),
    orchestration: createOrchestrationTrace({ run_id, task: payload, status, preflight }),
    connector_references,
    agent_activity,
    memory: createRunMemoryEntries({ run_id, task: payload, preflight, recorded_at: payload.created_at }),
    artifacts: createRunArtifacts({ run_id, task: payload, status, preflight }).map(publicArtifactMetadata),
    events: createInitialRunEvents({ run_id, task: payload, preflight, status }),
    task: payload
  });
}

function status() {
  print({ ok: true, command: 'status', status: 'queued' });
}

function approve() {
  print({ ok: true, command: 'approve', status: 'approved' });
}

function recipes() {
  print({ ok: true, command: 'recipes', recipes: publicStarterRecipes() });
}

function capabilities() {
  print({ ok: true, command: 'capabilities', catalog: createCapabilitiesCatalog() });
}

function doctorPayload() {
  const checks = buildDoctorChecks();
  return {
    ok: checks.every(check => !check.required || check.ok),
    command: 'doctor',
    checks
  };
}

function doctor() {
  print(doctorPayload());
}

function bug() {
  const summary = args.join(' ').trim() || 'Bug report';
  const diagnostics = doctorPayload();
  const report = {
    format: 'divinity.bug_report.v1',
    title: `Divinity Code bug report: ${summary}`,
    summary,
    created_at: new Date().toISOString(),
    cwd,
    environment: {
      node: process.version,
      platform: process.platform,
      arch: process.arch
    },
    git: gitContext(),
    diagnostics: {
      ok: diagnostics.ok,
      checks: diagnostics.checks
    },
    markdown: ''
  };
  report.markdown = renderBugMarkdown(report);
  print({ ok: true, command: 'bug', report });
}

switch (command) {
  case 'init': await init(); break;
  case 'run': run(); break;
  case 'status': status(); break;
  case 'approve': approve(); break;
  case 'capabilities': capabilities(); break;
  case 'recipes': recipes(); break;
  case 'doctor': doctor(); break;
  case 'bug': bug(); break;
  default:
    print({
      ok: false,
      usage: 'divinity <init|run|status|approve|capabilities|recipes|doctor|bug> [args]'
    });
}
