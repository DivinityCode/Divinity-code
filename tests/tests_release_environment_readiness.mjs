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

assert.equal(typeof releaseArtifacts.buildReleaseEnvironmentReadiness, 'function');
assert.equal(typeof releaseArtifacts.writeReleaseEnvironmentReadiness, 'function');
assert.equal(
  releaseArtifacts.DEFAULT_RELEASE_ENVIRONMENT_READINESS_OUTPUT,
  path.join('dist', 'release-environment-readiness.json')
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-environment-readiness-'));
const outputPath = path.join(tmpRoot, 'release-environment-readiness.json');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_environment_readiness.mjs'),
    '--output',
    outputPath
  ], {
    env: {
      ...process.env,
      NPM_TOKEN: '',
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: '',
      DIVINITY_PUBLIC_RELEASE_CONFIRM: '',
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND: '',
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: '',
      DIVINITY_RELEASE_SIGNING_COMMAND: '',
      DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: '',
      DIVINITY_RELEASE_SIGNING_KEY_REF: '',
      DIVINITY_RELEASE_SIGNING_IDENTITY: ''
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact_path, outputPath);
  assert.equal(existsSync(outputPath), true);

  const readiness = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, readiness);
  assert.equal(readiness.format, 'divinity.release_environment_readiness.v1');
  assert.equal(readiness.generated_by, 'packages/release-artifacts');
  assert.equal(readiness.status, 'blocked');
  assert.equal(readiness.public_release_ready, false);
  assert.equal(readiness.environment_ready, false);
  assert.equal(readiness.command, 'pnpm run release:environment-readiness');
  assert.equal(readiness.smoke_test_command, 'pnpm run test:release-environment-readiness');
  assert.equal(readiness.package.name, packageJson.name);
  assert.equal(readiness.package.version, packageJson.version);
  assert.equal(readiness.package.private, true);
  assert.equal(readiness.non_production_warning_active, true);
  assert.deepEqual(readiness.blockers, [
    'package_private',
    'non_production_warning',
    'missing_registry_token',
    'missing_github_release_token',
    'missing_release_tag',
    'native_binary_build_pending',
    'signing_blocked',
    'missing_public_release_confirmation'
  ]);

  assert.equal(readiness.package_privacy.status, 'blocked');
  assert.equal(readiness.production_warning.status, 'blocked');
  assert.equal(readiness.registry_token.env_var, 'NPM_TOKEN');
  assert.equal(readiness.registry_token.configured, false);
  assert.equal(readiness.github_release_token.configured, false);
  assert.deepEqual(readiness.github_release_token.env_vars, ['GITHUB_TOKEN', 'GH_TOKEN']);
  assert.equal(readiness.github_release_tag.env_var, 'DIVINITY_RELEASE_TAG');
  assert.equal(readiness.github_release_tag.configured, false);
  assert.equal(readiness.public_release_confirmation.env_var, 'DIVINITY_PUBLIC_RELEASE_CONFIRM');
  assert.equal(readiness.public_release_confirmation.configured, false);
  assert.equal(readiness.public_release_confirmation.required_value, 'publish');
  assert.equal(readiness.native_binary_build.status, 'not_configured');
  assert.equal(readiness.native_binary_build.command_configured, false);
  assert.equal(readiness.native_binary_build.command_absolute, false);
  assert.equal(readiness.release_signing.status, 'not_configured');
  assert.equal(readiness.release_signing.configuration.command_configured, false);
  assert.equal(readiness.release_signing.configuration.ready_when_release_gates_clear, false);
  assert.equal(readiness.does_not_publish, true);
  assert.equal(readiness.does_not_upload, true);
  assert.equal(readiness.redacts_local_paths, true);
  assert.equal(readiness.redacts_registry_token, true);
  assert.equal(readiness.redacts_github_token, true);
  assert.equal(readiness.redacts_release_tag, true);
  assert.equal(readiness.redacts_command_paths, true);
  assert.equal(readiness.redacts_signing_secrets, true);

  const configured = releaseArtifacts.buildReleaseEnvironmentReadiness({
    packageJson: {
      ...packageJson,
      private: false
    },
    publishingBlocked: false,
    warningActive: false,
    env: {
      ...process.env,
      NPM_TOKEN: 'npm-secret-token-value',
      GITHUB_TOKEN: 'github-release-secret-value',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: 'v0.1.0',
      DIVINITY_PUBLIC_RELEASE_CONFIRM: 'publish',
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND: process.execPath,
      DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS: JSON.stringify(['--version']),
      DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
      DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
      DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
      DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
    }
  });
  assert.equal(configured.status, 'ready');
  assert.equal(configured.environment_ready, true);
  assert.equal(configured.public_release_ready, false);
  assert.deepEqual(configured.blockers, []);
  assert.equal(configured.package.private, false);
  assert.equal(configured.non_production_warning_active, false);
  assert.equal(configured.registry_token.configured, true);
  assert.equal(configured.github_release_token.configured, true);
  assert.equal(configured.github_release_tag.configured, true);
  assert.equal(configured.public_release_confirmation.configured, true);
  assert.equal(configured.native_binary_build.status, 'configured');
  assert.equal(configured.native_binary_build.command_configured, true);
  assert.equal(configured.native_binary_build.command_absolute, true);
  assert.equal(configured.release_signing.status, 'configured');
  assert.equal(configured.release_signing.configuration.command_configured, true);
  assert.equal(configured.release_signing.configuration.ready_when_release_gates_clear, true);

  const serialized = JSON.stringify([readiness, configured]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'node_modules/',
    'secret://',
    'npm-secret-token-value',
    'github-release-secret-value',
    'v0.1.0',
    'release@example.com',
    process.execPath,
    'DIVINITY_RELEASE_SIGNING_KEY_REF',
    'DIVINITY_RELEASE_SIGNING_IDENTITY'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `release environment readiness must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-environment-readiness' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
