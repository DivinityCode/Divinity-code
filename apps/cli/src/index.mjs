#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

import { evaluatePreflight } from '../../../packages/policy-engine/src/index.mjs';

const [, , command, ...args] = process.argv;
const cwd = process.cwd();
const configPath = path.join(cwd, '.divinity.json');

function print(obj) {
  process.stdout.write(`${JSON.stringify(obj, null, 2)}\n`);
}

function init() {
  const config = {
    policy_id: 'safe_exec',
    budget: { soft_limit_usd: 2, hard_limit_usd: 5 }
  };
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  print({ ok: true, command: 'init', config_path: configPath });
}

function run() {
  const objective = args.join(' ').trim() || 'No objective provided';
  const config = fs.existsSync(configPath)
    ? JSON.parse(fs.readFileSync(configPath, 'utf8'))
    : {
        policy_id: 'safe_exec',
        budget: { soft_limit_usd: 2, hard_limit_usd: 5 }
      };
  const payload = {
    task_id: `task_${Date.now()}`,
    objective,
    repo: cwd,
    policy_id: config.policy_id,
    budget: config.budget,
    created_at: new Date().toISOString()
  };
  const preflight = evaluatePreflight({ task: payload });
  const status = preflight.decision === 'requires_approval'
    ? 'awaiting_approval'
    : preflight.decision === 'block'
      ? 'failed'
      : 'queued';

  print({
    ok: true,
    command: 'run',
    run_id: `run_${Date.now()}`,
    status,
    preflight,
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
  case 'init': init(); break;
  case 'run': run(); break;
  case 'status': status(); break;
  case 'approve': approve(); break;
  default:
    print({
      ok: false,
      usage: 'divinity <init|run|status|approve> [args]'
    });
}
