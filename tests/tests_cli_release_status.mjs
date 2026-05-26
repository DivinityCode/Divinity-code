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
assert.equal(result.release.release_gate_clearance.format, 'divinity.release_gate_clearance.v1');
assert.equal(result.release.release_gate_clearance.status, 'blocked');
assert.equal(result.release.release_gate_clearance.public_release_ready, false);
for (const blocker of [
  'package_private',
  'non_production_warning',
  'missing_registry_token',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.release_gate_clearance.blockers.includes(blocker),
    `missing release gate clearance blocker: ${blocker}`
  );
}
assert.equal(result.release.release_gate_clearance.redacts_local_paths, true);
assert.equal(result.release.release_gate_clearance.redacts_registry_token, true);
assert.equal(result.release.release_gate_clearance.redacts_signing_secrets, true);
const clearanceItemsById = new Map(
  result.release.release_gate_clearance.clearance_items.map(item => [item.item_id, item])
);
assert.equal(clearanceItemsById.get('package_privacy').status, 'blocked');
assert.equal(clearanceItemsById.get('package_privacy').evidence_command, 'pnpm run test:package');
assert.equal(clearanceItemsById.get('production_warning').status, 'blocked');
assert.equal(clearanceItemsById.get('production_warning').evidence_command, 'pnpm run test:public-docs');
assert.equal(clearanceItemsById.get('registry_token').current_state, 'NPM_TOKEN not configured');
assert.equal(clearanceItemsById.get('native_binary_distribution').evidence_command, 'pnpm run test:binary');
assert.equal(clearanceItemsById.get('release_signing').blocker, 'signing_blocked');
assert.equal(clearanceItemsById.get('release_signing').evidence_command, 'pnpm run test:release-signatures');
assert.deepEqual(clearanceItemsById.get('release_signing').evidence_artifacts, [
  'dist/release-signatures/manifest.json',
  'dist/release-bundle/attestation.json'
]);
assert.equal(clearanceItemsById.get('github_release_readiness').status, 'required');
assert.equal(clearanceItemsById.get('github_release_readiness').evidence_command, 'pnpm run test:github-workflows');
assert.equal(JSON.stringify(result.release.release_gate_clearance).includes(process.cwd()), false);
assert.equal(result.release.registry_publish_readiness.format, 'divinity.release_registry_publish_readiness.v1');
assert.equal(result.release.registry_publish_readiness.status, 'blocked');
assert.equal(result.release.registry_publish_readiness.provenance_required, true);
assert.equal(result.release.registry_publish_readiness.token_env_var, 'NPM_TOKEN');
assert.equal(result.release.registry_publish_readiness.token_configured, false);
assert.equal(result.release.registry_publish_readiness.redacts_token, true);
assert.ok(result.release.registry_publish_readiness.blockers.includes('package_private'));
assert.ok(result.release.registry_publish_readiness.blockers.includes('non_production_warning'));
assert.equal(result.release.release_candidate_bundle.format, 'divinity.release_candidate_bundle_readiness.v1');
assert.equal(result.release.release_candidate_bundle.status, 'blocked');
assert.equal(result.release.release_candidate_bundle.build_command, 'pnpm run release:bundle');
assert.equal(result.release.release_candidate_bundle.smoke_test_command, 'pnpm run test:release-bundle');
assert.equal(result.release.release_candidate_bundle.artifact_format, 'divinity.release_candidate_bundle.v1');
assert.equal(result.release.release_candidate_bundle.output_directory, 'dist/release-bundle');
assert.ok(result.release.release_candidate_bundle.includes.includes('release_artifacts_manifest'));
assert.ok(result.release.release_candidate_bundle.includes.includes('package_tarball'));
assert.ok(result.release.release_candidate_bundle.includes.includes('binary_artifacts_manifest'));
for (const blocker of [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.release_candidate_bundle.blockers.includes(blocker),
    `missing release candidate bundle blocker: ${blocker}`
  );
}
assert.equal(result.release.release_candidate_bundle.redacts_local_paths, true);
assert.equal(result.release.release_candidate_bundle.redacts_signing_secrets, true);
assert.equal(JSON.stringify(result.release.release_candidate_bundle).includes(process.cwd()), false);
assert.equal(result.release.release_attestation.format, 'divinity.release_attestation_readiness.v1');
assert.equal(result.release.release_attestation.status, 'blocked');
assert.equal(result.release.release_attestation.artifact_format, 'divinity.release_attestation.v1');
assert.equal(result.release.release_attestation.attestation_path, 'dist/release-bundle/attestation.json');
assert.equal(result.release.release_attestation.build_command, 'pnpm run release:bundle');
assert.equal(result.release.release_attestation.smoke_test_command, 'pnpm run test:release-bundle');
assert.equal(result.release.release_attestation.signing_required, true);
assert.equal(result.release.release_attestation.signing_status, 'blocked');
for (const blocker of [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.release_attestation.blockers.includes(blocker),
    `missing release attestation blocker: ${blocker}`
  );
}
assert.equal(result.release.release_attestation.redacts_local_paths, true);
assert.equal(result.release.release_attestation.redacts_signing_secrets, true);
assert.equal(JSON.stringify(result.release.release_attestation).includes(process.cwd()), false);
assert.equal(result.release.release_signature_artifacts.format, 'divinity.release_signature_artifacts_readiness.v1');
assert.equal(result.release.release_signature_artifacts.status, 'blocked');
assert.equal(result.release.release_signature_artifacts.artifact_format, 'divinity.release_signature_artifacts.v1');
assert.equal(result.release.release_signature_artifacts.build_command, 'pnpm run release:signatures');
assert.equal(result.release.release_signature_artifacts.smoke_test_command, 'pnpm run test:release-signatures');
assert.equal(result.release.release_signature_artifacts.output_directory, 'dist/release-signatures');
assert.equal(result.release.release_signature_artifacts.bundle_manifest_path, 'dist/release-bundle/manifest.json');
assert.equal(result.release.release_signature_artifacts.signing_required, true);
assert.equal(result.release.release_signature_artifacts.signing_configuration.status, 'not_configured');
for (const blocker of [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.release_signature_artifacts.blockers.includes(blocker),
    `missing release signature artifact blocker: ${blocker}`
  );
}
assert.equal(result.release.release_signature_artifacts.redacts_local_paths, true);
assert.equal(result.release.release_signature_artifacts.redacts_signing_secrets, true);
assert.equal(JSON.stringify(result.release.release_signature_artifacts).includes(process.cwd()), false);
assert.equal(result.release.release_promotion_preflight.format, 'divinity.release_promotion_preflight.v1');
assert.equal(result.release.release_promotion_preflight.status, 'blocked');
assert.equal(result.release.release_promotion_preflight.public_release_ready, false);
assert.equal(result.release.release_promotion_preflight.command, 'pnpm run release:promotion-preflight');
assert.equal(result.release.release_promotion_preflight.smoke_test_command, 'pnpm run test:release-promotion');
for (const blocker of [
  'package_private',
  'non_production_warning',
  'missing_registry_token',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.release_promotion_preflight.blockers.includes(blocker),
    `missing release promotion blocker: ${blocker}`
  );
}
assert.equal(result.release.release_promotion_preflight.registry_publish.token_configured, false);
assert.equal(result.release.release_promotion_preflight.signing.status, 'blocked');
assert.equal(result.release.release_promotion_preflight.redacts_local_paths, true);
assert.equal(result.release.release_promotion_preflight.redacts_registry_token, true);
assert.equal(result.release.release_promotion_preflight.redacts_signing_secrets, true);
assert.ok(result.release.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'release_attestation' &&
  required.path === 'dist/release-bundle/attestation.json'
)));
assert.ok(result.release.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'release_signature_artifacts_manifest' &&
  required.path === 'dist/release-signatures/manifest.json'
)));
assert.ok(result.release.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'release_signature_artifacts' &&
  gate.command === 'pnpm run test:release-signatures'
)));
assert.equal(JSON.stringify(result.release.release_promotion_preflight).includes(process.cwd()), false);
assert.equal(result.release.binary_release_readiness.format, 'divinity.release_binary_readiness.v1');
assert.equal(result.release.binary_release_readiness.status, 'blocked');
assert.equal(result.release.binary_release_readiness.artifact_id, 'binary_download');
assert.equal(result.release.binary_release_readiness.binary_name, 'divinity');
assert.equal(result.release.binary_release_readiness.build_command, 'pnpm run release:binary');
assert.equal(result.release.binary_release_readiness.smoke_test_command, 'pnpm run test:binary');
assert.equal(result.release.binary_release_readiness.signing_required, true);
assert.equal(result.release.binary_release_readiness.checksums_required, true);
assert.equal(result.release.binary_release_readiness.checksum_status, 'generated');
assert.equal(result.release.binary_release_readiness.redacts_local_paths, true);
assert.equal(result.release.binary_release_readiness.redacts_signing_secrets, true);
assert.deepEqual(result.release.binary_release_readiness.build_pipeline, {
  status: 'available',
  command: 'pnpm run release:binary',
  artifact_format: 'divinity.release_binary_artifacts.v1',
  artifact_type: 'node_launcher',
  native_binary: false,
  redacts_local_paths: true
});
assert.deepEqual(result.release.binary_release_readiness.smoke_gate, {
  status: 'available',
  command: 'pnpm run test:binary'
});
assert.equal(result.release.binary_release_readiness.supported_targets.length, 5);
assert.ok(result.release.binary_release_readiness.supported_targets.some(target => (
  target.platform === 'linux' &&
  target.arch === 'x64' &&
  target.filename === 'divinity-linux-x64' &&
  target.status === 'generated' &&
  target.native_binary === false &&
  target.public_download_status === 'blocked'
)));
assert.ok(result.release.binary_release_readiness.supported_targets.some(target => (
  target.platform === 'win32' &&
  target.arch === 'x64' &&
  target.filename === 'divinity-win32-x64.cmd' &&
  target.status === 'generated' &&
  target.native_binary === false &&
  target.public_download_status === 'blocked'
)));
for (const blocker of [
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]) {
  assert.ok(
    result.release.binary_release_readiness.blockers.includes(blocker),
    `missing binary release readiness blocker: ${blocker}`
  );
}
assert.equal(JSON.stringify(result.release.binary_release_readiness).includes(process.cwd()), false);
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
  'pnpm run test:binary',
  'pnpm run test:release-bundle',
  'pnpm run test:release-promotion',
  'pnpm run test:release-signatures',
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
assert.equal(configuredResult.release.release_signature_artifacts.signing_configuration.status, 'configured');
assert.equal(configuredResult.release.release_signature_artifacts.signing_configuration.ready_when_release_gates_clear, true);
assert.equal(configuredResult.release.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'release_signing'
).current_state, 'release signing inputs configured');
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
assert.equal(tokenConfiguredResult.release.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'registry_token'
).current_state, 'NPM_TOKEN configured');
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
