import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { TEAM_POLICY_PACKS, resolvePolicyPackForTask } from './packages/policy-packs/src/index.mjs';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

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

function assertPolicyPack(pack) {
  assert.match(pack.pack_id, /^team_policy_/);
  assert.equal(typeof pack.name, 'string');
  assert.equal(typeof pack.scope.org_id, 'string');
  assert.equal(typeof pack.default_policy_id, 'string');
  assert.equal(typeof pack.approval_threshold, 'string');
  assert.equal(typeof pack.budget_defaults.soft_limit_usd, 'number');
  assert.equal(typeof pack.budget_defaults.hard_limit_usd, 'number');
}

assert.ok(TEAM_POLICY_PACKS.length >= 2);
for (const pack of TEAM_POLICY_PACKS) assertPolicyPack(pack);

assert.equal(resolvePolicyPackForTask({ scope: { org_id: 'default-org' } }).pack_id, 'team_policy_starter');
assert.equal(resolvePolicyPackForTask({ scope: { org_id: 'regulated-org' } }).pack_id, 'team_policy_regulated');
assert.equal(resolvePolicyPackForTask({ scope: { org_id: 'unknown-org' } }).pack_id, 'team_policy_starter');

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-policy-packs-test-'));
try {
  runCli(tmpDir, 'init');
  const cliRun = runCli(tmpDir, 'run', 'Read the repository README');
  assert.equal(cliRun.policy_pack.pack_id, 'team_policy_starter');
  assertPolicyPack(cliRun.policy_pack);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify({
      task_id: 'task_policy_pack',
      objective: 'Read the repository README',
      repo: 'github.com/org/repo',
      scope: { org_id: 'regulated-org', project_id: 'platform' },
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert.equal(response.status, 201);
  assert.equal(run.policy_pack.pack_id, 'team_policy_regulated');
  assertPolicyPack(run.policy_pack);

  console.log(JSON.stringify({ ok: true, test: 'policy-packs' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
