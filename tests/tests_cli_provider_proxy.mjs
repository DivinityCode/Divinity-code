import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import os from 'os';
import path from 'path';

function runCli(args, env = {}) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'openrouter-secret',
        GROQ_API_KEY: 'groq-secret',
        ...env
      }
    }
  );
  return JSON.parse(output);
}

const route = runCli(['provider-route', '--candidate', 'openrouter', '--candidate', 'groq']);
assert.equal(route.ok, true);
assert.equal(route.command, 'provider-route');
assert.equal(route.route.format, 'divinity.provider_proxy_route.v1');
assert.equal(route.route.status, 'ready');
assert.equal(route.route.selected_provider_runtime.provider_id, 'openrouter');
assert.equal(JSON.stringify(route).includes('openrouter-secret'), false);

const tmpDir = mkdtempSync(path.join(os.tmpdir(), 'divinity-provider-ledger-'));
try {
  const ledgerPath = path.join(tmpDir, 'provider-limits.json');
  writeFileSync(ledgerPath, JSON.stringify({
    format: 'divinity.provider_limit_ledger.v1',
    providers: {
      openrouter: {
        provider_id: 'openrouter',
        observed_at: '2099-01-01T00:00:00.000Z',
        limited_until: '2099-01-01T00:01:00.000Z',
        retry_after_seconds: 60,
        source: 'upstream_429'
      }
    }
  }));

  const ledgerRoute = runCli(
    ['provider-route', '--candidate', 'openrouter', '--candidate', 'groq'],
    { DIVINITY_PROVIDER_LIMIT_LEDGER_PATH: ledgerPath }
  );

  assert.equal(ledgerRoute.ok, true);
  assert.equal(ledgerRoute.route.status, 'ready');
  assert.equal(ledgerRoute.route.selected_provider_runtime.provider_id, 'groq');
  assert.equal(ledgerRoute.route.candidate_results[0].status, 'limited');
  assert.equal(ledgerRoute.route.candidate_results[0].retry_after_seconds > 0, true);
  assert.equal(JSON.stringify(ledgerRoute).includes('openrouter-secret'), false);
  assert.equal(JSON.stringify(ledgerRoute).includes('groq-secret'), false);
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}

const blocked = runCli(['provider-route', '--candidate', 'openrouter', '--rotation-intent', 'bypass_limits']);
assert.equal(blocked.ok, false);
assert.equal(blocked.route.status, 'blocked');
assert.match(blocked.route.error, /limit bypass/);

console.log(JSON.stringify({ ok: true, test: 'cli-provider-proxy' }));
