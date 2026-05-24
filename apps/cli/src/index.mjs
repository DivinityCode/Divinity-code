#!/usr/bin/env node
import fs from 'fs';
import path from 'path';

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
  const payload = {
    task_id: `task_${Date.now()}`,
    objective,
    repo: cwd,
    policy_id: 'safe_exec',
    budget: { soft_limit_usd: 2, hard_limit_usd: 5 },
    created_at: new Date().toISOString()
  };
  print({ ok: true, command: 'run', status: 'queued', task: payload });
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
