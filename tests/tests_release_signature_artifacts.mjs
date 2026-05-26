import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const releaseArtifacts = await import('../packages/release-artifacts/src/index.mjs');

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

assert.equal(
  typeof releaseArtifacts.writeReleaseSignatureArtifacts,
  'function',
  'release signature artifact writer must be exported'
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-signatures-'));
const outputDir = path.join(tmpRoot, 'signatures');
const signingFixture = path.resolve('tests/fixtures/release-signing-command.mjs');
const signingEnv = {
  ...process.env,
  DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
  DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify([signingFixture]),
  DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
  DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
};

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_signatures.mjs'),
    '--',
    '--output',
    outputDir
  ], {
    env: signingEnv
  });

  assert.equal(result.ok, true);
  assert.equal(result.output_directory, outputDir);
  assert.equal(result.manifest_path, path.join(outputDir, 'manifest.json'));
  assert.equal(result.checksum_path, path.join(outputDir, 'SHA256SUMS'));
  assert.equal(existsSync(result.manifest_path), true);
  assert.equal(existsSync(result.checksum_path), true);

  const manifest = JSON.parse(readFileSync(result.manifest_path, 'utf8'));
  assert.deepEqual(result.manifest, manifest);
  assert.equal(manifest.format, 'divinity.release_signature_artifacts.v1');
  assert.equal(manifest.status, 'generated');
  assert.equal(manifest.public_release_ready, false);
  assert.equal(manifest.generated_by, 'packages/release-artifacts');
  assert.equal(manifest.package.name, packageJson.name);
  assert.equal(manifest.package.version, packageJson.version);
  assert.equal(manifest.package.private, true);
  assert.equal(manifest.output_directory, 'dist/release-signatures');
  assert.equal(manifest.bundle_manifest_path, 'dist/release-bundle/manifest.json');
  assert.equal(manifest.checksums_file, 'SHA256SUMS');
  assert.equal(manifest.checksum_algorithm, 'sha256');
  assert.equal(manifest.redacts_local_paths, true);
  assert.equal(manifest.redacts_signing_secrets, true);
  assert.equal(manifest.signing.configuration.status, 'configured');
  assert.equal(manifest.signing.configuration.command_configured, true);
  assert.equal(manifest.signing.configuration.command_absolute, true);
  assert.equal(manifest.signing.configuration.command_args_configured, true);
  assert.equal(manifest.signing.configuration.key_ref_configured, true);
  assert.equal(manifest.signing.configuration.identity_configured, true);
  assert.equal(manifest.signing.configuration.ready_when_release_gates_clear, true);
  assert.deepEqual(manifest.blockers, [
    'package_private',
    'non_production_warning',
    'native_binary_build_pending',
    'signing_blocked'
  ]);

  const signaturesByArtifact = new Map(
    manifest.signatures.map(signature => [signature.artifact_id, signature])
  );
  for (const artifactId of [
    'release_artifacts_manifest',
    'package_tarball',
    'binary_artifacts_manifest',
    'binary_checksums',
    'release_attestation',
    'bundle_checksums'
  ]) {
    assert.ok(signaturesByArtifact.has(artifactId), `missing signature for ${artifactId}`);
  }

  const checksumText = readFileSync(result.checksum_path, 'utf8');
  for (const signature of manifest.signatures) {
    assert.equal(Object.hasOwn(signature, 'absolute_path'), false);
    assert.equal(Object.hasOwn(signature, 'input_path'), false);
    assert.equal(signature.signature_algorithm, 'test-fixture');
    assert.equal(signature.digest_algorithm, 'sha256');
    assert.match(signature.subject_sha256, /^[a-f0-9]{64}$/);
    assert.match(signature.signature_sha256, /^[a-f0-9]{64}$/);
    assert.equal(signature.signature_path, `signatures/${signature.artifact_id}.sig`);

    const signaturePath = path.join(outputDir, signature.signature_path);
    assert.equal(existsSync(signaturePath), true, `missing signature file: ${signature.signature_path}`);
    assert.equal(signature.signature_bytes, statSync(signaturePath).size);
    assert.equal(signature.signature_sha256, sha256(signaturePath));
    assert.ok(checksumText.includes(`${signature.signature_sha256}  ${signature.signature_path}`));
  }

  const packageSignature = signaturesByArtifact.get('package_tarball');
  assert.equal(packageSignature.artifact_kind, 'package_tarball');
  assert.equal(packageSignature.subject_path, `package/${packageJson.name}-${packageJson.version}.tgz`);

  const serializedManifest = JSON.stringify(manifest);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    process.execPath,
    signingFixture,
    'secret://divinity/release/signing-key',
    'release@example.com',
    'node_modules/'
  ]) {
    assert.equal(serializedManifest.includes(disallowed), false, `signature manifest must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-signature-artifacts' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
