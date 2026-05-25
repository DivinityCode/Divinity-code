import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';

function runCli(...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        OPENROUTER_API_KEY: 'openrouter-secret',
        GROQ_API_KEY: 'groq-secret'
      }
    }
  );
  return JSON.parse(output);
}

const route = runCli('provider-route', '--candidate', 'openrouter', '--candidate', 'groq');
assert.equal(route.ok, true);
assert.equal(route.command, 'provider-route');
assert.equal(route.route.format, 'divinity.provider_proxy_route.v1');
assert.equal(route.route.status, 'ready');
assert.equal(route.route.selected_provider_runtime.provider_id, 'openrouter');
assert.equal(JSON.stringify(route).includes('openrouter-secret'), false);

const blocked = runCli('provider-route', '--candidate', 'openrouter', '--rotation-intent', 'bypass_limits');
assert.equal(blocked.ok, false);
assert.equal(blocked.route.status, 'blocked');
assert.match(blocked.route.error, /limit bypass/);

console.log(JSON.stringify({ ok: true, test: 'cli-provider-proxy' }));
