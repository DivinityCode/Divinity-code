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

function currentLauncherFilename() {
  if (process.platform === 'linux' && process.arch === 'x64') return 'divinity-linux-x64';
  if (process.platform === 'linux' && process.arch === 'arm64') return 'divinity-linux-arm64';
  if (process.platform === 'darwin' && process.arch === 'x64') return 'divinity-darwin-x64';
  if (process.platform === 'darwin' && process.arch === 'arm64') return 'divinity-darwin-arm64';
  if (process.platform === 'win32' && process.arch === 'x64') return 'divinity-win32-x64.cmd';
  return '';
}

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-binary-'));
const outputDir = path.join(tmpRoot, 'binary');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_binary.mjs'),
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
  assert.equal(manifest.format, 'divinity.release_binary_artifacts.v1');
  assert.equal(manifest.status, 'generated');
  assert.equal(manifest.artifact_type, 'node_launcher');
  assert.equal(manifest.native_binary, false);
  assert.equal(manifest.public_download_ready, false);
  assert.equal(manifest.binary_name, 'divinity');
  assert.equal(manifest.output_directory, 'dist/binary');
  assert.equal(manifest.checksums_file, 'SHA256SUMS');
  assert.equal(manifest.checksum_algorithm, 'sha256');
  assert.equal(manifest.redacts_local_paths, true);
  assert.equal(manifest.redacts_signing_secrets, true);
  assert.equal(manifest.artifacts.length, 5);
  assert.deepEqual(manifest.artifacts.map(artifact => artifact.filename), [
    'divinity-linux-x64',
    'divinity-linux-arm64',
    'divinity-darwin-x64',
    'divinity-darwin-arm64',
    'divinity-win32-x64.cmd'
  ]);

  const checksumText = readFileSync(result.checksum_path, 'utf8');
  for (const artifact of manifest.artifacts) {
    assert.equal(artifact.status, 'generated');
    assert.equal(artifact.native_binary, false);
    assert.match(artifact.sha256, /^[a-f0-9]{64}$/);
    assert.equal(artifact.path, artifact.filename);
    assert.equal(Object.hasOwn(artifact, 'absolute_path'), false);
    const artifactPath = path.join(outputDir, artifact.filename);
    assert.equal(existsSync(artifactPath), true, `missing binary artifact: ${artifact.filename}`);
    assert.equal(artifact.bytes, statSync(artifactPath).size);
    assert.equal(artifact.sha256, sha256(artifactPath));
    assert.ok(checksumText.includes(`${artifact.sha256}  ${artifact.filename}`));
    if (artifact.launcher_kind === 'posix_shell') {
      assert.equal(Boolean(statSync(artifactPath).mode & 0o111), true, `${artifact.filename} must be executable`);
    }
  }

  const currentLauncher = currentLauncherFilename();
  if (currentLauncher) {
    const doctor = runJson(path.join(outputDir, currentLauncher), ['doctor'], {
      env: {
        ...process.env,
        DIVINITY_BINARY_SOURCE_ROOT: process.cwd()
      }
    });
    assert.equal(doctor.ok, true);
    assert.equal(doctor.command, 'doctor');
    assert.equal(doctor.profile, 'runtime');
  }

  const serializedManifest = JSON.stringify(manifest);
  assert.equal(serializedManifest.includes(process.cwd()), false);
  assert.equal(serializedManifest.includes(tmpRoot), false);
  assert.equal(serializedManifest.includes('secret://'), false);

  console.log(JSON.stringify({ ok: true, test: 'release-binary-artifacts' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
