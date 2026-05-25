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

const result = runCli('doctor');
assert.equal(result.command, 'doctor');
assert.equal(typeof result.ok, 'boolean');
assert.ok(Array.isArray(result.checks));
assert.equal(result.ok, result.checks.every(check => !check.required || check.ok));

const checksById = new Map(result.checks.map(check => [check.check_id, check]));
for (const checkId of [
  'node',
  'npm',
  'pnpm',
  'package_manager',
  'docker',
  'git',
  'package_json',
  'node_modules',
  'ajv_dependencies',
  'api_server_source'
]) {
  assert.ok(checksById.has(checkId), `missing diagnostic check: ${checkId}`);
  assert.equal(typeof checksById.get(checkId).ok, 'boolean');
  assert.equal(typeof checksById.get(checkId).required, 'boolean');
  assert.equal(typeof checksById.get(checkId).summary, 'string');
}

assert.equal(checksById.get('node').ok, true);
assert.match(checksById.get('node').summary, /^v\d+\./);
assert.equal(checksById.get('npm').required, false);
assert.equal(checksById.get('pnpm').required, false);
assert.equal(checksById.get('docker').required, false);
assert.equal(checksById.get('package_manager').required, true);
assert.equal(checksById.get('node_modules').ok, true);
assert.equal(checksById.get('ajv_dependencies').ok, true);
assert.match(checksById.get('package_manager').summary, /(npm|pnpm)/);
assert.match(checksById.get('ajv_dependencies').summary, /ajv/);
assert.equal(checksById.get('package_json').ok, true);
assert.equal(checksById.get('api_server_source').ok, true);

console.log(JSON.stringify({ ok: true, test: 'cli-doctor' }));
