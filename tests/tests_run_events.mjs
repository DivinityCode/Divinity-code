import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunEvent } from '../packages/events/src/index.mjs';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  const body = await response.json();
  return { response, body };
}

{
  const event = createRunEvent({
    run_id: 'run_123',
    type: 'status_changed',
    status: 'awaiting_approval',
    message: 'Run is waiting for operator approval',
    metadata: { risk_level: 'high' },
    created_at: '2026-05-24T00:00:00Z'
  });

  assert.match(event.event_id, /^evt_/);
  assert.equal(event.run_id, 'run_123');
  assert.equal(event.type, 'status_changed');
  assert.equal(event.status, 'awaiting_approval');
  assert.equal(event.metadata.risk_level, 'high');
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-events-test-'));
try {
  runCli(tmpDir, 'init');
  const cliRun = runCli(tmpDir, 'run', 'Run a migration shell command');
  assert.equal(cliRun.events.length, 3);
  assert.deepEqual(cliRun.events.map(event => event.type), [
    'task_created',
    'preflight_completed',
    'status_changed'
  ]);
  assert.equal(cliRun.events[2].status, 'awaiting_approval');
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

const highRiskTask = {
  task_id: 'task_events_123',
  objective: 'Run a migration shell command',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(highRiskTask)
  });

  const { response: eventsRes, body: timeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.equal(eventsRes.status, 200);
  assert.equal(timeline.run_id, run.run_id);
  assert.deepEqual(timeline.events.map(event => event.type), [
    'task_created',
    'preflight_completed',
    'status_changed'
  ]);
  assert.equal(timeline.events[2].status, 'awaiting_approval');

  await requestJson(`${baseUrl}/runs/${run.run_id}/approval`, {
    method: 'POST',
    body: JSON.stringify({ decision: 'approve', actor: 'operator@example.com' })
  });

  const { body: updatedTimeline } = await requestJson(`${baseUrl}/runs/${run.run_id}/events`);
  assert.deepEqual(updatedTimeline.events.map(event => event.type), [
    'task_created',
    'preflight_completed',
    'status_changed',
    'approval_decided',
    'status_changed'
  ]);
  assert.equal(updatedTimeline.events[4].status, 'queued');

  console.log(JSON.stringify({ ok: true, test: 'run-events' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
