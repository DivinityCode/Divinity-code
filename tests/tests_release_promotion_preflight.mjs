import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

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
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-promotion-'));
const outputPath = path.join(tmpRoot, 'release-promotion-preflight.json');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_promotion_preflight.mjs'),
    '--',
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

  const preflight = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, preflight);
  assert.equal(preflight.format, 'divinity.release_promotion_preflight.v1');
  assert.equal(preflight.generated_by, 'packages/release-artifacts');
  assert.equal(preflight.status, 'blocked');
  assert.equal(preflight.public_release_ready, false);
  assert.equal(preflight.package.name, packageJson.name);
  assert.equal(preflight.package.version, packageJson.version);
  assert.equal(preflight.package.private, true);
  assert.equal(preflight.package.repository_url, packageJson.repository.url);
  assert.equal(preflight.command, 'pnpm run release:promotion-preflight');
  assert.equal(preflight.smoke_test_command, 'pnpm run test:release-promotion');
  assert.equal(preflight.redacts_local_paths, true);
  assert.equal(preflight.redacts_registry_token, true);
  assert.equal(preflight.redacts_github_token, true);
  assert.equal(preflight.redacts_signing_secrets, true);
  assert.deepEqual(preflight.blockers, [
    'package_private',
    'non_production_warning',
    'missing_registry_token',
    'missing_github_release_token',
    'missing_release_tag',
    'native_binary_build_pending',
    'signing_blocked'
  ]);

  assert.equal(preflight.registry_publish.status, 'blocked');
  assert.equal(preflight.registry_publish.registry_url, 'https://registry.npmjs.org/');
  assert.equal(preflight.registry_publish.provenance_required, true);
  assert.equal(preflight.registry_publish.token_env_var, 'NPM_TOKEN');
  assert.equal(preflight.registry_publish.token_configured, false);
  assert.equal(preflight.registry_publish.dry_run_artifact_path, 'dist/release-registry-dry-run.json');
  assert.equal(preflight.binary_distribution.status, 'blocked');
  assert.equal(preflight.binary_distribution.artifact_type, 'signed_native_binary');
  assert.equal(preflight.binary_distribution.build_command, 'pnpm run release:signed-native-binary');
  assert.equal(preflight.binary_distribution.smoke_test_command, 'pnpm run test:signed-native-binary');
  assert.equal(preflight.binary_distribution.attachment_plan_path, 'dist/release-binary-attachments.json');
  assert.equal(preflight.binary_distribution.attachment_plan_command, 'pnpm run release:binary-attachments');
  assert.equal(preflight.binary_distribution.attachment_plan_smoke_test_command, 'pnpm run test:release-binary-attachments');
  assert.equal(preflight.binary_distribution.attachment_plan_status, 'blocked');
  assert.equal(preflight.binary_distribution.provider, 'github_releases');
  assert.equal(preflight.binary_distribution.repository, 'DivinityCode/Divinity-code');
  assert.equal(preflight.binary_distribution.token_configured, false);
  assert.equal(preflight.binary_distribution.release_tag_configured, false);
  assert.equal(preflight.signing.required, true);
  assert.equal(preflight.signing.status, 'blocked');
  assert.equal(preflight.signing.configuration.status, 'not_configured');
  assert.equal(preflight.signing.configuration.ready_when_release_gates_clear, false);

  const requiredArtifactsById = new Map(preflight.required_artifacts.map(artifact => [artifact.artifact_id, artifact]));
  assert.equal(requiredArtifactsById.get('release_artifacts_manifest').path, 'dist/release-artifacts.json');
  assert.equal(requiredArtifactsById.get('public_readiness_audit').path, 'dist/release-public-readiness-audit.json');
  assert.equal(requiredArtifactsById.get('release_environment_readiness').path, 'dist/release-environment-readiness.json');
  assert.equal(requiredArtifactsById.get('registry_publish_dry_run_report').path, 'dist/release-registry-dry-run.json');
  assert.equal(requiredArtifactsById.get('binary_attachment_plan').path, 'dist/release-binary-attachments.json');
  assert.equal(requiredArtifactsById.get('release_candidate_bundle_manifest').path, 'dist/release-bundle/manifest.json');
  assert.equal(requiredArtifactsById.get('release_attestation').path, 'dist/release-bundle/attestation.json');
  assert.equal(requiredArtifactsById.get('binary_artifacts_manifest').path, 'dist/binary/manifest.json');
  assert.equal(requiredArtifactsById.get('native_binary_artifacts_manifest').path, 'dist/native-binary/manifest.json');
  assert.equal(requiredArtifactsById.get('signed_native_binary_artifacts_manifest').path, 'dist/signed-native-binary/manifest.json');
  for (const artifact of preflight.required_artifacts) {
    assert.equal(Object.hasOwn(artifact, 'absolute_path'), false);
    assert.equal(artifact.required, true);
    assert.equal(typeof artifact.command, 'string');
  }

  for (const command of [
    'pnpm run test:package',
    'pnpm run test:package-tarball',
    'pnpm run test:public-readiness-audit',
    'pnpm run test:release-environment-readiness',
    'pnpm run test:release-registry-dry-run',
    'pnpm run test:release-binary-attachments',
    'pnpm run test:binary',
    'pnpm run test:native-binary',
    'pnpm run test:signed-native-binary',
    'pnpm run test:release-bundle',
    'pnpm run test:release-artifacts',
    'pnpm run test:release-status',
    'pnpm run test:release-promotion-execute',
    'pnpm run validate:contracts',
    'pnpm run test:smoke',
    'pnpm test'
  ]) {
    assert.ok(
      preflight.release_gates.some(gate => gate.command === command && gate.required === true),
      `missing promotion release gate: ${command}`
    );
  }

  const configuredOutputPath = path.join(tmpRoot, 'configured-release-promotion-preflight.json');
  const configured = runJson(process.execPath, [
    path.resolve('tests/scripts_release_promotion_preflight.mjs'),
    '--output',
    configuredOutputPath
  ], {
    env: {
      ...process.env,
      NPM_TOKEN: 'npm-secret-token-value',
      GITHUB_TOKEN: 'github-release-secret-value',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: 'v0.1.0',
      DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
      DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
      DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
      DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
    }
  });
  assert.equal(configured.artifact.registry_publish.token_configured, true);
  assert.equal(configured.artifact.binary_distribution.token_configured, true);
  assert.equal(configured.artifact.binary_distribution.release_tag_configured, true);
  assert.equal(configured.artifact.signing.configuration.status, 'configured');
  assert.equal(configured.artifact.signing.configuration.ready_when_release_gates_clear, true);
  assert.equal(configured.artifact.blockers.includes('missing_registry_token'), false);
  assert.equal(configured.artifact.blockers.includes('missing_github_release_token'), false);
  assert.equal(configured.artifact.blockers.includes('missing_release_tag'), false);
  assert.ok(configured.artifact.blockers.includes('package_private'));
  assert.ok(configured.artifact.blockers.includes('non_production_warning'));
  assert.ok(configured.artifact.blockers.includes('native_binary_build_pending'));
  assert.ok(configured.artifact.blockers.includes('signing_blocked'));

  const serialized = JSON.stringify([preflight, configured.artifact]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'node_modules/',
    'secret://',
    'npm-secret-token-value',
    'github-release-secret-value',
    'v0.1.0',
    'release@example.com',
    'DIVINITY_RELEASE_SIGNING_KEY_REF',
    'DIVINITY_RELEASE_SIGNING_IDENTITY'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `promotion preflight must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-promotion-preflight' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
