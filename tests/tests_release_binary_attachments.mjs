import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { buildReleaseBinaryAttachmentPlan } from '../packages/release-artifacts/src/index.mjs';

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
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-release-binary-attachments-'));
const outputPath = path.join(tmpRoot, 'release-binary-attachments.json');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_binary_attachments.mjs'),
    '--',
    '--output',
    outputPath
  ], {
    env: {
      ...process.env,
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: ''
    }
  });

  assert.equal(result.ok, true);
  assert.equal(result.artifact_path, outputPath);
  assert.equal(existsSync(outputPath), true);

  const plan = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, plan);
  assert.equal(plan.format, 'divinity.release_binary_attachment_plan.v1');
  assert.equal(plan.generated_by, 'packages/release-artifacts');
  assert.equal(plan.status, 'blocked');
  assert.equal(plan.public_release_ready, false);
  assert.equal(plan.binary_attachments_ready, false);
  assert.equal(plan.command, 'pnpm run release:binary-attachments');
  assert.equal(plan.smoke_test_command, 'pnpm run test:release-binary-attachments');
  assert.equal(plan.provider, 'github_releases');
  assert.equal(plan.repository, 'DivinityCode/Divinity-code');
  assert.equal(plan.release_tag_env_var, 'DIVINITY_RELEASE_TAG');
  assert.equal(plan.release_tag_configured, false);
  assert.deepEqual(plan.token_env_vars, ['GITHUB_TOKEN', 'GH_TOKEN']);
  assert.equal(plan.token_configured, false);
  assert.equal(plan.upload_command, 'gh release upload "$DIVINITY_RELEASE_TAG" dist/signed-native-binary/* --repo DivinityCode/Divinity-code --clobber');
  assert.equal(plan.signed_native_binary_manifest_path, 'dist/signed-native-binary/manifest.json');
  assert.equal(plan.signed_native_binary_checksum_path, 'dist/signed-native-binary/SHA256SUMS');
  assert.deepEqual(plan.asset_sources, [
    'dist/signed-native-binary/manifest.json',
    'dist/signed-native-binary/SHA256SUMS',
    'dist/signed-native-binary/native-binary/',
    'dist/signed-native-binary/signatures/'
  ]);
  assert.deepEqual(plan.blockers, [
    'package_private',
    'non_production_warning',
    'missing_github_release_token',
    'missing_release_tag',
    'native_binary_build_pending',
    'signing_blocked'
  ]);
  assert.equal(plan.does_not_upload, true);
  assert.equal(plan.redacts_token, true);
  assert.equal(plan.redacts_local_paths, true);
  assert.equal(plan.redacts_signing_secrets, true);

  const readyPlan = buildReleaseBinaryAttachmentPlan({
    packageJson: {
      ...packageJson,
      private: false
    },
    publishingBlocked: false,
    warningActive: false,
    env: {
      ...process.env,
      GITHUB_TOKEN: 'github-release-secret-value',
      DIVINITY_RELEASE_TAG: 'v0.1.0'
    },
    nativeBinaryBlocked: false,
    signingBlocked: false
  });
  assert.equal(readyPlan.status, 'ready');
  assert.equal(readyPlan.binary_attachments_ready, true);
  assert.equal(readyPlan.public_release_ready, false);
  assert.deepEqual(readyPlan.blockers, []);
  assert.equal(readyPlan.token_configured, true);
  assert.equal(readyPlan.release_tag_configured, true);
  assert.equal(readyPlan.upload_execution.status, 'not_run');

  const serialized = JSON.stringify([plan, readyPlan]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'github-release-secret-value',
    'v0.1.0',
    'secret://'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `binary attachment plan must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-binary-attachments' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
