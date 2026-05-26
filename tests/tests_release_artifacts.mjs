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
const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-release-artifacts-'));
const outputPath = path.join(tmpDir, 'release-artifacts.json');

const output = execFileSync(
  process.execPath,
  [path.resolve('tests/scripts_release_artifacts.mjs'), '--output', outputPath],
  { cwd: process.cwd(), encoding: 'utf8' }
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
assert.equal(JSON.stringify(configuredSigningArtifact).includes('secret://divinity/release/signing-key'), false);
assert.equal(JSON.stringify(configuredSigningArtifact).includes('release@example.com'), false);

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
  'pnpm run test:package-tarball',
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
  'bypass'
]) {
  assert.equal(serialized.includes(disallowed), false, `release artifact must not include ${disallowed}`);
}

console.log(JSON.stringify({ ok: true, test: 'release-artifacts' }));
