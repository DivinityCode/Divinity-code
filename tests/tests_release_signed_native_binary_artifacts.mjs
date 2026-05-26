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
  typeof releaseArtifacts.writeReleaseSignedNativeBinaryArtifacts,
  'function',
  'release signed native binary artifact writer must be exported'
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-signed-native-binary-'));
const outputDir = path.join(tmpRoot, 'signed-native-binary');
const buildFixture = path.resolve('tests/fixtures/native-binary-build-command.mjs');
const signingFixture = path.resolve('tests/fixtures/release-signing-command.mjs');
const signedNativeEnv = {
  ...process.env,
  DIVINITY_NATIVE_BINARY_BUILD_COMMAND: process.execPath,
  DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: JSON.stringify([buildFixture]),
  DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
  DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify([signingFixture]),
  DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/native-signing-key',
  DIVINITY_RELEASE_SIGNING_IDENTITY: 'native-release@example.com'
};

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_signed_native_binary.mjs'),
    '--',
    '--output',
    outputDir
  ], {
    env: signedNativeEnv
  });

  assert.equal(result.ok, true);
  assert.equal(result.output_directory, outputDir);
  assert.equal(result.manifest_path, path.join(outputDir, 'manifest.json'));
  assert.equal(result.checksum_path, path.join(outputDir, 'SHA256SUMS'));
  assert.equal(existsSync(result.manifest_path), true);
  assert.equal(existsSync(result.checksum_path), true);

  const manifest = JSON.parse(readFileSync(result.manifest_path, 'utf8'));
  assert.deepEqual(result.manifest, manifest);
  assert.equal(manifest.format, 'divinity.release_signed_native_binary_artifacts.v1');
  assert.equal(manifest.status, 'generated');
  assert.equal(manifest.generated_by, 'packages/release-artifacts');
  assert.equal(manifest.artifact_type, 'signed_native_binary');
  assert.equal(manifest.native_binary, true);
  assert.equal(manifest.public_download_ready, false);
  assert.equal(manifest.binary_name, 'divinity');
  assert.equal(manifest.package.name, packageJson.name);
  assert.equal(manifest.package.version, packageJson.version);
  assert.equal(manifest.package.private, true);
  assert.equal(manifest.output_directory, 'dist/signed-native-binary');
  assert.equal(manifest.native_binary_manifest_path, 'native-binary/manifest.json');
  assert.equal(manifest.checksums_file, 'SHA256SUMS');
  assert.equal(manifest.checksum_algorithm, 'sha256');
  assert.equal(manifest.redacts_local_paths, true);
  assert.equal(manifest.redacts_build_command, true);
  assert.equal(manifest.redacts_signing_secrets, true);
  assert.equal(manifest.build_configuration.status, 'configured');
  assert.equal(manifest.build_configuration.command_configured, true);
  assert.equal(manifest.signing.required, true);
  assert.equal(manifest.signing.status, 'generated');
  assert.equal(manifest.signing.configuration.status, 'configured');
  assert.equal(manifest.signing.configuration.command_configured, true);
  assert.equal(manifest.signing.configuration.command_absolute, true);
  assert.equal(manifest.signing.configuration.command_args_configured, true);
  assert.equal(manifest.signing.configuration.key_ref_configured, true);
  assert.equal(manifest.signing.configuration.identity_configured, true);
  assert.deepEqual(manifest.blockers, [
    'package_private',
    'non_production_warning'
  ]);

  const nativeManifestPath = path.join(outputDir, manifest.native_binary_manifest_path);
  assert.equal(existsSync(nativeManifestPath), true);
  const nativeManifest = JSON.parse(readFileSync(nativeManifestPath, 'utf8'));
  assert.equal(nativeManifest.format, 'divinity.release_native_binary_artifacts.v1');
  assert.equal(nativeManifest.artifacts.length, 5);
  assert.equal(manifest.artifacts.length, nativeManifest.artifacts.length);
  assert.equal(manifest.signatures.length, nativeManifest.artifacts.length);
  assert.deepEqual(manifest.artifacts.map(artifact => artifact.filename), [
    'divinity-linux-x64',
    'divinity-linux-arm64',
    'divinity-darwin-x64',
    'divinity-darwin-arm64',
    'divinity-win32-x64.exe'
  ]);

  const checksumText = readFileSync(result.checksum_path, 'utf8');
  const signaturesByArtifact = new Map(
    manifest.signatures.map(signature => [signature.artifact_id, signature])
  );

  for (const artifact of manifest.artifacts) {
    assert.equal(Object.hasOwn(artifact, 'absolute_path'), false);
    assert.equal(Object.hasOwn(artifact, 'input_path'), false);
    assert.equal(artifact.artifact_id, `native_binary_${artifact.platform}_${artifact.arch}`);
    assert.equal(artifact.artifact_kind, 'native_binary');
    assert.equal(artifact.artifact_type, 'signed_native_binary');
    assert.equal(artifact.native_binary, true);
    assert.equal(artifact.status, 'signed');
    assert.equal(artifact.public_download_status, 'blocked');
    assert.equal(artifact.subject_path, `native-binary/artifacts/${artifact.filename}`);
    assert.match(artifact.subject_sha256, /^[a-f0-9]{64}$/);

    const subjectPath = path.join(outputDir, artifact.subject_path);
    assert.equal(existsSync(subjectPath), true, `missing native binary artifact: ${artifact.subject_path}`);
    assert.equal(artifact.subject_bytes, statSync(subjectPath).size);
    assert.equal(artifact.subject_sha256, sha256(subjectPath));

    const signature = signaturesByArtifact.get(artifact.artifact_id);
    assert.ok(signature, `missing signature for ${artifact.artifact_id}`);
    assert.equal(signature.artifact_kind, 'native_binary');
    assert.equal(signature.platform, artifact.platform);
    assert.equal(signature.arch, artifact.arch);
    assert.equal(signature.filename, artifact.filename);
    assert.equal(signature.subject_path, artifact.subject_path);
    assert.equal(signature.subject_sha256, artifact.subject_sha256);
    assert.equal(signature.signature_algorithm, 'test-fixture');
    assert.equal(signature.digest_algorithm, 'sha256');
    assert.equal(signature.status, 'generated');
    assert.equal(signature.signature_path, `signatures/${artifact.artifact_id}.sig`);
    assert.match(signature.signature_sha256, /^[a-f0-9]{64}$/);

    const signaturePath = path.join(outputDir, signature.signature_path);
    assert.equal(existsSync(signaturePath), true, `missing signature file: ${signature.signature_path}`);
    assert.equal(signature.signature_bytes, statSync(signaturePath).size);
    assert.equal(signature.signature_sha256, sha256(signaturePath));
    assert.ok(checksumText.includes(`${signature.signature_sha256}  ${signature.signature_path}`));
  }

  const serializedManifest = JSON.stringify(manifest);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    process.execPath,
    buildFixture,
    signingFixture,
    'secret://divinity/release/native-signing-key',
    'native-release@example.com',
    'node_modules/'
  ]) {
    assert.equal(serializedManifest.includes(disallowed), false, `signed native binary manifest must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-signed-native-binary-artifacts' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
