import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(args = [], options = {}) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    {
      cwd: options.cwd || process.cwd(),
      encoding: 'utf8',
      env: options.env || process.env
    }
  );
  return JSON.parse(output);
}

const result = runCli(['release-status'], {
  cwd: mkdtempSync(path.join(tmpdir(), 'divinity-release-status-'))
});

assert.equal(result.ok, true);
assert.equal(result.command, 'release-status');
assert.equal(result.release.format, 'divinity.release_artifacts.v1');
assert.equal(result.release.generated_by, 'packages/release-artifacts');
assert.equal(result.release.package.private, true);
assert.equal(result.release.non_production_warning_active, true);
assert.equal(result.release.registry_publish_readiness.format, 'divinity.release_registry_publish_readiness.v1');
assert.equal(result.release.registry_publish_readiness.status, 'blocked');
assert.equal(result.release.registry_publish_readiness.provenance_required, true);
assert.equal(result.release.registry_publish_readiness.token_env_var, 'NPM_TOKEN');
assert.equal(result.release.registry_publish_readiness.token_configured, false);
assert.equal(result.release.registry_publish_readiness.redacts_token, true);
assert.ok(result.release.registry_publish_readiness.blockers.includes('package_private'));
assert.ok(result.release.registry_publish_readiness.blockers.includes('non_production_warning'));
assert.equal(result.release.source_provenance.format, 'divinity.release_source_provenance.v1');
assert.equal(result.release.source_provenance.status, 'available');
assert.match(result.release.source_provenance.commit_sha, /^[a-f0-9]{40}$/);
assert.equal(result.release.source_provenance.redacts_paths, true);
assert.equal(result.release.release_sbom.format, 'divinity.release_sbom.v1');
assert.equal(result.release.release_sbom.status, 'generated');
assert.equal(result.release.release_sbom.component_count, result.release.release_sbom.components.length);
assert.ok(result.release.release_sbom.components.some(component => (
  component.component_id === 'npm:divinity-code@0.1.0' &&
  component.dependency_type === 'root'
)));
assert.ok(result.release.release_sbom.components.some(component => (
  component.name === 'ajv' &&
  component.dependency_type === 'development' &&
  component.direct === true
)));
assert.equal(JSON.stringify(result.release.release_sbom).includes('node_modules/'), false);
assert.equal(JSON.stringify(result.release.release_sbom).includes(process.cwd()), false);
assert.equal(result.release.artifact_signing.status, 'blocked');
assert.equal(result.release.artifact_signing.configuration.status, 'not_configured');

const installPathsById = new Map(result.release.install_paths.map(installPath => [installPath.install_path_id, installPath]));
assert.equal(installPathsById.get('source_checkout').status, 'available');
assert.equal(installPathsById.get('local_package_tarball').status, 'available');
assert.equal(installPathsById.get('package_registry').status, 'blocked');
assert.equal(installPathsById.get('binary_download').status, 'blocked');

for (const command of [
  'pnpm test',
  'pnpm run test:providers',
  'pnpm run test:smoke'
]) {
  assert.ok(
    result.release.release_gates.some(gate => gate.command === command),
    `missing release gate: ${command}`
  );
}

const configuredResult = runCli(['release-status'], {
  cwd: mkdtempSync(path.join(tmpdir(), 'divinity-release-status-signing-')),
  env: {
    ...process.env,
    DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
    DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
  }
});
assert.equal(configuredResult.release.artifact_signing.status, 'blocked');
assert.equal(configuredResult.release.artifact_signing.configuration.status, 'configured');
assert.equal(configuredResult.release.artifact_signing.configuration.ready_when_release_gates_clear, true);
assert.equal(JSON.stringify(configuredResult).includes('secret://divinity/release/signing-key'), false);
assert.equal(JSON.stringify(configuredResult).includes('release@example.com'), false);

const tokenConfiguredResult = runCli(['release-status'], {
  cwd: mkdtempSync(path.join(tmpdir(), 'divinity-release-status-registry-token-')),
  env: {
    ...process.env,
    NPM_TOKEN: 'npm-secret-token-value'
  }
});
assert.equal(tokenConfiguredResult.release.registry_publish_readiness.token_configured, true);
assert.equal(JSON.stringify(tokenConfiguredResult).includes('npm-secret-token-value'), false);

const serialized = JSON.stringify(result);
for (const disallowed of [
  'npm install -g divinity-code',
  'npx divinity',
  'public shared key',
  'no-signup',
  'bypass'
]) {
  assert.equal(serialized.includes(disallowed), false, `release status must not include ${disallowed}`);
}

console.log(JSON.stringify({ ok: true, test: 'cli-release-status' }));
