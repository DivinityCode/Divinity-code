import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { buildReleaseArtifactsManifest } from '../packages/release-artifacts/src/index.mjs';

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-release-artifacts-'));
const outputPath = path.join(tmpDir, 'release-artifacts.json');

const output = execFileSync(
  process.execPath,
  [path.resolve('tests/scripts_release_artifacts.mjs'), '--output', outputPath],
  {
    cwd: process.cwd(),
    encoding: 'utf8',
    env: {
      ...process.env,
      NPM_TOKEN: '',
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: '',
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND: '',
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: '',
      DIVINITY_RELEASE_SIGNING_COMMAND: '',
      DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: '',
      DIVINITY_RELEASE_SIGNING_KEY_REF: '',
      DIVINITY_RELEASE_SIGNING_IDENTITY: ''
    }
  }
);
const result = JSON.parse(output);

assert.equal(result.ok, true);
assert.equal(result.artifact_path, outputPath);
assert.equal(existsSync(outputPath), true);

const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
assert.deepEqual(result.artifact, artifact);
assert.equal(artifact.format, 'divinity.release_artifacts.v1');
assert.equal(artifact.generated_by, 'packages/release-artifacts');
assert.equal(artifact.package.name, packageJson.name);
assert.equal(artifact.package.version, packageJson.version);
assert.equal(artifact.package.private, packageJson.private);
assert.equal(artifact.package.license, packageJson.license);
assert.equal(artifact.package.repository_url, packageJson.repository.url);
assert.equal(artifact.package.node_engine, packageJson.engines.node);
assert.equal(artifact.package.package_manager, packageJson.packageManager);
assert.deepEqual(artifact.package.bin, packageJson.bin);
assert.equal(artifact.non_production_warning_active, true);
assert.equal(artifact.release_gate_clearance.format, 'divinity.release_gate_clearance.v1');
assert.equal(artifact.release_gate_clearance.status, 'blocked');
assert.equal(artifact.release_gate_clearance.public_release_ready, false);
assert.deepEqual(artifact.release_gate_clearance.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token',
  'missing_github_release_token',
  'missing_release_tag',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_gate_clearance.redacts_local_paths, true);
assert.equal(artifact.release_gate_clearance.redacts_registry_token, true);
assert.equal(artifact.release_gate_clearance.redacts_github_token, true);
assert.equal(artifact.release_gate_clearance.redacts_signing_secrets, true);
assert.equal(artifact.release_gate_clearance.clearance_items.length, 8);

const clearanceItemsById = new Map(
  artifact.release_gate_clearance.clearance_items.map(item => [item.item_id, item])
);
assert.deepEqual(clearanceItemsById.get('package_privacy'), {
  item_id: 'package_privacy',
  status: 'blocked',
  blocker: 'package_private',
  current_state: 'package.json private=true',
  required_state: 'package publishing is explicitly enabled by an approved public release decision',
  evidence_command: 'pnpm run test:public-readiness-audit',
  evidence_artifacts: ['dist/release-public-readiness-audit.json', 'package.json']
});
assert.deepEqual(clearanceItemsById.get('production_warning'), {
  item_id: 'production_warning',
  status: 'blocked',
  blocker: 'non_production_warning',
  current_state: 'README non-production warning active',
  required_state: 'README production warning is removed only after the public readiness audit passes',
  evidence_command: 'pnpm run test:public-readiness-audit',
  evidence_artifacts: ['dist/release-public-readiness-audit.json', 'README.md', 'docs/RELEASE_CHECKLIST.md']
});
assert.equal(clearanceItemsById.get('registry_token').status, 'blocked');
assert.equal(clearanceItemsById.get('registry_token').blocker, 'missing_registry_token');
assert.equal(clearanceItemsById.get('registry_token').current_state, 'NPM_TOKEN not configured');
assert.equal(clearanceItemsById.get('registry_token').evidence_command, 'pnpm run test:release-registry-dry-run');
assert.deepEqual(clearanceItemsById.get('registry_token').evidence_artifacts, ['dist/release-registry-dry-run.json']);
assert.equal(clearanceItemsById.get('github_release_token').status, 'blocked');
assert.equal(clearanceItemsById.get('github_release_token').blocker, 'missing_github_release_token');
assert.equal(clearanceItemsById.get('github_release_token').current_state, 'GitHub release token not configured');
assert.equal(clearanceItemsById.get('github_release_token').evidence_command, 'pnpm run test:release-binary-attachments');
assert.deepEqual(clearanceItemsById.get('github_release_token').evidence_artifacts, ['dist/release-binary-attachments.json']);
assert.equal(clearanceItemsById.get('github_release_tag').status, 'blocked');
assert.equal(clearanceItemsById.get('github_release_tag').blocker, 'missing_release_tag');
assert.equal(clearanceItemsById.get('github_release_tag').current_state, 'GitHub release tag not configured');
assert.equal(clearanceItemsById.get('github_release_tag').evidence_command, 'pnpm run test:release-binary-attachments');
assert.deepEqual(clearanceItemsById.get('github_release_tag').evidence_artifacts, ['dist/release-binary-attachments.json']);
assert.equal(clearanceItemsById.get('native_binary_distribution').blocker, 'native_binary_build_pending');
assert.equal(clearanceItemsById.get('native_binary_distribution').evidence_command, 'pnpm run test:signed-native-binary');
assert.deepEqual(clearanceItemsById.get('native_binary_distribution').evidence_artifacts, [
  'dist/signed-native-binary/manifest.json',
  'dist/signed-native-binary/SHA256SUMS'
]);
assert.equal(clearanceItemsById.get('release_signing').blocker, 'signing_blocked');
assert.equal(clearanceItemsById.get('release_signing').evidence_command, 'pnpm run test:release-signatures');
assert.deepEqual(clearanceItemsById.get('release_signing').evidence_artifacts, [
  'dist/release-signatures/manifest.json',
  'dist/release-bundle/attestation.json'
]);
assert.equal(clearanceItemsById.get('github_release_readiness').status, 'required');
assert.equal(clearanceItemsById.get('github_release_readiness').evidence_command, 'pnpm run test:github-workflows');
assert.equal(JSON.stringify(artifact.release_gate_clearance).includes(process.cwd()), false);
assert.equal(JSON.stringify(artifact.release_gate_clearance).includes('secret://'), false);
assert.equal(JSON.stringify(artifact.release_gate_clearance).includes('npm-secret-token-value'), false);
assert.equal(artifact.release_public_readiness_audit.format, 'divinity.release_public_readiness_audit.v1');
assert.equal(artifact.release_public_readiness_audit.status, 'blocked');
assert.equal(artifact.release_public_readiness_audit.public_release_ready, false);
assert.equal(artifact.release_public_readiness_audit.decision_required, true);
assert.equal(artifact.release_public_readiness_audit.command, 'pnpm run release:public-readiness-audit');
assert.equal(artifact.release_public_readiness_audit.smoke_test_command, 'pnpm run test:public-readiness-audit');
assert.equal(artifact.release_public_readiness_audit.package.private, true);
assert.equal(artifact.release_public_readiness_audit.non_production_warning_active, true);
assert.deepEqual(artifact.release_public_readiness_audit.blockers, artifact.release_gate_clearance.blockers);
assert.deepEqual(
  artifact.release_public_readiness_audit.package_privacy_decision,
  clearanceItemsById.get('package_privacy')
);
assert.deepEqual(
  artifact.release_public_readiness_audit.production_warning_decision,
  clearanceItemsById.get('production_warning')
);
assert.equal(artifact.release_public_readiness_audit.does_not_publish, true);
assert.equal(artifact.release_public_readiness_audit.does_not_upload, true);
assert.equal(artifact.release_public_readiness_audit.does_not_mutate_package_metadata, true);
assert.equal(artifact.release_public_readiness_audit.does_not_remove_non_production_warning, true);
assert.equal(artifact.release_public_readiness_audit.redacts_local_paths, true);
assert.equal(artifact.release_public_readiness_audit.redacts_registry_token, true);
assert.equal(artifact.release_public_readiness_audit.redacts_github_token, true);
assert.equal(artifact.release_public_readiness_audit.redacts_release_tag, true);
assert.equal(artifact.release_public_readiness_audit.redacts_signing_secrets, true);
assert.equal(JSON.stringify(artifact.release_public_readiness_audit).includes(process.cwd()), false);
assert.equal(JSON.stringify(artifact.release_public_readiness_audit).includes('secret://'), false);
assert.equal(JSON.stringify(artifact.release_public_readiness_audit).includes('npm-secret-token-value'), false);
assert.equal(artifact.registry_publish_readiness.format, 'divinity.release_registry_publish_readiness.v1');
assert.equal(artifact.registry_publish_readiness.status, 'blocked');
assert.equal(artifact.registry_publish_readiness.package_name, packageJson.name);
assert.equal(artifact.registry_publish_readiness.package_version, packageJson.version);
assert.equal(artifact.registry_publish_readiness.registry_url, 'https://registry.npmjs.org/');
assert.equal(artifact.registry_publish_readiness.provenance_required, true);
assert.equal(artifact.registry_publish_readiness.publish_command, 'npm publish --provenance --access public');
assert.equal(artifact.registry_publish_readiness.dry_run_command, 'npm publish --dry-run --provenance --access public');
assert.equal(artifact.registry_publish_readiness.token_env_var, 'NPM_TOKEN');
assert.equal(artifact.registry_publish_readiness.token_configured, false);
assert.equal(artifact.registry_publish_readiness.redacts_token, true);
assert.equal(artifact.registry_publish_readiness.redacts_local_paths, true);
assert.deepEqual(artifact.registry_publish_readiness.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token'
]);
assert.equal(JSON.stringify(artifact.registry_publish_readiness).includes(process.cwd()), false);
assert.equal(artifact.release_registry_publish_dry_run.format, 'divinity.release_registry_publish_dry_run.v1');
assert.equal(artifact.release_registry_publish_dry_run.status, 'blocked');
assert.equal(artifact.release_registry_publish_dry_run.public_release_ready, false);
assert.equal(artifact.release_registry_publish_dry_run.registry_publish_ready, false);
assert.equal(artifact.release_registry_publish_dry_run.command, 'pnpm run release:registry-dry-run');
assert.equal(artifact.release_registry_publish_dry_run.smoke_test_command, 'pnpm run test:release-registry-dry-run');
assert.equal(artifact.release_registry_publish_dry_run.dry_run_command, 'npm publish --dry-run --provenance --access public');
assert.equal(artifact.release_registry_publish_dry_run.token_configured, false);
assert.equal(artifact.release_registry_publish_dry_run.dry_run_executed, false);
assert.equal(artifact.release_registry_publish_dry_run.redacts_token, true);
assert.equal(artifact.release_registry_publish_dry_run.redacts_local_paths, true);
assert.equal(artifact.release_registry_publish_dry_run.redacts_npm_output, true);
assert.deepEqual(artifact.release_registry_publish_dry_run.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token'
]);
assert.equal(JSON.stringify(artifact.release_registry_publish_dry_run).includes(process.cwd()), false);
assert.equal(artifact.release_binary_attachment_plan.format, 'divinity.release_binary_attachment_plan.v1');
assert.equal(artifact.release_binary_attachment_plan.status, 'blocked');
assert.equal(artifact.release_binary_attachment_plan.public_release_ready, false);
assert.equal(artifact.release_binary_attachment_plan.binary_attachments_ready, false);
assert.equal(artifact.release_binary_attachment_plan.command, 'pnpm run release:binary-attachments');
assert.equal(artifact.release_binary_attachment_plan.smoke_test_command, 'pnpm run test:release-binary-attachments');
assert.equal(artifact.release_binary_attachment_plan.provider, 'github_releases');
assert.equal(artifact.release_binary_attachment_plan.repository, 'DivinityCode/Divinity-code');
assert.equal(artifact.release_binary_attachment_plan.release_tag_configured, false);
assert.equal(artifact.release_binary_attachment_plan.token_configured, false);
assert.deepEqual(artifact.release_binary_attachment_plan.blockers, [
  'package_private',
  'non_production_warning',
  'missing_github_release_token',
  'missing_release_tag',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_binary_attachment_plan.does_not_upload, true);
assert.equal(artifact.release_binary_attachment_plan.redacts_token, true);
assert.equal(artifact.release_binary_attachment_plan.redacts_local_paths, true);
assert.equal(artifact.release_binary_attachment_plan.redacts_signing_secrets, true);
assert.equal(JSON.stringify(artifact.release_binary_attachment_plan).includes(process.cwd()), false);
assert.equal(artifact.release_candidate_bundle.format, 'divinity.release_candidate_bundle_readiness.v1');
assert.equal(artifact.release_candidate_bundle.status, 'blocked');
assert.equal(artifact.release_candidate_bundle.build_command, 'pnpm run release:bundle');
assert.equal(artifact.release_candidate_bundle.smoke_test_command, 'pnpm run test:release-bundle');
assert.equal(artifact.release_candidate_bundle.artifact_format, 'divinity.release_candidate_bundle.v1');
assert.equal(artifact.release_candidate_bundle.output_directory, 'dist/release-bundle');
assert.deepEqual(artifact.release_candidate_bundle.includes, [
  'release_artifacts_manifest',
  'package_tarball',
  'binary_artifacts_manifest',
  'bundle_checksums'
]);
assert.deepEqual(artifact.release_candidate_bundle.blockers, [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_candidate_bundle.redacts_local_paths, true);
assert.equal(artifact.release_candidate_bundle.redacts_signing_secrets, true);
assert.equal(JSON.stringify(artifact.release_candidate_bundle).includes(process.cwd()), false);
assert.equal(artifact.release_attestation.format, 'divinity.release_attestation_readiness.v1');
assert.equal(artifact.release_attestation.status, 'blocked');
assert.equal(artifact.release_attestation.artifact_format, 'divinity.release_attestation.v1');
assert.equal(artifact.release_attestation.attestation_path, 'dist/release-bundle/attestation.json');
assert.equal(artifact.release_attestation.build_command, 'pnpm run release:bundle');
assert.equal(artifact.release_attestation.smoke_test_command, 'pnpm run test:release-bundle');
assert.equal(artifact.release_attestation.signing_required, true);
assert.equal(artifact.release_attestation.signing_status, 'blocked');
assert.deepEqual(artifact.release_attestation.subject_kinds, [
  'release_artifacts_manifest',
  'package_tarball',
  'binary_artifacts_manifest',
  'binary_launcher',
  'checksum_manifest'
]);
assert.deepEqual(artifact.release_attestation.blockers, [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_attestation.redacts_local_paths, true);
assert.equal(artifact.release_attestation.redacts_signing_secrets, true);
assert.equal(JSON.stringify(artifact.release_attestation).includes(process.cwd()), false);
assert.equal(artifact.release_signature_artifacts.format, 'divinity.release_signature_artifacts_readiness.v1');
assert.equal(artifact.release_signature_artifacts.status, 'blocked');
assert.equal(artifact.release_signature_artifacts.artifact_format, 'divinity.release_signature_artifacts.v1');
assert.equal(artifact.release_signature_artifacts.build_command, 'pnpm run release:signatures');
assert.equal(artifact.release_signature_artifacts.smoke_test_command, 'pnpm run test:release-signatures');
assert.equal(artifact.release_signature_artifacts.output_directory, 'dist/release-signatures');
assert.equal(artifact.release_signature_artifacts.bundle_manifest_path, 'dist/release-bundle/manifest.json');
assert.equal(artifact.release_signature_artifacts.signing_required, true);
assert.equal(artifact.release_signature_artifacts.signing_configuration.status, 'not_configured');
assert.deepEqual(artifact.release_signature_artifacts.signed_artifact_ids, [
  'release_artifacts_manifest',
  'package_tarball',
  'binary_artifacts_manifest',
  'binary_checksums',
  'release_attestation',
  'bundle_checksums'
]);
assert.deepEqual(artifact.release_signature_artifacts.blockers, [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_signature_artifacts.redacts_local_paths, true);
assert.equal(artifact.release_signature_artifacts.redacts_signing_secrets, true);
assert.equal(JSON.stringify(artifact.release_signature_artifacts).includes(process.cwd()), false);
assert.equal(artifact.release_promotion_preflight.format, 'divinity.release_promotion_preflight.v1');
assert.equal(artifact.release_promotion_preflight.status, 'blocked');
assert.equal(artifact.release_promotion_preflight.public_release_ready, false);
assert.equal(artifact.release_promotion_preflight.command, 'pnpm run release:promotion-preflight');
assert.equal(artifact.release_promotion_preflight.smoke_test_command, 'pnpm run test:release-promotion');
assert.deepEqual(artifact.release_promotion_preflight.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token',
  'missing_github_release_token',
  'missing_release_tag',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(artifact.release_promotion_preflight.registry_publish.token_configured, false);
assert.equal(artifact.release_promotion_preflight.binary_distribution.attachment_plan_path, 'dist/release-binary-attachments.json');
assert.equal(artifact.release_promotion_preflight.binary_distribution.attachment_plan_status, 'blocked');
assert.equal(artifact.release_promotion_preflight.binary_distribution.token_configured, false);
assert.equal(artifact.release_promotion_preflight.binary_distribution.release_tag_configured, false);
assert.equal(artifact.release_promotion_preflight.signing.status, 'blocked');
assert.equal(artifact.release_promotion_preflight.redacts_local_paths, true);
assert.equal(artifact.release_promotion_preflight.redacts_registry_token, true);
assert.equal(artifact.release_promotion_preflight.redacts_github_token, true);
assert.equal(artifact.release_promotion_preflight.redacts_signing_secrets, true);
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'release_attestation' &&
  required.path === 'dist/release-bundle/attestation.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'public_readiness_audit' &&
  required.path === 'dist/release-public-readiness-audit.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'registry_publish_dry_run_report' &&
  required.path === 'dist/release-registry-dry-run.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'binary_attachment_plan' &&
  required.path === 'dist/release-binary-attachments.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'native_binary_artifacts_manifest' &&
  required.path === 'dist/native-binary/manifest.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'signed_native_binary_artifacts_manifest' &&
  required.path === 'dist/signed-native-binary/manifest.json'
)));
assert.ok(artifact.release_promotion_preflight.required_artifacts.some(required => (
  required.artifact_id === 'release_signature_artifacts_manifest' &&
  required.path === 'dist/release-signatures/manifest.json'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'native_binary_artifacts' &&
  gate.command === 'pnpm run test:native-binary'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'public_readiness_audit' &&
  gate.command === 'pnpm run test:public-readiness-audit'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'registry_publish_dry_run' &&
  gate.command === 'pnpm run test:release-registry-dry-run'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'binary_attachment_plan' &&
  gate.command === 'pnpm run test:release-binary-attachments'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'signed_native_binary_artifacts' &&
  gate.command === 'pnpm run test:signed-native-binary'
)));
assert.ok(artifact.release_promotion_preflight.release_gates.some(gate => (
  gate.gate_id === 'release_signature_artifacts' &&
  gate.command === 'pnpm run test:release-signatures'
)));
assert.equal(JSON.stringify(artifact.release_promotion_preflight).includes(process.cwd()), false);
assert.equal(artifact.binary_release_readiness.format, 'divinity.release_binary_readiness.v1');
assert.equal(artifact.binary_release_readiness.status, 'blocked');
assert.equal(artifact.binary_release_readiness.artifact_id, 'binary_download');
assert.equal(artifact.binary_release_readiness.binary_name, 'divinity');
assert.equal(artifact.binary_release_readiness.build_command, 'pnpm run release:binary');
assert.equal(artifact.binary_release_readiness.smoke_test_command, 'pnpm run test:binary');
assert.equal(artifact.binary_release_readiness.signing_required, true);
assert.equal(artifact.binary_release_readiness.checksums_required, true);
assert.equal(artifact.binary_release_readiness.checksum_status, 'generated');
assert.equal(artifact.binary_release_readiness.redacts_local_paths, true);
assert.equal(artifact.binary_release_readiness.redacts_signing_secrets, true);
assert.deepEqual(artifact.binary_release_readiness.build_pipeline, {
  status: 'available',
  command: 'pnpm run release:binary',
  artifact_format: 'divinity.release_binary_artifacts.v1',
  artifact_type: 'node_launcher',
  native_binary: false,
  redacts_local_paths: true
});
assert.deepEqual(artifact.binary_release_readiness.smoke_gate, {
  status: 'available',
  command: 'pnpm run test:binary'
});
assert.deepEqual(artifact.binary_release_readiness.native_build_pipeline, {
  status: 'not_configured',
  command: 'pnpm run release:native-binary',
  smoke_test_command: 'pnpm run test:native-binary',
  artifact_format: 'divinity.release_native_binary_artifacts.v1',
  artifact_type: 'native_binary',
  command_env_var: 'DIVINITY_NATIVE_BINARY_BUILD_COMMAND',
  command_args_env_var: 'DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS',
  command_configured: false,
  command_absolute: false,
  command_args_configured: false,
  redacts_local_paths: true,
  redacts_build_command: true,
  reason: 'Native binary build command is not configured.'
});
assert.deepEqual(artifact.binary_release_readiness.signed_native_binary_pipeline, {
  status: 'not_configured',
  command: 'pnpm run release:signed-native-binary',
  smoke_test_command: 'pnpm run test:signed-native-binary',
  artifact_format: 'divinity.release_signed_native_binary_artifacts.v1',
  artifact_type: 'signed_native_binary',
  native_build_configured: false,
  native_build_command_absolute: false,
  signing_configured: false,
  signing_command_absolute: false,
  redacts_local_paths: true,
  redacts_build_command: true,
  redacts_signing_secrets: true,
  reason: 'Signed native binary artifacts require configured native build and release signing inputs.'
});
assert.deepEqual(artifact.binary_release_readiness.supported_targets, [
  {
    platform: 'linux',
    arch: 'x64',
    filename: 'divinity-linux-x64',
    status: 'generated',
    native_binary: false,
    public_download_status: 'blocked'
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: 'divinity-linux-arm64',
    status: 'generated',
    native_binary: false,
    public_download_status: 'blocked'
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: 'divinity-darwin-x64',
    status: 'generated',
    native_binary: false,
    public_download_status: 'blocked'
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: 'divinity-darwin-arm64',
    status: 'generated',
    native_binary: false,
    public_download_status: 'blocked'
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: 'divinity-win32-x64.cmd',
    status: 'generated',
    native_binary: false,
    public_download_status: 'blocked'
  }
]);
assert.deepEqual(artifact.binary_release_readiness.blockers, [
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.match(artifact.binary_release_readiness.reason, /signed native binary downloads remain blocked/);
assert.equal(JSON.stringify(artifact.binary_release_readiness).includes(process.cwd()), false);
assert.equal(artifact.source_provenance.format, 'divinity.release_source_provenance.v1');
assert.equal(artifact.source_provenance.status, 'available');
assert.equal(artifact.source_provenance.vcs, 'git');
assert.equal(artifact.source_provenance.repository_url, packageJson.repository.url);
assert.match(artifact.source_provenance.commit_sha, /^[a-f0-9]{40}$/);
assert.match(artifact.source_provenance.short_commit_sha, /^[a-f0-9]{7,12}$/);
assert.equal(typeof artifact.source_provenance.branch, 'string');
assert.equal(typeof artifact.source_provenance.tracked_changes, 'boolean');
assert.equal(artifact.source_provenance.untracked_files_ignored, true);
assert.equal(artifact.source_provenance.redacts_paths, true);
assert.equal(JSON.stringify(artifact.source_provenance).includes('tests/tests_release_artifacts.mjs'), false);

assert.equal(artifact.release_sbom.format, 'divinity.release_sbom.v1');
assert.equal(artifact.release_sbom.status, 'generated');
assert.equal(artifact.release_sbom.source, 'package-lock.json');
assert.equal(artifact.release_sbom.package_manager, 'npm');
assert.equal(artifact.release_sbom.lockfile_version, packageLock.lockfileVersion);
assert.equal(artifact.release_sbom.generated_from_package_files, true);
assert.equal(artifact.release_sbom.redacts_local_paths, true);
assert.equal(artifact.release_sbom.redacts_registry_urls, true);
assert.equal(artifact.release_sbom.redacts_integrity_values, true);
assert.equal(artifact.release_sbom.component_count, artifact.release_sbom.components.length);
assert.ok(artifact.release_sbom.component_count >= 4);

const sbomComponentsById = new Map(artifact.release_sbom.components.map(component => [component.component_id, component]));
const rootComponent = sbomComponentsById.get('npm:divinity-code@0.1.0');
assert.ok(rootComponent, 'missing root SBOM component');
assert.equal(rootComponent.component_type, 'application');
assert.equal(rootComponent.dependency_type, 'root');
assert.equal(rootComponent.direct, false);

const ajvComponent = artifact.release_sbom.components.find(component => component.name === 'ajv');
assert.ok(ajvComponent, 'missing ajv SBOM component');
assert.equal(ajvComponent.version, packageLock.packages['node_modules/ajv'].version);
assert.equal(ajvComponent.component_type, 'library');
assert.equal(ajvComponent.dependency_type, 'development');
assert.equal(ajvComponent.direct, true);
assert.equal(ajvComponent.requested_range, packageJson.devDependencies.ajv);

const ajvFormatsComponent = artifact.release_sbom.components.find(component => component.name === 'ajv-formats');
assert.ok(ajvFormatsComponent, 'missing ajv-formats SBOM component');
assert.equal(ajvFormatsComponent.dependency_type, 'development');
assert.equal(ajvFormatsComponent.direct, true);

const transitiveComponent = artifact.release_sbom.components.find(component => component.name === 'fast-deep-equal');
assert.ok(transitiveComponent, 'missing transitive SBOM component');
assert.equal(transitiveComponent.dependency_type, 'transitive');
assert.equal(transitiveComponent.direct, false);
assert.equal(transitiveComponent.requested_range, '');

const componentIds = artifact.release_sbom.components.map(component => component.component_id);
assert.deepEqual([...componentIds].sort(), componentIds);
for (const component of artifact.release_sbom.components) {
  assert.equal(Object.hasOwn(component, 'path'), false);
  assert.equal(Object.hasOwn(component, 'resolved'), false);
  assert.equal(Object.hasOwn(component, 'integrity'), false);
}

const unavailableProvenanceArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  gitCommand: '/definitely/missing/git'
});
assert.equal(unavailableProvenanceArtifact.source_provenance.status, 'unavailable');
assert.equal(unavailableProvenanceArtifact.source_provenance.commit_sha, '');

assert.equal(artifact.artifact_integrity.algorithm, 'sha256');
assert.equal(artifact.artifact_integrity.generated_from_package_files, true);
assert.equal(artifact.artifact_integrity.redacts_secrets, true);
assert.ok(Array.isArray(artifact.artifact_integrity.files));
for (const expectedPath of [
  'README.md',
  'package.json',
  'apps/cli/src/index.mjs',
  'packages/provider-proxy/src/index.mjs'
]) {
  const entry = artifact.artifact_integrity.files.find(file => file.path === expectedPath);
  assert.ok(entry, `missing integrity entry: ${expectedPath}`);
  assert.equal(entry.sha256, sha256(expectedPath));
  assert.match(entry.sha256, /^[a-f0-9]{64}$/);
  assert.equal(Number.isInteger(entry.bytes) && entry.bytes > 0, true);
}

const integrityPaths = artifact.artifact_integrity.files.map(file => file.path);
assert.deepEqual([...integrityPaths].sort(), integrityPaths);
for (const disallowedPathPart of [
  'node_modules/',
  'dist/',
  '.divinity',
  'provider-usage-ledger',
  'provider-limits'
]) {
  assert.equal(
    integrityPaths.some(filePath => filePath.includes(disallowedPathPart)),
    false,
    `integrity manifest must not include ${disallowedPathPart}`
  );
}

assert.equal(artifact.artifact_signing.required, true);
assert.equal(artifact.artifact_signing.status, 'blocked');
assert.match(artifact.artifact_signing.reason, /non-production warning|private=true/);
assert.equal(artifact.artifact_signing.key_source_required, true);
assert.deepEqual(artifact.artifact_signing.allowed_algorithms, ['cosign', 'minisign', 'sigstore']);
assert.equal(artifact.artifact_signing.configuration.status, 'not_configured');
assert.equal(artifact.artifact_signing.configuration.ready_when_release_gates_clear, false);
assert.ok(artifact.artifact_signing.targets.some(target => (
  target.artifact_id === 'source_integrity_manifest' &&
  target.digest_algorithm === 'sha256' &&
  target.signature_status === 'unsigned'
)));
assert.ok(artifact.artifact_signing.targets.some(target => (
  target.artifact_id === 'binary_download' &&
  target.signature_status === 'blocked'
)));

const configuredSigningArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
    DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
  }
});
assert.equal(configuredSigningArtifact.artifact_signing.status, 'blocked');
assert.equal(configuredSigningArtifact.artifact_signing.configuration.status, 'configured');
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_absolute, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_args_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.key_ref_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.identity_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.ready_when_release_gates_clear, true);
assert.equal(configuredSigningArtifact.release_signature_artifacts.signing_configuration.status, 'configured');
assert.equal(configuredSigningArtifact.release_signature_artifacts.signing_configuration.ready_when_release_gates_clear, true);
assert.equal(configuredSigningArtifact.binary_release_readiness.signed_native_binary_pipeline.status, 'not_configured');
assert.equal(configuredSigningArtifact.binary_release_readiness.signed_native_binary_pipeline.signing_configured, true);
assert.equal(configuredSigningArtifact.binary_release_readiness.signed_native_binary_pipeline.native_build_configured, false);
assert.equal(configuredSigningArtifact.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'release_signing'
).current_state, 'release signing inputs configured');
assert.equal(JSON.stringify(configuredSigningArtifact).includes('secret://divinity/release/signing-key'), false);
assert.equal(JSON.stringify(configuredSigningArtifact).includes('release@example.com'), false);

const configuredNativeBinaryArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_NATIVE_BINARY_BUILD_COMMAND: process.execPath,
    DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: JSON.stringify(['--version'])
  }
});
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.native_build_pipeline.status, 'configured');
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.native_build_pipeline.command_configured, true);
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.native_build_pipeline.command_absolute, true);
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.native_build_pipeline.command_args_configured, true);
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.status, 'not_configured');
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.native_build_configured, true);
assert.equal(configuredNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.signing_configured, false);
assert.equal(configuredNativeBinaryArtifact.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'native_binary_distribution'
).current_state, 'native binary build inputs configured');
assert.equal(JSON.stringify(configuredNativeBinaryArtifact).includes(process.execPath), false);

const configuredSignedNativeBinaryArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_NATIVE_BINARY_BUILD_COMMAND: process.execPath,
    DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
    DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
  }
});
assert.equal(configuredSignedNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.status, 'configured');
assert.equal(configuredSignedNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.native_build_configured, true);
assert.equal(configuredSignedNativeBinaryArtifact.binary_release_readiness.signed_native_binary_pipeline.signing_configured, true);
assert.equal(JSON.stringify(configuredSignedNativeBinaryArtifact).includes(process.execPath), false);

const configuredPublishArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: { NPM_TOKEN: 'npm-secret-token-value' }
});
assert.equal(configuredPublishArtifact.registry_publish_readiness.status, 'blocked');
assert.equal(configuredPublishArtifact.registry_publish_readiness.token_configured, true);
assert.equal(configuredPublishArtifact.release_registry_publish_dry_run.status, 'blocked');
assert.equal(configuredPublishArtifact.release_registry_publish_dry_run.token_configured, true);
assert.equal(configuredPublishArtifact.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'registry_token'
).current_state, 'NPM_TOKEN configured');
assert.deepEqual(configuredPublishArtifact.registry_publish_readiness.blockers, [
  'package_private',
  'non_production_warning'
]);
assert.equal(JSON.stringify(configuredPublishArtifact).includes('npm-secret-token-value'), false);

const configuredGitHubReleaseArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    GITHUB_TOKEN: 'github-release-secret-value',
    DIVINITY_RELEASE_TAG: 'v0.1.0'
  }
});
assert.equal(configuredGitHubReleaseArtifact.release_binary_attachment_plan.token_configured, true);
assert.equal(configuredGitHubReleaseArtifact.release_binary_attachment_plan.release_tag_configured, true);
assert.equal(configuredGitHubReleaseArtifact.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'github_release_token'
).current_state, 'GitHub release token configured');
assert.equal(configuredGitHubReleaseArtifact.release_gate_clearance.clearance_items.find(
  item => item.item_id === 'github_release_tag'
).current_state, 'GitHub release tag configured');
assert.equal(JSON.stringify(configuredGitHubReleaseArtifact).includes('github-release-secret-value'), false);
assert.equal(JSON.stringify(configuredGitHubReleaseArtifact).includes('v0.1.0'), false);

const invalidSigningArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_RELEASE_SIGNING_COMMAND: 'cosign',
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['sign'])
  }
});
assert.equal(invalidSigningArtifact.artifact_signing.configuration.status, 'invalid');
assert.match(invalidSigningArtifact.artifact_signing.configuration.reason, /absolute executable path/);

const installPathsById = new Map(artifact.install_paths.map(installPath => [installPath.install_path_id, installPath]));
for (const installPathId of [
  'source_checkout',
  'pnpm_global_link',
  'local_package_tarball',
  'package_registry',
  'binary_download'
]) {
  assert.ok(installPathsById.has(installPathId), `missing install path: ${installPathId}`);
}

assert.equal(installPathsById.get('source_checkout').status, 'available');
assert.match(installPathsById.get('source_checkout').command, /node apps\/cli\/src\/index\.mjs doctor/);
assert.equal(installPathsById.get('pnpm_global_link').status, 'available');
assert.match(installPathsById.get('pnpm_global_link').command, /pnpm link --global/);
assert.equal(installPathsById.get('local_package_tarball').status, 'available');
assert.equal(installPathsById.get('local_package_tarball').command, 'pnpm run test:package-tarball');
assert.match(installPathsById.get('local_package_tarball').notes, /temporary consumer project/);
assert.equal(installPathsById.get('package_registry').status, 'blocked');
assert.match(installPathsById.get('package_registry').reason, /private/);
assert.equal(installPathsById.get('binary_download').status, 'blocked');
assert.match(installPathsById.get('binary_download').reason, /non-production warning/);

for (const command of [
  'pnpm run test:package',
  'pnpm run test:public-readiness-audit',
  'pnpm run test:package-tarball',
  'pnpm run test:release-registry-dry-run',
  'pnpm run test:release-binary-attachments',
  'pnpm run test:binary',
  'pnpm run test:native-binary',
  'pnpm run test:signed-native-binary',
  'pnpm run test:release-bundle',
  'pnpm run test:release-promotion',
  'pnpm run test:release-signatures',
  'node apps/cli/src/index.mjs doctor',
  'node apps/cli/src/index.mjs doctor --profile source',
  'pnpm run test:deprecations',
  'pnpm run validate:contracts',
  'pnpm run test:smoke',
  'pnpm run test:providers',
  'pnpm test'
]) {
  assert.ok(
    artifact.release_gates.some(gate => gate.command === command),
    `missing release gate: ${command}`
  );
}

const serialized = JSON.stringify(artifact);
for (const disallowed of [
  'npm install -g divinity-code',
  'npx divinity',
  'public shared key',
  'no-signup',
  'bypass',
  'node_modules/',
  process.cwd()
]) {
  assert.equal(serialized.includes(disallowed), false, `release artifact must not include ${disallowed}`);
}

console.log(JSON.stringify({ ok: true, test: 'release-artifacts' }));
