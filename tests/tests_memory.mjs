import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { createRunMemoryEntries } from '../packages/memory/src/index.mjs';

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

function assertMemoryEntries(entries) {
  assert.ok(Array.isArray(entries));
  assert.deepEqual(entries.map(entry => entry.scope.level), ['session', 'project', 'team']);
  for (const entry of entries) {
    assert.match(entry.memory_id, /^mem_[a-f0-9]{16}$/);
    assert.equal(typeof entry.fact, 'string');
    assert.equal(typeof entry.scope.id, 'string');
    assert.equal(typeof entry.provenance.source, 'string');
    assert.match(entry.provenance.recorded_at, /^\d{4}-\d{2}-\d{2}T/);
    assert.ok(entry.confidence > 0 && entry.confidence <= 1);
  }
}

const task = {
  task_id: 'task_memory',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

const entries = createRunMemoryEntries({
  run_id: 'run_memory',
  task,
  preflight: { decision: 'allow', risk_level: 'low' },
  recorded_at: '2026-05-24T00:01:00Z'
});
assertMemoryEntries(entries);
assert.equal(entries[0].scope.id, 'run_memory');
assert.equal(entries[1].scope.id, 'acme/platform');
assert.equal(entries[2].scope.id, 'acme');

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-memory-test-'));
try {
  runCli(tmpDir, 'init', '--org', 'acme', '--project', 'platform');
  const cliRun = runCli(tmpDir, 'run', 'Read the repository README');
  assertMemoryEntries(cliRun.memory);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });
  assert.equal(response.status, 201);
  assertMemoryEntries(run.memory);

  console.log(JSON.stringify({ ok: true, test: 'memory' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
