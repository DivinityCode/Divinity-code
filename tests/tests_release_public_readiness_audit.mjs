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

assert.equal(typeof releaseArtifacts.buildReleasePublicReadinessAudit, 'function');
assert.equal(typeof releaseArtifacts.writeReleasePublicReadinessAudit, 'function');
assert.equal(
  releaseArtifacts.DEFAULT_RELEASE_PUBLIC_READINESS_AUDIT_OUTPUT,
  path.join('dist', 'release-public-readiness-audit.json')
);

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-public-readiness-audit-'));
const outputPath = path.join(tmpRoot, 'release-public-readiness-audit.json');

try {
  const result = runJson(process.execPath, [
    path.resolve('tests/scripts_release_public_readiness_audit.mjs'),
    '--output',
    outputPath
  ], {
    env: {
      ...process.env,
      NPM_TOKEN: '',
      GITHUB_TOKEN: '',
      GH_TOKEN: '',
      DIVINITY_RELEASE_TAG: '',
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

  const audit = JSON.parse(readFileSync(outputPath, 'utf8'));
  assert.deepEqual(result.artifact, audit);
  assert.equal(audit.format, 'divinity.release_public_readiness_audit.v1');
  assert.equal(audit.generated_by, 'packages/release-artifacts');
  assert.equal(audit.status, 'blocked');
  assert.equal(audit.public_release_ready, false);
  assert.equal(audit.decision_required, true);
  assert.equal(audit.command, 'pnpm run release:public-readiness-audit');
  assert.equal(audit.smoke_test_command, 'pnpm run test:public-readiness-audit');
  assert.equal(audit.package.name, packageJson.name);
  assert.equal(audit.package.version, packageJson.version);
  assert.equal(audit.package.private, true);
  assert.equal(audit.non_production_warning_active, true);
  assert.equal(audit.does_not_publish, true);
  assert.equal(audit.does_not_upload, true);
  assert.equal(audit.does_not_mutate_package_metadata, true);
  assert.equal(audit.does_not_remove_non_production_warning, true);
  assert.equal(audit.redacts_local_paths, true);
  assert.equal(audit.redacts_registry_token, true);
  assert.equal(audit.redacts_github_token, true);
  assert.equal(audit.redacts_release_tag, true);
  assert.equal(audit.redacts_signing_secrets, true);
  assert.deepEqual(audit.blockers, [
    'package_private',
    'non_production_warning',
    'missing_registry_token',
    'missing_github_release_token',
    'missing_release_tag',
    'native_binary_build_pending',
    'signing_blocked'
  ]);

  assert.deepEqual(audit.package_privacy_decision, {
    item_id: 'package_privacy',
    status: 'blocked',
    blocker: 'package_private',
    current_state: 'package.json private=true',
    required_state: 'package publishing is explicitly enabled by an approved public release decision',
    evidence_command: 'pnpm run test:public-readiness-audit',
    evidence_artifacts: ['dist/release-public-readiness-audit.json', 'package.json']
  });
  assert.deepEqual(audit.production_warning_decision, {
    item_id: 'production_warning',
    status: 'blocked',
    blocker: 'non_production_warning',
    current_state: 'README non-production warning active',
    required_state: 'README production warning is removed only after the public readiness audit passes',
    evidence_command: 'pnpm run test:public-readiness-audit',
    evidence_artifacts: ['dist/release-public-readiness-audit.json', 'README.md', 'docs/RELEASE_CHECKLIST.md']
  });
  assert.equal(audit.release_gate_clearance.format, 'divinity.release_gate_clearance.v1');
  assert.equal(audit.release_gate_clearance.status, 'blocked');
  assert.equal(audit.release_gate_clearance.public_release_ready, false);
  assert.equal(audit.release_gate_clearance.clearance_items.length, 8);
  assert.deepEqual(audit.release_gate_clearance.blockers, audit.blockers);
  assert.deepEqual(audit.required_evidence_commands, [
    'pnpm run test:public-readiness-audit',
    'pnpm run test:release-artifacts',
    'pnpm run test:release-status',
    'pnpm run test:github-workflows'
  ]);

  const configuredAudit = releaseArtifacts.buildReleasePublicReadinessAudit({
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
      DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
      DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
      DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
      DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
    }
  });
  assert.equal(configuredAudit.decision_required, false);
  assert.equal(configuredAudit.package.private, false);
  assert.equal(configuredAudit.non_production_warning_active, false);
  assert.equal(configuredAudit.package_privacy_decision.status, 'ready');
  assert.equal(configuredAudit.production_warning_decision.status, 'ready');
  assert.equal(configuredAudit.blockers.includes('missing_registry_token'), false);
  assert.equal(configuredAudit.blockers.includes('missing_github_release_token'), false);
  assert.equal(configuredAudit.blockers.includes('missing_release_tag'), false);
  assert.ok(configuredAudit.blockers.includes('native_binary_build_pending'));
  assert.ok(configuredAudit.blockers.includes('signing_blocked'));

  const serialized = JSON.stringify([audit, configuredAudit]);
  for (const disallowed of [
    process.cwd(),
    tmpRoot,
    'secret://',
    'npm-secret-token-value',
    'github-release-secret-value',
    'v0.1.0',
    'release@example.com',
    'DIVINITY_RELEASE_SIGNING_KEY_REF',
    'DIVINITY_RELEASE_SIGNING_IDENTITY'
  ]) {
    assert.equal(serialized.includes(disallowed), false, `public readiness audit must not include ${disallowed}`);
  }

  console.log(JSON.stringify({ ok: true, test: 'release-public-readiness-audit' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
