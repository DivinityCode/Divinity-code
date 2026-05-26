import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function sha256(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
}

function runJson(command, args, options = {}) {
  const output = execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
  return JSON.parse(output);
}

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-bundle-'));
const outputDir = path.join(tmpRoot, 'bundle');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_bundle.mjs'),
    '--',
    '--output',
    outputDir
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.output_directory, outputDir);
  assert.equal(result.manifest_path, path.join(outputDir, 'manifest.json'));
  assert.equal(result.checksum_path, path.join(outputDir, 'SHA256SUMS'));
  assert.equal(existsSync(result.manifest_path), true);
  assert.equal(existsSync(result.checksum_path), true);

  const manifest = JSON.parse(readFileSync(result.manifest_path, 'utf8'));
  assert.deepEqual(result.manifest, manifest);
  assert.equal(manifest.format, 'divinity.release_candidate_bundle.v1');
  assert.equal(manifest.status, 'generated');
  assert.equal(manifest.public_release_ready, false);
  assert.equal(manifest.package.name, packageJson.name);
  assert.equal(manifest.package.version, packageJson.version);
  assert.equal(manifest.package.private, true);
  assert.equal(manifest.output_directory, 'dist/release-bundle');
  assert.equal(manifest.checksums_file, 'SHA256SUMS');
  assert.equal(manifest.checksum_algorithm, 'sha256');
  assert.equal(manifest.redacts_local_paths, true);
  assert.equal(manifest.redacts_signing_secrets, true);
  assert.deepEqual(manifest.blockers, [
    'package_private',
    'non_production_warning',
    'native_binary_build_pending',
    'signing_blocked'
  ]);

  for (const expectedPath of [
    'attestation.json',
    'release-artifacts.json',
    `package/${packageJson.name}-${packageJson.version}.tgz`,
    'binary/manifest.json',
    'binary/SHA256SUMS'
  ]) {
    assert.ok(
      manifest.artifacts.some(artifact => artifact.path === expectedPath),
      `missing bundle artifact: ${expectedPath}`
    );
    assert.equal(existsSync(path.join(outputDir, expectedPath)), true, `missing file: ${expectedPath}`);
  }

  const artifactsById = new Map(manifest.artifacts.map(artifact => [artifact.artifact_id, artifact]));
  assert.equal(artifactsById.get('package_tarball').artifact_kind, 'package_tarball');
  assert.equal(artifactsById.get('package_tarball').path, `package/${packageJson.name}-${packageJson.version}.tgz`);
  assert.equal(artifactsById.get('release_artifacts_manifest').artifact_kind, 'release_artifacts_manifest');
  assert.equal(artifactsById.get('release_attestation').artifact_kind, 'release_attestation');
  assert.equal(artifactsById.get('release_attestation').path, 'attestation.json');
  assert.equal(artifactsById.get('binary_artifacts_manifest').artifact_kind, 'binary_artifacts_manifest');
  assert.equal(artifactsById.get('bundle_checksums').artifact_kind, 'checksum_manifest');

  const checksumText = readFileSync(result.checksum_path, 'utf8');
  for (const artifact of manifest.artifacts) {
    assert.equal(Object.hasOwn(artifact, 'absolute_path'), false);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    const artifactPath = path.join(outputDir, artifact.path);
    assert.equal(existsSync(artifactPath), true, `missing bundle file: ${artifact.path}`);
    assert.equal(artifact.bytes, statSync(artifactPath).size);
    assert.equal(artifact.sha256, sha256(artifactPath));
    if (artifact.artifact_id !== 'bundle_checksums') {
      assert.ok(checksumText.includes(`${artifact.sha256}  ${artifact.path}`));
    }
  }

  const releaseArtifact = JSON.parse(readFileSync(path.join(outputDir, 'release-artifacts.json'), 'utf8'));
  assert.equal(releaseArtifact.format, 'divinity.release_artifacts.v1');
  assert.equal(releaseArtifact.package.name, packageJson.name);

  const binaryManifest = JSON.parse(readFileSync(path.join(outputDir, 'binary', 'manifest.json'), 'utf8'));
  assert.equal(binaryManifest.format, 'divinity.release_binary_artifacts.v1');
  assert.equal(binaryManifest.native_binary, false);

  const attestation = JSON.parse(readFileSync(path.join(outputDir, 'attestation.json'), 'utf8'));
  assert.equal(attestation.format, 'divinity.release_attestation.v1');
  assert.equal(attestation.generated_by, 'packages/release-artifacts');
  assert.equal(attestation.status, 'generated');
  assert.equal(attestation.predicate_type, 'divinity.release_candidate_bundle.provenance.v1');
  assert.equal(attestation.public_release_ready, false);
  assert.equal(attestation.package.name, packageJson.name);
  assert.equal(attestation.package.version, packageJson.version);
  assert.equal(attestation.package.private, true);
  assert.equal(attestation.source_provenance.format, 'divinity.release_source_provenance.v1');
  assert.equal(attestation.release_metadata.path, 'release-artifacts.json');
  assert.match(attestation.release_metadata.sha256, /^[a-f0-9]{64}$/);
  assert.equal(attestation.release_metadata.sha256, sha256(path.join(outputDir, 'release-artifacts.json')));
  assert.equal(attestation.release_metadata.bytes, statSync(path.join(outputDir, 'release-artifacts.json')).size);
  assert.equal(attestation.release_metadata.format, 'divinity.release_artifacts.v1');
  assert.equal(attestation.build.build_type, 'local_release_candidate_bundle');
  assert.ok(attestation.build.commands.includes('pnpm run release:bundle'));
  assert.equal(attestation.signing.required, true);
  assert.equal(attestation.signing.status, 'blocked');
  assert.equal(attestation.signing.redacts_signing_secrets, true);
  assert.deepEqual(attestation.blockers, [
    'package_private',
    'non_production_warning',
    'native_binary_build_pending',
    'signing_blocked'
  ]);
  assert.equal(attestation.redacts_local_paths, true);
  assert.equal(attestation.redacts_signing_secrets, true);
  assert.equal(attestation.subject_count, attestation.subjects.length);
  assert.ok(attestation.subjects.some(subject => (
    subject.artifact_id === 'package_tarball' &&
    subject.artifact_kind === 'package_tarball' &&
    subject.path === `package/${packageJson.name}-${packageJson.version}.tgz`
  )));
  assert.ok(attestation.subjects.some(subject => (
    subject.artifact_id === 'binary_artifacts_manifest' &&
    subject.path === 'binary/manifest.json'
  )));
  assert.equal(attestation.subjects.some(subject => subject.artifact_id === 'release_attestation'), false);
  for (const subject of attestation.subjects) {
    assert.equal(Object.hasOwn(subject, 'absolute_path'), false);
    assert.match(subject.sha256, /^[a-f0-9]{64}$/);
    const subjectPath = path.join(outputDir, subject.path);
    assert.equal(existsSync(subjectPath), true, `missing attestation subject: ${subject.path}`);
    assert.equal(subject.bytes, statSync(subjectPath).size);
    assert.equal(subject.sha256, sha256(subjectPath));
  }

  const serializedManifest = JSON.stringify(manifest);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'node_modules/',
    'secret://'
  ]) {
    assert.equal(serializedManifest.includes(disallowed), false, `bundle manifest must not include ${disallowed}`);
  }

  const serializedAttestation = JSON.stringify(attestation);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'node_modules/',
    'secret://',
    'NPM_TOKEN',
    'DIVINITY_RELEASE_SIGNING_KEY_REF',
    'DIVINITY_RELEASE_SIGNING_IDENTITY'
  ]) {
    assert.equal(serializedAttestation.includes(disallowed), false, `attestation must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-candidate-bundle' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
