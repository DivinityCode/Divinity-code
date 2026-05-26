import assert from 'assert/strict';
import { existsSync, readFileSync, statSync } from 'fs';
import { spawnSync } from 'child_process';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
const rootLock = packageLock.packages?.[''];

assert.equal(packageJson.name, 'divinity-code');
assert.equal(packageJson.private, true);
assert.equal(packageJson.bin?.divinity, 'apps/cli/src/index.mjs');
assert.equal(packageJson.engines?.node, '>=22');
assert.equal(packageJson.packageManager, 'pnpm@9.15.4');
assert.equal(packageJson.repository?.type, 'git');
assert.equal(packageJson.repository?.url, 'git+https://github.com/DivinityCode/Divinity-code.git');
assert.equal(packageJson.license, 'UNLICENSED');
assert.equal(packageJson.scripts?.['test:package-tarball'], 'node tests/tests_package_tarball_smoke.mjs');
assert.equal(packageJson.scripts?.['release:public-readiness-audit'], 'node tests/scripts_release_public_readiness_audit.mjs');
assert.equal(packageJson.scripts?.['test:public-readiness-audit'], 'node tests/tests_release_public_readiness_audit.mjs');
assert.equal(packageJson.scripts?.['release:registry-dry-run'], 'node tests/scripts_release_registry_publish_dry_run.mjs');
assert.equal(packageJson.scripts?.['test:release-registry-dry-run'], 'node tests/tests_release_registry_publish_dry_run.mjs');
assert.equal(packageJson.scripts?.['release:binary-attachments'], 'node tests/scripts_release_binary_attachments.mjs');
assert.equal(packageJson.scripts?.['test:release-binary-attachments'], 'node tests/tests_release_binary_attachments.mjs');
assert.equal(packageJson.scripts?.['release:binary'], 'node tests/scripts_release_binary.mjs');
assert.equal(packageJson.scripts?.['test:binary'], 'node tests/tests_release_binary_artifacts.mjs');
assert.equal(packageJson.scripts?.['release:native-binary'], 'node tests/scripts_release_native_binary.mjs');
assert.equal(packageJson.scripts?.['test:native-binary'], 'node tests/tests_release_native_binary_artifacts.mjs');
assert.equal(packageJson.scripts?.['release:signed-native-binary'], 'node tests/scripts_release_signed_native_binary.mjs');
assert.equal(packageJson.scripts?.['test:signed-native-binary'], 'node tests/tests_release_signed_native_binary_artifacts.mjs');
assert.equal(packageJson.scripts?.['release:bundle'], 'node tests/scripts_release_bundle.mjs');
assert.equal(packageJson.scripts?.['test:release-bundle'], 'node tests/tests_release_candidate_bundle.mjs');
assert.equal(packageJson.scripts?.['release:signatures'], 'node tests/scripts_release_signatures.mjs');
assert.equal(packageJson.scripts?.['test:release-signatures'], 'node tests/tests_release_signature_artifacts.mjs');
assert.equal(packageJson.scripts?.['release:promotion-preflight'], 'node tests/scripts_release_promotion_preflight.mjs');
assert.equal(packageJson.scripts?.['test:release-promotion'], 'node tests/tests_release_promotion_preflight.mjs');
assert.equal(packageJson.scripts?.['test:github-workflows'], 'node tests/tests_github_workflows.mjs');
assert.ok(packageJson.scripts?.test.includes('node tests/tests_release_public_readiness_audit.mjs'));
assert.ok(packageJson.scripts?.test.includes('node tests/tests_release_registry_publish_dry_run.mjs'));
assert.ok(packageJson.scripts?.test.includes('node tests/tests_release_binary_attachments.mjs'));
assert.ok(packageJson.scripts?.test.includes('node tests/tests_release_signed_native_binary_artifacts.mjs'));
assert.ok(packageJson.files.includes('apps'));
assert.ok(packageJson.files.includes('packages'));
assert.ok(packageJson.files.includes('docs'));
assert.ok(packageJson.files.includes('README.md'));

const binPath = packageJson.bin.divinity;
assert.equal(existsSync(binPath), true);
assert.equal(Boolean(statSync(binPath).mode & 0o111), true, 'divinity bin target must be executable');
assert.equal(readFileSync(binPath, 'utf8').startsWith('#!/usr/bin/env node'), true);

const providers = spawnSync(process.execPath, [binPath, 'providers'], {
  cwd: process.cwd(),
  encoding: 'utf8'
});
assert.equal(providers.status, 0, providers.stderr);
const payload = JSON.parse(providers.stdout);
assert.equal(payload.ok, true);
assert.equal(payload.command, 'providers');
assert.ok(payload.llm_providers.some(provider => provider.provider_id === 'openrouter'));

assert.equal(rootLock.name, packageJson.name);
assert.equal(rootLock.version, packageJson.version);
assert.deepEqual(rootLock.bin, packageJson.bin);
assert.deepEqual(rootLock.engines, packageJson.engines);
assert.equal(rootLock.license, packageJson.license);
assert.deepEqual(rootLock.devDependencies, packageJson.devDependencies);

console.log(JSON.stringify({ ok: true, test: 'package-manifest' }));
