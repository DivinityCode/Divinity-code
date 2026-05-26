import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
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

assert.equal(typeof releaseArtifacts.buildReleasePromotionExecution, 'function');
assert.equal(typeof releaseArtifacts.writeReleasePromotionExecution, 'function');
assert.equal(
  releaseArtifacts.DEFAULT_RELEASE_PROMOTION_EXECUTION_OUTPUT,
  path.join('dist', 'release-promotion-execution.json')
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-promotion-execution-'));
const outputPath = path.join(tmpRoot, 'release-promotion-execution.json');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_promotion_execution.mjs'),
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

  const execution = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, execution);
  assert.equal(execution.format, 'divinity.release_promotion_execution.v1');
  assert.equal(execution.generated_by, 'packages/release-artifacts');
  assert.equal(execution.status, 'blocked');
  assert.equal(execution.public_release_ready, false);
  assert.equal(execution.execution_attempted, false);
  assert.equal(execution.command, 'pnpm run release:promotion-execute');
  assert.equal(execution.smoke_test_command, 'pnpm run test:release-promotion-execute');
  assert.equal(execution.package.name, packageJson.name);
  assert.equal(execution.package.version, packageJson.version);
  assert.equal(execution.package.private, true);
  assert.equal(execution.confirmation_env_var, 'DIVINITY_PUBLIC_RELEASE_CONFIRM');
  assert.equal(execution.confirmation_configured, false);
  assert.equal(execution.registry_publish.token_configured, false);
  assert.equal(execution.registry_publish.publish_command, 'npm publish --provenance --access public --json');
  assert.equal(execution.binary_upload.provider, 'github_releases');
  assert.equal(execution.binary_upload.repository, 'DivinityCode/Divinity-code');
  assert.equal(execution.binary_upload.release_tag_configured, false);
  assert.equal(execution.binary_upload.token_configured, false);
  assert.equal(execution.binary_upload.upload_command, 'gh release upload "$DIVINITY_RELEASE_TAG" dist/signed-native-binary/* --repo DivinityCode/Divinity-code --clobber');
  assert.deepEqual(execution.blockers, [
    'package_private',
    'non_production_warning',
    'missing_registry_token',
    'missing_github_release_token',
    'missing_release_tag',
    'native_binary_build_pending',
    'signing_blocked',
    'missing_public_release_confirmation'
  ]);
  assert.deepEqual(execution.steps.map(step => [step.step_id, step.status]), [
    ['registry_publish', 'skipped'],
    ['binary_attachment_upload', 'skipped']
  ]);
  assert.equal(execution.does_not_publish_without_clearance, true);
  assert.equal(execution.does_not_upload_without_clearance, true);
  assert.equal(execution.redacts_local_paths, true);
  assert.equal(execution.redacts_registry_token, true);
  assert.equal(execution.redacts_github_token, true);
  assert.equal(execution.redacts_release_tag, true);
  assert.equal(execution.redacts_npm_output, true);
  assert.equal(execution.redacts_command_paths, true);
  assert.equal(execution.redacts_signing_secrets, true);

  const callsPath = path.join(tmpRoot, 'calls.jsonl');
  const mockCommandPath = path.join(tmpRoot, 'mock-promotion-command.mjs');
  writeFileSync(mockCommandPath, [
    'import { appendFileSync } from "fs";',
    'const [, , callsPath, kind, ...args] = process.argv;',
    'appendFileSync(callsPath, `${JSON.stringify({ kind, args, tokenConfigured: Boolean(process.env.NPM_TOKEN || process.env.GITHUB_TOKEN || process.env.GH_TOKEN) })}\\n`);',
    'process.stdout.write(`${JSON.stringify({ ok: true, kind })}\\n`);',
    ''
  ].join('\n'));

  const configured = releaseArtifacts.writeReleasePromotionExecution({
    output: path.join(tmpRoot, 'configured-release-promotion-execution.json'),
    cwd: process.cwd(),
    packageJson: {
      ...packageJson,
      private: false
    },
    publishingBlocked: false,
    warningActive: false,
    nativeBinaryBlocked: false,
    signingBlocked: false,
    env: {
      ...process.env,
      NPM_TOKEN: 'npm-secret-token-value',
      GITHUB_TOKEN: 'github-release-secret-value',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: 'v0.1.0',
      DIVINITY_PUBLIC_RELEASE_CONFIRM: 'publish'
    },
    npmCommand: process.execPath,
    npmCommandArgsPrefix: [mockCommandPath, callsPath, 'npm'],
    ghCommand: process.execPath,
    ghCommandArgsPrefix: [mockCommandPath, callsPath, 'gh'],
    uploadAssetPaths: [
      'dist/signed-native-binary/SHA256SUMS',
      'dist/signed-native-binary/manifest.json'
    ]
  });

  assert.equal(configured.ok, true);
  assert.equal(configured.artifact.status, 'executed');
  assert.equal(configured.artifact.public_release_ready, true);
  assert.equal(configured.artifact.execution_attempted, true);
  assert.equal(configured.artifact.confirmation_configured, true);
  assert.deepEqual(configured.artifact.blockers, []);
  assert.deepEqual(configured.artifact.steps.map(step => [step.step_id, step.status]), [
    ['registry_publish', 'executed'],
    ['binary_attachment_upload', 'executed']
  ]);
  assert.equal(configured.artifact.steps[0].stdout_bytes > 0, true);
  assert.match(configured.artifact.steps[0].stdout_sha256, /^[a-f0-9]{64}$/);
  assert.equal(configured.artifact.steps[1].stdout_bytes > 0, true);
  assert.match(configured.artifact.steps[1].stdout_sha256, /^[a-f0-9]{64}$/);

  const calls = readFileSync(callsPath, 'utf8').trim().split('\n').map(line => JSON.parse(line));
  assert.deepEqual(calls.map(call => call.kind), ['npm', 'gh']);
  assert.deepEqual(calls[0].args, ['publish', '--provenance', '--access', 'public', '--json']);
  assert.deepEqual(calls[1].args, [
    'release',
    'upload',
    'v0.1.0',
    'dist/signed-native-binary/SHA256SUMS',
    'dist/signed-native-binary/manifest.json',
    '--repo',
    'DivinityCode/Divinity-code',
    '--clobber'
  ]);

  const serialized = JSON.stringify([execution, configured.artifact]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'secret://',
    'npm-secret-token-value',
    'github-release-secret-value',
    'v0.1.0',
    'release@example.com'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `promotion execution must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-promotion-execution' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
