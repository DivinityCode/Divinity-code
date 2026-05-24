#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { createInterface } from 'readline/promises';

import { createRunArtifacts, publicArtifactMetadata } from '../../../packages/artifacts/src/index.mjs';
import { createInitialRunEvents } from '../../../packages/events/src/index.mjs';
import { evaluatePreflight, POLICY_PRESETS } from '../../../packages/policy-engine/src/index.mjs';

const [, , command, ...args] = process.argv;
const cwd = process.cwd();
const configPath = path.join(cwd, '.divinity.json');
const DEFAULT_CONFIG = {
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2, hard_limit_usd: 5 }
};
const POLICY_IDS = Object.keys(POLICY_PRESETS);

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function parseInitArgs(values) {
  const options = {
    wizard: false,
    policy_id: DEFAULT_CONFIG.policy_id,
    soft_limit_usd: DEFAULT_CONFIG.budget.soft_limit_usd,
    hard_limit_usd: DEFAULT_CONFIG.budget.hard_limit_usd
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
    } else {
      throw new Error(`unknown init option: ${value}`);
    }
  }

  return options;
}

function asBudgetNumber(value, label) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${label} must be a non-negative number`);
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
    }
  };
}

async function askForConfig(options) {
  if (!process.stdin.isTTY) {
    process.stderr.write(`Policy presets: ${POLICY_IDS.join(', ')}\n`);
    process.stderr.write(`Policy preset [${options.policy_id}]: `);
    process.stderr.write(`Soft budget USD [${options.soft_limit_usd}]: `);
    process.stderr.write(`Hard budget USD [${options.hard_limit_usd}]: `);
    const [policy = '', soft = '', hard = ''] = fs.readFileSync(0, 'utf8').split(/\r?\n/);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd
    };
  }

  const rl = createInterface({ input: process.stdin, output: process.stderr });
  try {
    process.stderr.write(`Policy presets: ${POLICY_IDS.join(', ')}\n`);
    const policy = await rl.question(`Policy preset [${options.policy_id}]: `);
    const soft = await rl.question(`Soft budget USD [${options.soft_limit_usd}]: `);
    const hard = await rl.question(`Hard budget USD [${options.hard_limit_usd}]: `);
    return {
      ...options,
      policy_id: policy.trim() || options.policy_id,
      soft_limit_usd: soft.trim() || options.soft_limit_usd,
      hard_limit_usd: hard.trim() || options.hard_limit_usd
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
    print({ ok: true, command: 'init', config_path: configPath, config });
  } catch (error) {
    print({ ok: false, command: 'init', error: error.message });
    process.exitCode = 1;
  }
}

function run() {
  const objective = args.join(' ').trim() || 'No objective provided';
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : DEFAULT_CONFIG;
  const payload = {
    task_id: `task_${Date.now()}`,
    objective,
    repo: cwd,
    policy_id: config.policy_id,
    budget: config.budget,
    created_at: new Date().toISOString()
  };
  const preflight = evaluatePreflight({ task: payload });
  const run_id = `run_${Date.now()}`;
  const status = preflight.run_status;

  print({
    ok: true,
    command: 'run',
    run_id,
    status,
    preflight,
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

switch (command) {
  case 'init': await init(); break;
  case 'run': run(); break;
  case 'status': status(); break;
  case 'approve': approve(); break;
  default:
    print({
      ok: false,
      usage: 'divinity <init|run|status|approve> [args]'
    });
}
