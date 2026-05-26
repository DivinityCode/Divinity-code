import assert from 'assert/strict';
import { existsSync, readFileSync } from 'fs';

function read(path) {
  assert.equal(existsSync(path), true, `${path} must exist`);
  return readFileSync(path, 'utf8');
}

function assertIncludes(source, expected, label) {
  assert.ok(source.includes(expected), `${label} must include ${expected}`);
}

function assertNotIncludes(source, disallowed, label) {
  assert.equal(source.includes(disallowed), false, `${label} must not include ${disallowed}`);
}

const contracts = read('.github/workflows/contracts.yml');
assertIncludes(contracts, 'name: Contracts Validation', 'contracts workflow');
assertIncludes(contracts, 'pull_request:', 'contracts workflow');
assertIncludes(contracts, 'push:', 'contracts workflow');
assertIncludes(contracts, 'workflow_dispatch:', 'contracts workflow');
assertIncludes(contracts, "node-version: '22'", 'contracts workflow');
assertIncludes(contracts, 'npm ci', 'contracts workflow');
assertIncludes(contracts, 'npm run validate:contracts', 'contracts workflow');
assertNotIncludes(contracts, 'npm install', 'contracts workflow');

const releaseReadiness = read('.github/workflows/release-readiness.yml');
assertIncludes(releaseReadiness, 'name: Release Readiness', 'release readiness workflow');
assertIncludes(releaseReadiness, 'pull_request:', 'release readiness workflow');
assertIncludes(releaseReadiness, 'push:', 'release readiness workflow');
assertIncludes(releaseReadiness, 'workflow_dispatch:', 'release readiness workflow');
assertIncludes(releaseReadiness, "node-version: '22'", 'release readiness workflow');
assertIncludes(releaseReadiness, 'npm ci', 'release readiness workflow');
assertNotIncludes(releaseReadiness, 'npm install', 'release readiness workflow');

for (const command of [
  'npm run validate:contracts',
  'npm run test:public-docs',
  'npm run test:deprecations',
  'npm run test:providers',
  'npm run test:package',
  'npm run test:package-tarball',
  'npm run test:binary',
  'npm run test:release-bundle',
  'npm run test:release-promotion',
  'npm run test:release-artifacts',
  'npm run test:release-status',
  'npm run test:smoke',
  'npm test'
]) {
  assertIncludes(releaseReadiness, command, 'release readiness workflow');
}

console.log(JSON.stringify({ ok: true, test: 'github-workflows' }));
