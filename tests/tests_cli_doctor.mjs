import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const cliPath = path.resolve('apps/cli/src/index.mjs');

function runCli(args = [], options = {}) {
  const output = execFileSync(
    process.execPath,
    [cliPath, ...args],
    { cwd: options.cwd || process.cwd(), encoding: 'utf8' }
  );
  return JSON.parse(output);
}

function checksById(result) {
  return new Map(result.checks.map(check => [check.check_id, check]));
}

function assertRequiredChecks(result, checkIds) {
  const checks = checksById(result);
  for (const checkId of checkIds) {
    assert.ok(checks.has(checkId), `missing diagnostic check: ${checkId}`);
    assert.equal(typeof checks.get(checkId).ok, 'boolean');
    assert.equal(typeof checks.get(checkId).required, 'boolean');
    assert.equal(typeof checks.get(checkId).summary, 'string');
  }
  return checks;
}

const runtimeCwd = mkdtempSync(path.join(tmpdir(), 'divinity-doctor-runtime-'));
const result = runCli(['doctor'], { cwd: runtimeCwd });
assert.equal(result.command, 'doctor');
assert.equal(result.profile, 'runtime');
assert.equal(typeof result.ok, 'boolean');
assert.ok(Array.isArray(result.checks));
assert.equal(result.ok, result.checks.every(check => !check.required || check.ok));

const runtimeChecksById = assertRequiredChecks(result, [
  'node',
  'npm',
  'pnpm',
  'package_manager',
  'docker',
  'git',
  'cli_entrypoint',
  'provider_catalog',
  'provider_secret_store_backends',
  'toolset_catalog',
  'llm_provider_credentials'
]);

for (const sourceOnlyCheckId of [
  'package_json',
  'node_modules',
  'ajv_dependencies',
  'api_server_source'
]) {
  assert.equal(runtimeChecksById.has(sourceOnlyCheckId), false, `${sourceOnlyCheckId} must be source-profile only`);
}

assert.equal(runtimeChecksById.get('node').ok, true);
assert.match(runtimeChecksById.get('node').summary, /^v\d+\./);
assert.equal(runtimeChecksById.get('npm').required, false);
assert.equal(runtimeChecksById.get('pnpm').required, false);
assert.equal(runtimeChecksById.get('docker').required, false);
assert.equal(runtimeChecksById.get('llm_provider_credentials').required, false);
assert.equal(runtimeChecksById.get('package_manager').required, true);
assert.equal(runtimeChecksById.get('provider_catalog').required, true);
assert.equal(runtimeChecksById.get('provider_secret_store_backends').required, true);
assert.equal(runtimeChecksById.get('toolset_catalog').required, true);
assert.equal(runtimeChecksById.get('cli_entrypoint').required, true);
assert.equal(runtimeChecksById.get('cli_entrypoint').ok, true);
assert.match(runtimeChecksById.get('cli_entrypoint').summary, /apps\/cli\/src\/index\.mjs/);
assert.match(runtimeChecksById.get('package_manager').summary, /(npm|pnpm)/);
assert.match(runtimeChecksById.get('provider_catalog').summary, /providers/);
assert.match(runtimeChecksById.get('provider_secret_store_backends').summary, /hashicorp_vault/);
assert.match(runtimeChecksById.get('provider_secret_store_backends').summary, /production backends/);
assert.match(runtimeChecksById.get('toolset_catalog').summary, /toolsets/);
assert.match(runtimeChecksById.get('llm_provider_credentials').summary, /(configured|not configured)/);

const sourceResult = runCli(['doctor', '--profile', 'source']);
assert.equal(sourceResult.command, 'doctor');
assert.equal(sourceResult.profile, 'source');
assert.equal(sourceResult.ok, sourceResult.checks.every(check => !check.required || check.ok));

const sourceChecksById = assertRequiredChecks(sourceResult, [
  'node',
  'npm',
  'pnpm',
  'package_manager',
  'docker',
  'git',
  'cli_entrypoint',
  'provider_catalog',
  'provider_secret_store_backends',
  'toolset_catalog',
  'llm_provider_credentials',
  'package_json',
  'node_modules',
  'ajv_dependencies',
  'api_server_source'
]);

assert.equal(sourceChecksById.get('node_modules').ok, true);
assert.equal(sourceChecksById.get('ajv_dependencies').ok, true);
assert.match(sourceChecksById.get('ajv_dependencies').summary, /ajv/);
assert.equal(sourceChecksById.get('package_json').ok, true);
assert.equal(sourceChecksById.get('api_server_source').ok, true);

const invalidProfileResult = runCli(['doctor', '--profile', 'invalid']);
assert.equal(invalidProfileResult.ok, false);
assert.equal(invalidProfileResult.command, 'doctor');
assert.match(invalidProfileResult.error, /unknown doctor profile/);

console.log(JSON.stringify({ ok: true, test: 'cli-doctor' }));
