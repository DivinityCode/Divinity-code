import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const releaseArtifacts = await import('../packages/release-artifacts/src/index.mjs');

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
  typeof releaseArtifacts.writeReleaseRegistryPublishDryRun,
  'function',
  'release registry publish dry-run writer must be exported'
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-registry-dry-run-'));
const outputPath = path.join(tmpRoot, 'release-registry-dry-run.json');
const fixture = path.resolve('tests/fixtures/registry-publish-dry-run-command.mjs');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_registry_publish_dry_run.mjs'),
    '--',
    '--output',
    outputPath
  ]);

  assert.equal(result.ok, true);
  assert.equal(result.artifact_path, outputPath);
  assert.equal(existsSync(outputPath), true);

  const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, artifact);
  assert.equal(artifact.format, 'divinity.release_registry_publish_dry_run.v1');
  assert.equal(artifact.generated_by, 'packages/release-artifacts');
  assert.equal(artifact.status, 'blocked');
  assert.equal(artifact.public_release_ready, false);
  assert.equal(artifact.registry_publish_ready, false);
  assert.equal(artifact.package.name, packageJson.name);
  assert.equal(artifact.package.version, packageJson.version);
  assert.equal(artifact.package.private, true);
  assert.equal(artifact.registry_url, 'https://registry.npmjs.org/');
  assert.equal(artifact.provenance_required, true);
  assert.equal(artifact.publish_command, 'npm publish --provenance --access public');
  assert.equal(artifact.dry_run_command, 'npm publish --dry-run --provenance --access public');
  assert.deepEqual(artifact.npm_args, [
    'publish',
    '--dry-run',
    '--provenance',
    '--access',
    'public',
    '--json'
  ]);
  assert.equal(artifact.token_env_var, 'NPM_TOKEN');
  assert.equal(artifact.token_configured, false);
  assert.equal(artifact.dry_run_executed, false);
  assert.deepEqual(artifact.dry_run_result, {
    status: 'skipped',
    reason: 'Registry dry-run is skipped while release blockers remain.'
  });
  assert.deepEqual(artifact.blockers, [
    'package_private',
    'non_production_warning',
    'missing_registry_token'
  ]);
  assert.equal(artifact.redacts_token, true);
  assert.equal(artifact.redacts_local_paths, true);
  assert.equal(artifact.redacts_npm_output, true);

  const readyOutputPath = path.join(tmpRoot, 'ready-release-registry-dry-run.json');
  const ready = releaseArtifacts.writeReleaseRegistryPublishDryRun({
    output: readyOutputPath,
    cwd: process.cwd(),
    packageJson: {
      ...packageJson,
      private: false
    },
    publishingBlocked: false,
    warningActive: false,
    env: {
      ...process.env,
      NPM_TOKEN: 'npm-secret-token-value'
    },
    npmCommand: process.execPath,
    npmCommandArgsPrefix: [fixture]
  });

  assert.equal(ready.ok, true);
  assert.equal(ready.artifact_path, readyOutputPath);
  assert.equal(existsSync(readyOutputPath), true);
  assert.equal(ready.artifact.status, 'executed');
  assert.equal(ready.artifact.public_release_ready, false);
  assert.equal(ready.artifact.registry_publish_ready, true);
  assert.equal(ready.artifact.package.private, false);
  assert.equal(ready.artifact.token_configured, true);
  assert.equal(ready.artifact.dry_run_executed, true);
  assert.deepEqual(ready.artifact.blockers, []);
  assert.equal(ready.artifact.dry_run_result.status, 'executed');
  assert.equal(ready.artifact.dry_run_result.exit_code, 0);
  assert.equal(ready.artifact.dry_run_result.parsed_json, true);
  assert.equal(ready.artifact.dry_run_result.stdout_bytes > 0, true);
  assert.match(ready.artifact.dry_run_result.stdout_sha256, /^[a-f0-9]{64}$/);

  const serialized = JSON.stringify([artifact, ready.artifact]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    fixture,
    'npm-secret-token-value',
    'node_modules/'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `registry dry-run artifact must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-registry-publish-dry-run' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
