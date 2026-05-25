#!/usr/bin/env node
import { spawnSync } from 'child_process';
import fs from 'fs';
import http from 'http';
import https from 'https';
import path from 'path';
import { createInterface } from 'readline/promises';

import { createAgentActivityRecords } from '../../../packages/agent-activity/src/index.mjs';
import { createApprovalComment } from '../../../packages/approval-comments/src/index.mjs';
import { createApprovalRevision, resubmitApprovalRevision } from '../../../packages/approval-revisions/src/index.mjs';
import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createBudgetIncidents } from '../../../packages/budget-incidents/src/index.mjs';
import { createCapabilitiesCatalog } from '../../../packages/capabilities/src/index.mjs';
import { createConnectorReferences } from '../../../packages/connectors/src/index.mjs';
import { createInitialRunEvents } from '../../../packages/events/src/index.mjs';
import { completeGoalRecord, createGoalRecords } from '../../../packages/goals/src/index.mjs';
import { createRunMemoryEntries } from '../../../packages/memory/src/index.mjs';
import { createOrchestrationTrace } from '../../../packages/orchestration/src/index.mjs';
import { executeProviderProxyChat, planProviderProxyRoute } from '../../../packages/provider-proxy/src/index.mjs';
import { providerCredentialReadiness, publicLlmProviders, resolveProviderRuntime } from '../../../packages/provider-runtime/src/index.mjs';
import { resolvePolicyPackForTask } from '../../../packages/policy-packs/src/index.mjs';
import { evaluatePreflight, POLICY_PRESETS } from '../../../packages/policy-engine/src/index.mjs';
import { publicStarterRecipes } from '../../../packages/recipes/src/index.mjs';
import { publicToolsets, resolveToolsets } from '../../../packages/toolsets/src/index.mjs';

const [, , command, ...args] = process.argv;
const cwd = process.cwd();
const configPath = path.join(cwd, '.divinity.json');
const DEFAULT_ENABLED_TOOLSETS = resolveToolsets().toolsets.map(toolset => toolset.toolset_id);
const DEFAULT_CONFIG = {
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2, hard_limit_usd: 5 },
  scope: { org_id: 'default-org', project_id: 'default-project' },
  llm_provider: {
    provider_id: 'openrouter',
    model: 'openai/gpt-4o-mini'
  },
  toolsets: {
    enabled: DEFAULT_ENABLED_TOOLSETS,
    disabled: []
  }
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

function providerCatalogCheck() {
  const providers = publicLlmProviders();
  return {
    check_id: 'provider_catalog',
    ok: providers.length > 0,
    required: true,
    summary: `${providers.length} providers: ${providers.map(provider => provider.provider_id).join(', ')}`
  };
}

function toolsetCatalogCheck() {
  const toolsets = publicToolsets();
  return {
    check_id: 'toolset_catalog',
    ok: toolsets.length > 0,
    required: true,
    summary: `${toolsets.length} toolsets: ${toolsets.map(toolset => toolset.toolset_id).join(', ')}`
  };
}

function llmProviderCredentialsCheck() {
  const readiness = providerCredentialReadiness();
  const configured = readiness.providers
    .filter(provider => provider.credential_configured)
    .map(provider => provider.provider_id);
  return {
    check_id: 'llm_provider_credentials',
    ok: readiness.any_configured,
    required: false,
    summary: configured.length
      ? `configured: ${configured.join(', ')}`
      : 'not configured: set one provider API key or use a local custom endpoint'
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
    providerCatalogCheck(),
    toolsetCatalogCheck(),
    llmProviderCredentialsCheck(),
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
    project_id: DEFAULT_CONFIG.scope.project_id,
    provider_id: DEFAULT_CONFIG.llm_provider.provider_id,
    model: DEFAULT_CONFIG.llm_provider.model,
    base_url: DEFAULT_CONFIG.llm_provider.base_url || '',
    enabled_toolsets: [...DEFAULT_CONFIG.toolsets.enabled],
    disabled_toolsets: [...DEFAULT_CONFIG.toolsets.disabled]
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
    } else if (value === '--provider' || value === '--provider-id') {
      options.provider_id = next;
      index += 1;
    } else if (value.startsWith('--provider=')) {
      options.provider_id = value.slice('--provider='.length);
    } else if (value === '--model') {
      options.model = next;
      index += 1;
    } else if (value.startsWith('--model=')) {
      options.model = value.slice('--model='.length);
    } else if (value === '--base-url' || value === '--provider-base-url') {
      options.base_url = next;
      index += 1;
    } else if (value.startsWith('--base-url=')) {
      options.base_url = value.slice('--base-url='.length);
    } else if (value === '--enable-toolsets' || value === '--enabled-toolsets') {
      options.enabled_toolsets = commaList(next);
      index += 1;
    } else if (value.startsWith('--enable-toolsets=')) {
      options.enabled_toolsets = commaList(value.slice('--enable-toolsets='.length));
    } else if (value === '--disable-toolsets' || value === '--disabled-toolsets') {
      options.disabled_toolsets = commaList(next);
      index += 1;
    } else if (value.startsWith('--disable-toolsets=')) {
      options.disabled_toolsets = commaList(value.slice('--disable-toolsets='.length));
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
  const successCriteria = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--connector') {
      connectorReferences.push(parseConnectorReferenceFlag(values[index + 1]));
      index += 1;
    } else if (value.startsWith('--connector=')) {
      connectorReferences.push(parseConnectorReferenceFlag(value.slice('--connector='.length)));
    } else if (value === '--criteria' || value === '--success-criteria') {
      successCriteria.push(String(values[index + 1] || '').trim());
      index += 1;
    } else if (value.startsWith('--criteria=')) {
      successCriteria.push(value.slice('--criteria='.length).trim());
    } else if (value.startsWith('--success-criteria=')) {
      successCriteria.push(value.slice('--success-criteria='.length).trim());
    } else {
      objectiveParts.push(value);
    }
  }

  return {
    objective: objectiveParts.join(' ').trim() || 'No objective provided',
    connector_references: connectorReferences,
    success_criteria: successCriteria.filter(Boolean)
  };
}

function commaList(value) {
  return String(value || '')
    .split(',')
    .map(item => item.trim())
    .filter(Boolean);
}

function parseApprovalArgs(values, defaultDecision = 'approve') {
  const options = {
    run_id: '',
    api: '',
    decision: defaultDecision,
    actor: 'cli',
    reason: ''
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else if (value === '--decision') {
      options.decision = next;
      index += 1;
    } else if (value.startsWith('--decision=')) {
      options.decision = value.slice('--decision='.length);
    } else if (value === '--actor') {
      options.actor = next;
      index += 1;
    } else if (value.startsWith('--actor=')) {
      options.actor = value.slice('--actor='.length);
    } else if (value === '--reason') {
      options.reason = next;
      index += 1;
    } else if (value.startsWith('--reason=')) {
      options.reason = value.slice('--reason='.length);
    } else if (value === '--reject') {
      options.decision = 'reject';
    } else if (!options.run_id) {
      options.run_id = value;
    } else {
      throw new Error(`unknown approval option: ${value}`);
    }
  }

  options.decision = String(options.decision || '').trim();
  if (options.decision !== 'approve' && options.decision !== 'reject') {
    throw new Error('approval decision must be approve or reject');
  }

  options.actor = String(options.actor || '').trim() || 'cli';
  options.reason = String(options.reason || '').trim();
  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  options.run_id = String(options.run_id || '').trim();

  return options;
}

function parseApprovalsArgs(values) {
  const options = { api: '' };
  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];
    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else {
      throw new Error(`unknown approvals option: ${value}`);
    }
  }
  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  return options;
}

function parseStatusArgs(values) {
  const options = {
    run_id: '',
    api: ''
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else if (!options.run_id) {
      options.run_id = value;
    } else {
      throw new Error(`unknown status option: ${value}`);
    }
  }

  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  options.run_id = String(options.run_id || '').trim();
  return options;
}

function parseProviderRouteArgs(values) {
  const options = {
    candidates: [],
    limit_state: {},
    rotation_intent: 'reliability',
    requested_model: ''
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--candidate' || value === '--provider' || value === '--provider-id') {
      options.candidates.push(next);
      index += 1;
    } else if (value.startsWith('--candidate=')) {
      options.candidates.push(value.slice('--candidate='.length));
    } else if (value.startsWith('--provider=')) {
      options.candidates.push(value.slice('--provider='.length));
    } else if (value === '--rotation-intent') {
      options.rotation_intent = next;
      index += 1;
    } else if (value.startsWith('--rotation-intent=')) {
      options.rotation_intent = value.slice('--rotation-intent='.length);
    } else if (value === '--limit-reached') {
      options.limit_state[String(next || '').trim()] = { limit_reached: true };
      index += 1;
    } else if (value.startsWith('--limit-reached=')) {
      options.limit_state[value.slice('--limit-reached='.length).trim()] = { limit_reached: true };
    } else if (value === '--model') {
      options.requested_model = next;
      index += 1;
    } else if (value.startsWith('--model=')) {
      options.requested_model = value.slice('--model='.length);
    } else {
      throw new Error(`unknown provider-route option: ${value}`);
    }
  }

  options.candidates = options.candidates.map(candidate => String(candidate || '').trim()).filter(Boolean);
  options.rotation_intent = String(options.rotation_intent || 'reliability').trim() || 'reliability';
  options.requested_model = String(options.requested_model || '').trim();
  for (const providerId of Object.keys(options.limit_state)) {
    if (!providerId) delete options.limit_state[providerId];
  }
  return options;
}

function parseProviderChatArgs(values) {
  const options = {
    provider_id: 'openrouter',
    base_url: '',
    messages: [],
    requested_model: '',
    max_completion_tokens: 0,
    max_output_tokens: 0,
    request_budget: {}
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--provider' || value === '--provider-id') {
      options.provider_id = next;
      index += 1;
    } else if (value.startsWith('--provider=')) {
      options.provider_id = value.slice('--provider='.length);
    } else if (value === '--base-url' || value === '--provider-base-url') {
      options.base_url = next;
      index += 1;
    } else if (value.startsWith('--base-url=')) {
      options.base_url = value.slice('--base-url='.length);
    } else if (value === '--message') {
      options.messages.push({ role: 'user', content: next });
      index += 1;
    } else if (value.startsWith('--message=')) {
      options.messages.push({ role: 'user', content: value.slice('--message='.length) });
    } else if (value === '--model') {
      options.requested_model = next;
      index += 1;
    } else if (value.startsWith('--model=')) {
      options.requested_model = value.slice('--model='.length);
    } else if (value === '--max-completion-tokens') {
      options.max_completion_tokens = next;
      index += 1;
    } else if (value.startsWith('--max-completion-tokens=')) {
      options.max_completion_tokens = value.slice('--max-completion-tokens='.length);
    } else if (value === '--max-output-tokens') {
      options.max_output_tokens = next;
      index += 1;
    } else if (value.startsWith('--max-output-tokens=')) {
      options.max_output_tokens = value.slice('--max-output-tokens='.length);
    } else if (value === '--max-prompt-chars') {
      options.request_budget.max_prompt_chars = next;
      index += 1;
    } else if (value.startsWith('--max-prompt-chars=')) {
      options.request_budget.max_prompt_chars = value.slice('--max-prompt-chars='.length);
    } else {
      throw new Error(`unknown provider-chat option: ${value}`);
    }
  }

  const candidate = {
    provider_id: String(options.provider_id || '').trim() || 'openrouter'
  };
  const baseUrl = String(options.base_url || '').trim();
  if (baseUrl) candidate.base_url = baseUrl;
  options.candidates = [candidate];
  options.messages = options.messages
    .map(message => ({ role: message.role, content: String(message.content || '') }))
    .filter(message => message.content);
  options.requested_model = String(options.requested_model || '').trim();
  options.max_completion_tokens = Number(options.max_completion_tokens || 0);
  options.max_output_tokens = Number(options.max_output_tokens || 0);
  options.request_budget.max_prompt_chars = Number(options.request_budget.max_prompt_chars || 0);
  return options;
}

function parseApprovalCommentArgs(values) {
  const options = {
    run_id: '',
    api: '',
    actor: 'cli',
    body: ''
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else if (value === '--actor') {
      options.actor = next;
      index += 1;
    } else if (value.startsWith('--actor=')) {
      options.actor = value.slice('--actor='.length);
    } else if (value === '--body' || value === '--comment') {
      options.body = next;
      index += 1;
    } else if (value.startsWith('--body=')) {
      options.body = value.slice('--body='.length);
    } else if (value.startsWith('--comment=')) {
      options.body = value.slice('--comment='.length);
    } else if (!options.run_id) {
      options.run_id = value;
    } else if (!options.body) {
      options.body = value;
    } else {
      throw new Error(`unknown approval comment option: ${value}`);
    }
  }

  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  options.actor = String(options.actor || '').trim() || 'cli';
  options.body = String(options.body || '').trim();
  options.run_id = String(options.run_id || '').trim();
  return options;
}

function parseApprovalRevisionArgs(values) {
  const options = {
    run_id: '',
    api: '',
    actor: 'cli',
    reason: '',
    requested_changes: []
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else if (value === '--actor') {
      options.actor = next;
      index += 1;
    } else if (value.startsWith('--actor=')) {
      options.actor = value.slice('--actor='.length);
    } else if (value === '--reason') {
      options.reason = next;
      index += 1;
    } else if (value.startsWith('--reason=')) {
      options.reason = value.slice('--reason='.length);
    } else if (value === '--change' || value === '--requested-change') {
      options.requested_changes.push(next);
      index += 1;
    } else if (value.startsWith('--change=')) {
      options.requested_changes.push(value.slice('--change='.length));
    } else if (value.startsWith('--requested-change=')) {
      options.requested_changes.push(value.slice('--requested-change='.length));
    } else if (!options.run_id) {
      options.run_id = value;
    } else {
      throw new Error(`unknown approval revision option: ${value}`);
    }
  }

  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  options.actor = String(options.actor || '').trim() || 'cli';
  options.reason = String(options.reason || '').trim();
  options.requested_changes = options.requested_changes.map(value => String(value || '').trim()).filter(Boolean);
  options.run_id = String(options.run_id || '').trim();
  return options;
}

function parseGoalCompleteArgs(values) {
  const options = {
    run_id: '',
    goal_id: '',
    api: '',
    verification_id: ''
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--api' || value === '--api-url') {
      options.api = next;
      index += 1;
    } else if (value.startsWith('--api=')) {
      options.api = value.slice('--api='.length);
    } else if (value === '--verification' || value === '--verification-id') {
      options.verification_id = next;
      index += 1;
    } else if (value.startsWith('--verification=')) {
      options.verification_id = value.slice('--verification='.length);
    } else if (value.startsWith('--verification-id=')) {
      options.verification_id = value.slice('--verification-id='.length);
    } else if (!options.run_id) {
      options.run_id = value;
    } else if (!options.goal_id) {
      options.goal_id = value;
    } else {
      throw new Error(`unknown goal-complete option: ${value}`);
    }
  }

  options.api = String(options.api || '').trim().replace(/\/+$/, '');
  options.run_id = String(options.run_id || '').trim();
  options.goal_id = String(options.goal_id || '').trim();
  options.verification_id = String(options.verification_id || '').trim();
  return options;
}

async function fetchJson(url, options = {}) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;
  const body = options.body || '';
  const headers = {
    'content-type': 'application/json',
    connection: 'close',
    ...(options.headers || {})
  };
  if (body) headers['content-length'] = Buffer.byteLength(body);

  return await new Promise((resolve, reject) => {
    const req = client.request(parsedUrl, {
      method: options.method || 'GET',
      headers,
      agent: false
    }, res => {
      let rawBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => rawBody += chunk);
      res.on('end', () => {
        let responseBody = {};
        try {
          responseBody = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          responseBody = { raw: rawBody };
        }
        resolve({
          response: {
            ok: res.statusCode >= 200 && res.statusCode < 300,
            status: res.statusCode
          },
          body: responseBody
        });
      });
    });

    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
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

function normalizedLlmProvider(source = {}) {
  const provider = {
    ...DEFAULT_CONFIG.llm_provider,
    ...source
  };
  const normalized = {
    provider_id: asScopeId(provider.provider_id, 'provider_id'),
    model: String(provider.model || '').trim()
  };
  const baseUrl = String(provider.base_url || '').trim();
  if (baseUrl) normalized.base_url = baseUrl;
  return normalized;
}

function normalizedToolsetConfig(source = {}) {
  return {
    enabled: Array.isArray(source.enabled) ? source.enabled.map(value => String(value || '').trim()).filter(Boolean) : [...DEFAULT_CONFIG.toolsets.enabled],
    disabled: Array.isArray(source.disabled) ? source.disabled.map(value => String(value || '').trim()).filter(Boolean) : [...DEFAULT_CONFIG.toolsets.disabled]
  };
}

function taskWithRuntimeConfig(task, config = DEFAULT_CONFIG) {
  const llmProvider = normalizedLlmProvider(task.llm_provider || config.llm_provider || DEFAULT_CONFIG.llm_provider);
  const toolsets = normalizedToolsetConfig(task.toolsets || config.toolsets || DEFAULT_CONFIG.toolsets);
  const providerRuntime = resolveProviderRuntime({
    provider_id: llmProvider.provider_id,
    model: llmProvider.model,
    base_url: llmProvider.base_url
  });
  const toolsetResolution = resolveToolsets({
    enabled_toolsets: toolsets.enabled,
    disabled_toolsets: toolsets.disabled,
    provider_runtime: providerRuntime
  });

  return {
    ...task,
    llm_provider: llmProvider,
    toolsets,
    provider_runtime: providerRuntime,
    toolset_resolution: toolsetResolution
  };
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

  const llmProvider = normalizedLlmProvider({
    provider_id: options.provider_id,
    model: options.model,
    base_url: options.base_url
  });
  const toolsets = normalizedToolsetConfig({
    enabled: options.enabled_toolsets,
    disabled: options.disabled_toolsets
  });

  resolveProviderRuntime({
    provider_id: llmProvider.provider_id,
    model: llmProvider.model,
    base_url: llmProvider.base_url,
    env: {}
  });
  resolveToolsets({
    enabled_toolsets: toolsets.enabled,
    disabled_toolsets: toolsets.disabled
  });

  return {
    policy_id: options.policy_id,
    budget: {
      soft_limit_usd: softLimit,
      hard_limit_usd: hardLimit
    },
    scope: {
      org_id: asScopeId(options.org_id, 'org_id'),
      project_id: asScopeId(options.project_id, 'project_id')
    },
    llm_provider: llmProvider,
    toolsets
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
    process.stderr.write(`LLM provider [${options.provider_id}]: `);
    process.stderr.write(`LLM model [${options.model}]: `);
    process.stderr.write(`Provider base URL [${options.base_url || '(default)'}]: `);
    process.stderr.write(`Enabled toolsets [${options.enabled_toolsets.join(',')}]: `);
    process.stderr.write(`Disabled toolsets [${options.disabled_toolsets.join(',')}]: `);
    const [policy = '', soft = '', hard = '', org = '', project = '', provider = '', model = '', baseUrl = '', enabledToolsets = '', disabledToolsets = ''] = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd,
      org_id: org.trim() || options.org_id,
      project_id: project.trim() || options.project_id,
      provider_id: provider.trim() || options.provider_id,
      model: model.trim() || options.model,
      base_url: baseUrl.trim() || options.base_url,
      enabled_toolsets: enabledToolsets.trim() ? commaList(enabledToolsets) : options.enabled_toolsets,
      disabled_toolsets: disabledToolsets.trim() ? commaList(disabledToolsets) : options.disabled_toolsets
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
    const provider = await rl.question(`LLM provider [${options.provider_id}]: `);
    const model = await rl.question(`LLM model [${options.model}]: `);
    const baseUrl = await rl.question(`Provider base URL [${options.base_url || '(default)'}]: `);
    const enabledToolsets = await rl.question(`Enabled toolsets [${options.enabled_toolsets.join(',')}]: `);
    const disabledToolsets = await rl.question(`Disabled toolsets [${options.disabled_toolsets.join(',')}]: `);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd,
      org_id: org.trim() || options.org_id,
      project_id: project.trim() || options.project_id,
      provider_id: provider.trim() || options.provider_id,
      model: model.trim() || options.model,
      base_url: baseUrl.trim() || options.base_url,
      enabled_toolsets: enabledToolsets.trim() ? commaList(enabledToolsets) : options.enabled_toolsets,
      disabled_toolsets: disabledToolsets.trim() ? commaList(disabledToolsets) : options.disabled_toolsets
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
  const payload = taskWithRuntimeConfig({
    task_id: `task_${Date.now()}`,
    objective: parsedArgs.objective,
    success_criteria: parsedArgs.success_criteria,
    repo: cwd,
    scope: config.scope || DEFAULT_CONFIG.scope,
    policy_id: config.policy_id,
    budget: config.budget,
    connector_references: parsedArgs.connector_references,
    created_at: new Date().toISOString()
  }, config);
  const policy_pack = resolvePolicyPackForTask(payload);
  const preflight = evaluatePreflight({ task: payload, policyPack: policy_pack });
  const run_id = `run_${Date.now()}`;
  const status = preflight.run_status;
  const budget_incidents = createBudgetIncidents({
    run_id,
    task: payload,
    preflight,
    source: 'preflight',
    created_at: payload.created_at
  });
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
  const goals = createGoalRecords({
    run_id,
    task: payload,
    preflight,
    status,
    created_at: payload.created_at
  });

  print({
    ok: true,
    command: 'run',
    run_id,
    status,
    preflight,
    budget_incidents,
    policy_pack,
    orchestration: createOrchestrationTrace({ run_id, task: payload, status, preflight }),
    connector_references,
    agent_activity,
    goals,
    memory: createRunMemoryEntries({ run_id, task: payload, preflight, recorded_at: payload.created_at }),
    artifacts: createRunArtifacts({ run_id, task: payload, status, preflight }).map(publicArtifactMetadata),
    events: createInitialRunEvents({ run_id, task: payload, preflight, status }),
    task: payload
  });
}

async function status() {
  try {
    const options = parseStatusArgs(args);
    if (!options.api) {
      print({ ok: true, command: 'status', status: 'queued' });
      return;
    }
    if (!options.run_id) {
      throw new Error('status requires a run_id when --api is supplied');
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}`);
    print({
      ok: response.ok,
      command: 'status',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      status: body.status,
      run: body,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'status', error: error.message });
    process.exitCode = 1;
  }
}

function localApprovalPayload(options, commandName) {
  const approval = {
    decision: options.decision,
    actor: options.actor,
    reason: options.reason,
    decided_at: new Date().toISOString()
  };
  const status = options.decision === 'approve' ? 'queued' : 'failed';

  return {
    ok: true,
    command: commandName,
    run_id: options.run_id,
    status,
    approval
  };
}

function localApprovalRevisionPayload(options) {
  const revision = createApprovalRevision({
    run_id: options.run_id,
    actor: options.actor,
    reason: options.reason,
    requested_changes: options.requested_changes
  });

  return {
    ok: true,
    command: 'approval-revision',
    run_id: options.run_id,
    status: 'paused',
    revision
  };
}

function localApprovalResubmitPayload(options) {
  const requested = createApprovalRevision({
    run_id: options.run_id,
    actor: options.actor,
    reason: options.reason || 'Resubmission requested',
    requested_changes: []
  });
  const revision = resubmitApprovalRevision(requested, {
    actor: options.actor,
    reason: options.reason
  });

  return {
    ok: true,
    command: 'approval-resubmit',
    run_id: options.run_id,
    status: 'awaiting_approval',
    revision
  };
}

async function approvals() {
  try {
    const options = parseApprovalsArgs(args);
    if (!options.api) {
      print({
        ok: true,
        command: 'approvals',
        runs: [],
        note: 'pass --api <url> to read the API approval queue'
      });
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/approvals`);
    print({
      ok: response.ok,
      command: 'approvals',
      api: options.api,
      status_code: response.status,
      runs: body.runs || [],
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approvals', error: error.message });
    process.exitCode = 1;
  }
}

async function approve(commandName = 'approve', defaultDecision = 'approve') {
  try {
    const options = parseApprovalArgs(args, defaultDecision);
    if (!options.run_id && !options.api && commandName === 'approve') {
      print({ ok: true, command: 'approve', status: 'approved' });
      return;
    }
    if (!options.run_id) {
      throw new Error(`${commandName} requires a run_id`);
    }
    if (!options.api) {
      print(localApprovalPayload(options, commandName));
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval`, {
      method: 'POST',
      body: JSON.stringify({
        decision: options.decision,
        actor: options.actor,
        reason: options.reason
      })
    });
    print({
      ok: response.ok,
      command: commandName,
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      status: body.status,
      approval: body.approval,
      run: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: commandName, error: error.message });
    process.exitCode = 1;
  }
}

async function approvalComment() {
  try {
    const options = parseApprovalCommentArgs(args);
    if (!options.run_id) {
      throw new Error('approval-comment requires a run_id');
    }

    if (!options.api) {
      const comment = createApprovalComment({
        run_id: options.run_id,
        actor: options.actor,
        body: options.body,
        index: 1
      });
      print({ ok: true, command: 'approval-comment', run_id: options.run_id, comment });
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval/comments`, {
      method: 'POST',
      body: JSON.stringify({
        actor: options.actor,
        body: options.body
      })
    });
    print({
      ok: response.ok,
      command: 'approval-comment',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      comment: body.comment,
      run: body.run,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approval-comment', error: error.message });
    process.exitCode = 1;
  }
}

async function approvalComments() {
  try {
    const options = parseApprovalCommentArgs(args);
    if (!options.run_id) {
      throw new Error('approval-comments requires a run_id');
    }
    if (!options.api) {
      print({
        ok: true,
        command: 'approval-comments',
        run_id: options.run_id,
        comments: [],
        note: 'pass --api <url> to read API approval comments'
      });
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval/comments`);
    print({
      ok: response.ok,
      command: 'approval-comments',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      comments: body.comments || [],
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approval-comments', error: error.message });
    process.exitCode = 1;
  }
}

async function approvalRevision() {
  try {
    const options = parseApprovalRevisionArgs(args);
    if (!options.run_id) {
      throw new Error('approval-revision requires a run_id');
    }

    if (!options.api) {
      print(localApprovalRevisionPayload(options));
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval/revision`, {
      method: 'POST',
      body: JSON.stringify({
        actor: options.actor,
        reason: options.reason,
        requested_changes: options.requested_changes
      })
    });
    print({
      ok: response.ok,
      command: 'approval-revision',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      status: body.status,
      revision: body.approval_revision || null,
      run: body,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approval-revision', error: error.message });
    process.exitCode = 1;
  }
}

async function approvalResubmit() {
  try {
    const options = parseApprovalRevisionArgs(args);
    if (!options.run_id) {
      throw new Error('approval-resubmit requires a run_id');
    }

    if (!options.api) {
      print(localApprovalResubmitPayload(options));
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval/resubmit`, {
      method: 'POST',
      body: JSON.stringify({
        actor: options.actor,
        reason: options.reason
      })
    });
    print({
      ok: response.ok,
      command: 'approval-resubmit',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      status: body.status,
      revision: body.approval_revision || null,
      run: body,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approval-resubmit', error: error.message });
    process.exitCode = 1;
  }
}

async function approval() {
  try {
    const options = parseStatusArgs(args);
    if (!options.run_id) {
      throw new Error('approval requires a run_id');
    }

    if (!options.api) {
      print({
        ok: true,
        command: 'approval',
        run_id: options.run_id,
        approval: null,
        comments: [],
        note: 'pass --api <url> to read API approval state'
      });
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/approval`);
    print({
      ok: response.ok,
      command: 'approval',
      api: options.api,
      run_id: options.run_id,
      status_code: response.status,
      status: body.status,
      approval_required: Boolean(body.approval_required),
      approval: body.approval || null,
      revision: body.revision || null,
      comments: body.comments || [],
      run: body.run,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'approval', error: error.message });
    process.exitCode = 1;
  }
}

async function goalComplete() {
  try {
    const options = parseGoalCompleteArgs(args);
    if (!options.run_id) {
      throw new Error('goal-complete requires a run_id');
    }
    if (!options.goal_id) {
      throw new Error('goal-complete requires a goal_id');
    }
    if (!options.verification_id) {
      throw new Error('goal-complete requires --verification <verification_id>');
    }

    if (!options.api) {
      const goal = completeGoalRecord({
        goal_id: options.goal_id,
        run_id: options.run_id,
        status: 'pending',
        completion_evidence_refs: []
      }, {
        verification: {
          verification_id: options.verification_id,
          result: 'passed'
        }
      });
      print({
        ok: true,
        command: 'goal-complete',
        run_id: options.run_id,
        goal_id: options.goal_id,
        status: goal.status,
        goal
      });
      return;
    }

    const { response, body } = await fetchJson(`${options.api}/runs/${options.run_id}/goals/${options.goal_id}/complete`, {
      method: 'POST',
      body: JSON.stringify({ verification_id: options.verification_id })
    });
    print({
      ok: response.ok,
      command: 'goal-complete',
      api: options.api,
      run_id: options.run_id,
      goal_id: options.goal_id,
      status_code: response.status,
      status: body.goal?.status,
      goal: body.goal,
      run: body.run,
      response: body
    });
    if (!response.ok) process.exitCode = 1;
  } catch (error) {
    print({ ok: false, command: 'goal-complete', error: error.message });
    process.exitCode = 1;
  }
}

function recipes() {
  print({ ok: true, command: 'recipes', recipes: publicStarterRecipes() });
}

function capabilities() {
  print({ ok: true, command: 'capabilities', catalog: createCapabilitiesCatalog() });
}

function providers() {
  print({ ok: true, command: 'providers', llm_providers: publicLlmProviders() });
}

function providerRoute() {
  try {
    const options = parseProviderRouteArgs(args);
    const route = planProviderProxyRoute(options);
    print({ ok: route.status === 'ready', command: 'provider-route', route });
  } catch (error) {
    print({ ok: false, command: 'provider-route', error: error.message });
  }
}

async function providerChat() {
  try {
    const options = parseProviderChatArgs(args);
    const result = await executeProviderProxyChat(options);
    print({ ok: result.status === 'completed', command: 'provider-chat', result });
  } catch (error) {
    print({ ok: false, command: 'provider-chat', error: error.message });
  }
}

function toolsets() {
  print({ ok: true, command: 'toolsets', toolsets: publicToolsets(), resolution: resolveToolsets() });
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
  case 'status': await status(); break;
  case 'approvals': await approvals(); break;
  case 'approval': await approval(); break;
  case 'approve': await approve('approve', 'approve'); break;
  case 'reject': await approve('reject', 'reject'); break;
  case 'approval-comment': await approvalComment(); break;
  case 'approval-comments': await approvalComments(); break;
  case 'approval-revision': await approvalRevision(); break;
  case 'approval-resubmit': await approvalResubmit(); break;
  case 'goal-complete': await goalComplete(); break;
  case 'capabilities': capabilities(); break;
  case 'providers': providers(); break;
  case 'provider-route': providerRoute(); break;
  case 'provider-chat': await providerChat(); break;
  case 'toolsets': toolsets(); break;
  case 'recipes': recipes(); break;
  case 'doctor': doctor(); break;
  case 'bug': bug(); break;
  default:
    print({
      ok: false,
      usage: 'divinity <init|run|status|approvals|approval|approve|reject|approval-comment|approval-comments|approval-revision|approval-resubmit|goal-complete|capabilities|providers|provider-route|provider-chat|toolsets|recipes|doctor|bug> [args]'
    });
}
