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
assert.equal(result.ok, result.checks.every(check => check.ok));

const checksById = new Map(result.checks.map(check => [check.check_id, check]));
for (const checkId of ['node', 'npm', 'git', 'package_json', 'api_server_source']) {
  assert.ok(checksById.has(checkId), `missing diagnostic check: ${checkId}`);
  assert.equal(typeof checksById.get(checkId).ok, 'boolean');
  assert.equal(typeof checksById.get(checkId).required, 'boolean');
  assert.equal(typeof checksById.get(checkId).summary, 'string');
}

assert.equal(checksById.get('node').ok, true);
assert.match(checksById.get('node').summary, /^v\d+\./);
assert.equal(checksById.get('package_json').ok, true);
assert.equal(checksById.get('api_server_source').ok, true);

console.log(JSON.stringify({ ok: true, test: 'cli-doctor' }));
