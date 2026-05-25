import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function read(filePath) {
  return readFileSync(filePath, 'utf8');
}

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), `${label} must include ${expected}`);
}

function assertNotIncludes(source, disallowed, label) {
  assert.equal(source.includes(disallowed), false, `${label} must not include ${disallowed}`);
}

const packageJson = JSON.parse(read('package.json'));
assert.equal(packageJson.scripts['test:deprecations'], 'node tests/tests_deprecation_audit.mjs');
assertIncludes(packageJson.scripts.test, 'node tests/tests_deprecation_audit.mjs', 'package test script');
assert.equal(packageJson.devDependencies['ajv-cli'], undefined, 'package manifest must not depend on deprecated ajv-cli');
const packageLock = JSON.parse(read('package-lock.json'));
assert.equal(packageLock.packages?.['node_modules/ajv-cli'], undefined, 'package lock must not include deprecated ajv-cli');
assert.equal(packageLock.packages?.['node_modules/fast-json-patch'], undefined, 'package lock must not include vulnerable fast-json-patch via ajv-cli');

const upgrade = read('docs/UPGRADE.md');
const releaseChecklist = read('docs/RELEASE_CHECKLIST.md');
assertIncludes(upgrade, 'pnpm run test:deprecations', 'upgrade guide');
assertIncludes(releaseChecklist, 'pnpm run test:deprecations', 'release checklist');

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-deprecation-audit-'));
const artifactPath = path.join(tmpDir, 'release-artifacts.json');
execFileSync(
  process.execPath,
  [path.resolve('tests/scripts_release_artifacts.mjs'), '--output', artifactPath],
  { cwd: process.cwd(), encoding: 'utf8' }
);
const artifact = JSON.parse(read(artifactPath));
assert.ok(
  artifact.release_gates.some(gate => gate.command === 'pnpm run test:deprecations'),
  'release artifact must include deprecation audit gate'
);

const publicActionSurface = [
  ['README', read('README.md')],
  ['Install Guide', read('docs/INSTALL.md')],
  ['Quickstart', read('docs/QUICKSTART.md')],
  ['Upgrade Guide', upgrade],
  ['Release Checklist', releaseChecklist],
  ['Release Artifact', JSON.stringify(artifact)]
];

for (const [label, source] of publicActionSurface) {
  for (const disallowed of [
    'npm install -g divinity-code',
    'npx divinity'
  ]) {
    assertNotIncludes(source, disallowed, label);
  }
}

for (const [label, source] of [
  ['Install Guide', read('docs/INSTALL.md')],
  ['Quickstart', read('docs/QUICKSTART.md')],
  ['Release Artifact', JSON.stringify(artifact)]
]) {
  const normalized = source.toLowerCase();
  for (const disallowed of [
    'can use public shared keys',
    'may use public shared keys',
    'can use shared public keys',
    'may use shared public keys',
    'use public shared keys to',
    'use shared public keys to',
    'use no-signup keys',
    'quota-bypass rotation is supported',
    'rotate to bypass'
  ]) {
    assertNotIncludes(normalized, disallowed, label);
  }
  for (const disallowed of [
    'use max_tokens for openai',
    'set max_tokens for openai',
    'openai responses uses `max_tokens`'
  ]) {
    assertNotIncludes(normalized, disallowed, label);
  }
}

const providerProxySource = read('packages/provider-proxy/src/index.mjs');
const providerProxyReadme = read('packages/provider-proxy/README.md');
assertIncludes(providerProxySource, 'body.max_completion_tokens', 'provider proxy source');
assertIncludes(providerProxySource, 'body.max_output_tokens', 'provider proxy source');
assertIncludes(providerProxySource, 'max_tokens: outputTokens || 1024', 'provider proxy source');
assertIncludes(providerProxyReadme, 'OpenAI-compatible Chat Completions does not use deprecated `max_tokens`', 'provider proxy README');
assertIncludes(providerProxyReadme, 'Anthropic Messages uses its current `max_tokens` field', 'provider proxy README');
assertIncludes(providerProxyReadme, 'OpenAI Responses uses `max_output_tokens`', 'provider proxy README');

console.log(JSON.stringify({ ok: true, test: 'deprecation-audit' }));
