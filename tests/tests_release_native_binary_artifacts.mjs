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
  typeof releaseArtifacts.writeReleaseNativeBinaryArtifacts,
  'function',
  'release native binary artifact writer must be exported'
);

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-native-binary-'));
const outputDir = path.join(tmpRoot, 'native-binary');
const buildFixture = path.resolve('tests/fixtures/native-binary-build-command.mjs');
const buildEnv = {
  ...process.env,
  DIVINITY_NATIVE_BINARY_BUILD_COMMAND: process.execPath,
  DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: JSON.stringify([buildFixture])
};

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_native_binary.mjs'),
    '--',
    '--output',
    outputDir
  ], {
    env: buildEnv
  });

  assert.equal(result.ok, true);
  assert.equal(result.output_directory, outputDir);
  assert.equal(result.manifest_path, path.join(outputDir, 'manifest.json'));
  assert.equal(result.checksum_path, path.join(outputDir, 'SHA256SUMS'));
  assert.equal(existsSync(result.manifest_path), true);
  assert.equal(existsSync(result.checksum_path), true);

  const manifest = JSON.parse(readFileSync(result.manifest_path, 'utf8'));
  assert.deepEqual(result.manifest, manifest);
  assert.equal(manifest.format, 'divinity.release_native_binary_artifacts.v1');
  assert.equal(manifest.status, 'generated');
  assert.equal(manifest.generated_by, 'packages/release-artifacts');
  assert.equal(manifest.artifact_type, 'native_binary');
  assert.equal(manifest.native_binary, true);
  assert.equal(manifest.public_download_ready, false);
  assert.equal(manifest.binary_name, 'divinity');
  assert.equal(manifest.output_directory, 'dist/native-binary');
  assert.equal(manifest.checksums_file, 'SHA256SUMS');
  assert.equal(manifest.checksum_algorithm, 'sha256');
  assert.equal(manifest.signing_required, true);
  assert.equal(manifest.signature_status, 'unsigned');
  assert.equal(manifest.redacts_local_paths, true);
  assert.equal(manifest.redacts_build_command, true);
  assert.equal(manifest.redacts_signing_secrets, true);
  assert.equal(manifest.build_configuration.status, 'configured');
  assert.equal(manifest.build_configuration.command_configured, true);
  assert.equal(manifest.build_configuration.command_absolute, true);
  assert.equal(manifest.build_configuration.command_args_configured, true);
  assert.deepEqual(manifest.blockers, [
    'package_private',
    'non_production_warning',
    'signing_blocked'
  ]);
  assert.deepEqual(manifest.artifacts.map(artifact => artifact.filename), [
    'divinity-linux-x64',
    'divinity-linux-arm64',
    'divinity-darwin-x64',
    'divinity-darwin-arm64',
    'divinity-win32-x64.exe'
  ]);

  const checksumText = readFileSync(result.checksum_path, 'utf8');
  for (const artifact of manifest.artifacts) {
    assert.equal(Object.hasOwn(artifact, 'absolute_path'), false);
    assert.equal(Object.hasOwn(artifact, 'input_path'), false);
    assert.equal(artifact.status, 'generated');
    assert.equal(artifact.artifact_type, 'native_binary');
    assert.equal(artifact.native_binary, true);
    assert.equal(artifact.public_download_status, 'blocked');
    assert.equal(artifact.path, `artifacts/${artifact.filename}`);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);

    const artifactPath = path.join(outputDir, artifact.path);
    assert.equal(existsSync(artifactPath), true, `missing native binary artifact: ${artifact.path}`);
    assert.equal(artifact.bytes, statSync(artifactPath).size);
    assert.equal(artifact.sha256, sha256(artifactPath));
    assert.ok(checksumText.includes(`${artifact.sha256}  ${artifact.path}`));
  }

  const serializedManifest = JSON.stringify(manifest);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    process.execPath,
    buildFixture,
    'node_modules/',
    'secret://'
  ]) {
    assert.equal(serializedManifest.includes(disallowed), false, `native binary manifest must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-native-binary-artifacts' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
