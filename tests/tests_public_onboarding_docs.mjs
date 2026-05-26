import assert from 'assert/strict';
import { existsSync, readFileSync } from 'fs';

function read(path) {
  return readFileSync(path, 'utf8');
}

function assertIncludes(source, expected, label) {
  assert.ok(
    source.includes(expected),
    `${label} must include ${expected}`
  );
}

function assertNotIncludes(source, disallowed, label) {
  assert.equal(
    source.includes(disallowed),
    false,
    `${label} must not include ${disallowed}`
  );
}

const requiredDocs = [
  ['docs/INSTALL.md', 'Install Guide'],
  ['docs/QUICKSTART.md', 'Quickstart'],
  ['docs/UPGRADE.md', 'Upgrade Guide'],
  ['docs/RELEASE_CHECKLIST.md', 'Release Checklist']
];

for (const [path] of requiredDocs) {
  assert.equal(existsSync(path), true, `${path} must exist`);
}

const readme = read('README.md');
for (const [path, label] of requiredDocs) {
  assertIncludes(readme, `[${label}](${path})`, 'README');
}

const install = read('docs/INSTALL.md');
assertIncludes(install, 'Node.js 22', 'install guide');
assertIncludes(install, 'Corepack pnpm', 'install guide');
assertIncludes(install, 'pnpm install', 'install guide');
assertIncludes(install, 'pnpm run validate:contracts', 'install guide');
assertIncludes(install, 'pnpm run release:artifacts', 'install guide');
assertIncludes(install, 'pnpm run release:native-binary', 'install guide');
assertIncludes(install, 'pnpm run release:bundle', 'install guide');
assertIncludes(install, 'pnpm run release:signatures', 'install guide');
assertIncludes(install, 'pnpm run release:promotion-preflight', 'install guide');
assertIncludes(install, 'divinity.release_gate_clearance.v1', 'install guide');
assertIncludes(install, 'pnpm run test:release-artifacts', 'install guide');
assertIncludes(install, 'pnpm run test:native-binary', 'install guide');
assertIncludes(install, 'pnpm run test:release-bundle', 'install guide');
assertIncludes(install, 'pnpm run test:release-signatures', 'install guide');
assertIncludes(install, 'pnpm run test:release-promotion', 'install guide');
assertIncludes(install, 'pnpm test', 'install guide');
assertIncludes(install, 'npm is optional', 'install guide');
assertIncludes(install, 'doctor --profile source', 'install guide');

const quickstart = read('docs/QUICKSTART.md');
for (const command of [
  'divinity init',
  'divinity doctor',
  'divinity doctor --profile source',
  'divinity providers',
  'divinity provider-route',
  'divinity run',
  'divinity status',
  'pnpm run test:smoke'
]) {
  assertIncludes(quickstart, command, 'quickstart');
}

const upgrade = read('docs/UPGRADE.md');
for (const command of [
  'git pull --ff-only',
  'pnpm install',
  'pnpm run validate:contracts',
  'pnpm run test:providers',
  'pnpm run test:smoke',
  'pnpm run test:deprecations',
  'pnpm test'
]) {
  assertIncludes(upgrade, command, 'upgrade guide');
}
assertIncludes(upgrade, 'deprecation audit', 'upgrade guide');

const releaseChecklist = read('docs/RELEASE_CHECKLIST.md');
for (const item of [
  'README warning review',
  'git status --short --branch',
  'node apps/cli/src/index.mjs doctor',
  'node apps/cli/src/index.mjs doctor --profile source',
  'pnpm run release:artifacts',
  'pnpm run release:native-binary',
  'pnpm run release:bundle',
  'pnpm run release:signatures',
  'pnpm run release:promotion-preflight',
  'pnpm run test:release-artifacts',
  'pnpm run test:native-binary',
  'pnpm run test:release-bundle',
  'pnpm run test:release-signatures',
  'pnpm run test:release-promotion',
  'divinity.release_gate_clearance.v1',
  'divinity.release_native_binary_artifacts.v1',
  'divinity.release_signature_artifacts.v1',
  'release artifact integrity and signing readiness',
  'pnpm run validate:contracts',
  'pnpm run test:deprecations',
  'pnpm test',
  'pnpm run test:smoke',
  'pnpm run test:providers',
  'pnpm run test:github-workflows',
  'git diff --check',
  'conflict marker scan',
  'GitHub Actions',
  'Release Readiness',
  '.github/workflows/release-readiness.yml'
]) {
  assertIncludes(releaseChecklist, item, 'release checklist');
}

const publicDocs = [
  readme,
  install,
  quickstart,
  upgrade,
  releaseChecklist
].join('\n');

for (const disallowed of [
  'npm install -g divinity-code',
  'npx divinity'
]) {
  assertNotIncludes(publicDocs, disallowed, 'public onboarding docs');
}

console.log(JSON.stringify({ ok: true, test: 'public-onboarding-docs' }));
