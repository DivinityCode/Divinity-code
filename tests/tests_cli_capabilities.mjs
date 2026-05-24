import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import path from 'path';

function runCli(...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: process.cwd(), encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const result = runCli('capabilities');

assert.equal(result.ok, true);
assert.equal(result.command, 'capabilities');
assert.equal(result.catalog.format, 'divinity.capabilities.v1');
assert.ok(result.catalog.policies.some(policy => policy.policy_id === 'safe_exec'));
assert.ok(result.catalog.execution_adapters.some(adapter => adapter.adapter === 'package_script'));
assert.ok(result.catalog.starter_recipes.length >= 4);

console.log(JSON.stringify({ ok: true, test: 'cli-capabilities' }));
