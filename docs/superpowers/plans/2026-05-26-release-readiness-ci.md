# Release Readiness CI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a GitHub Actions release-readiness workflow that verifies the public distribution gates on Node 22 before PR integration.

**Architecture:** Keep the existing contract workflow but align it with the package engine and clean install discipline. Add a second `Release Readiness` workflow that runs the provider, package, release, smoke, and full-suite gates already documented in the release checklist. Guard both workflows with a repository test so CI drift is caught locally.

**Tech Stack:** GitHub Actions YAML, Node.js 22, npm clean install from `package-lock.json`, existing package scripts, Node ESM static tests, Markdown docs.

---

## File Map

- Create `.github/workflows/release-readiness.yml`: broad GitHub Actions gate for public distribution readiness.
- Modify `.github/workflows/contracts.yml`: use Node 22 and `npm ci`.
- Create `tests/tests_github_workflows.mjs`: static workflow guard for Node version, clean install, trigger shape, and required commands.
- Modify `package.json`: add `test:github-workflows` and include it in `pnpm test`.
- Modify `tests/tests_package_manifest.mjs`: assert the new package script exists.
- Modify `tests/tests_public_onboarding_docs.mjs`: assert the release checklist names the GitHub workflow and key gates.
- Modify docs:
  - `README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/REPOSITORY_RESEARCH.md`
  - this plan file

## Task 1: Failing Workflow Tests

- [x] **Step 1: Add `tests/tests_github_workflows.mjs`**

Create a test that reads `.github/workflows/contracts.yml` and `.github/workflows/release-readiness.yml` as text and asserts:

```js
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
assertIncludes(contracts, "node-version: '22'", 'contracts workflow');
assertIncludes(contracts, 'npm ci', 'contracts workflow');
assertIncludes(contracts, 'npm run validate:contracts', 'contracts workflow');
assertNotIncludes(contracts, 'npm install', 'contracts workflow');

const releaseReadiness = read('.github/workflows/release-readiness.yml');
assertIncludes(releaseReadiness, 'name: Release Readiness', 'release readiness workflow');
assertIncludes(releaseReadiness, 'pull_request:', 'release readiness workflow');
assertIncludes(releaseReadiness, 'push:', 'release readiness workflow');
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
```

- [x] **Step 2: Add package script assertions**

In `package.json`, add later:

```json
"test:github-workflows": "node tests/tests_github_workflows.mjs"
```

Before implementation, update `tests/tests_package_manifest.mjs` to assert:

```js
assert.equal(packageJson.scripts?.['test:github-workflows'], 'node tests/tests_github_workflows.mjs');
```

Then add `node tests/tests_github_workflows.mjs` to the top-level `test` script after `tests/tests_ide_extension_static.mjs`.

- [x] **Step 3: Add docs test expectations**

In `tests/tests_public_onboarding_docs.mjs`, add release checklist assertions:

```js
'Release Readiness',
'.github/workflows/release-readiness.yml',
'npm run test:github-workflows'
```

- [x] **Step 4: Verify red**

Run:

```bash
node tests/tests_github_workflows.mjs
node tests/tests_package_manifest.mjs
node tests/tests_public_onboarding_docs.mjs
```

Expected: fail because `.github/workflows/release-readiness.yml` and `test:github-workflows` do not exist yet, and the contracts workflow still uses Node 20 plus `npm install`.

## Task 2: Implement Workflows And Script Wiring

- [x] **Step 1: Update contract workflow**

Modify `.github/workflows/contracts.yml`:

```yaml
      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci
```

- [x] **Step 2: Add release-readiness workflow**

Create `.github/workflows/release-readiness.yml`:

```yaml
name: Release Readiness

on:
  pull_request:
  push:
    branches: ["**"]

jobs:
  release-readiness:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: '22'

      - name: Install dependencies
        run: npm ci

      - name: Validate contracts
        run: npm run validate:contracts

      - name: Validate public docs
        run: npm run test:public-docs

      - name: Validate deprecated public guidance
        run: npm run test:deprecations

      - name: Validate provider governance
        run: npm run test:providers

      - name: Validate package metadata
        run: npm run test:package

      - name: Validate package tarball smoke
        run: npm run test:package-tarball

      - name: Validate binary artifact smoke
        run: npm run test:binary

      - name: Validate release bundle
        run: npm run test:release-bundle

      - name: Validate release promotion preflight
        run: npm run test:release-promotion

      - name: Validate release artifact metadata
        run: npm run test:release-artifacts

      - name: Validate release status surface
        run: npm run test:release-status

      - name: Validate CLI/API smoke
        run: npm run test:smoke

      - name: Run full suite
        run: npm test
```

- [x] **Step 3: Add package script wiring**

Modify `package.json`:

- Add `"test:github-workflows": "node tests/tests_github_workflows.mjs"`.
- Add `node tests/tests_github_workflows.mjs` into the top-level `test` script immediately after `node tests/tests_ide_extension_static.mjs`.

- [x] **Step 4: Verify green**

Run:

```bash
node tests/tests_github_workflows.mjs
node tests/tests_package_manifest.mjs
node tests/tests_public_onboarding_docs.mjs
```

Expected: all pass.

## Task 3: Documentation Updates

- [x] Update `README.md` validation guidance to mention `pnpm run test:github-workflows` and GitHub `Release Readiness`.
- [x] Update `docs/RELEASE_CHECKLIST.md` GitHub Gates to require both `Contracts Validation` and `Release Readiness`, and list the workflow path.
- [x] Update `docs/ARCHITECTURE.md` release readiness section with the GitHub workflow purpose, Node 22, `npm ci`, and the covered gates.
- [x] Update `docs/PRODUCT_PLAN.md` Phase 3 public onboarding/release packaging with a bootstrap status for the release-readiness CI gate.
- [x] Add item 75 to `docs/REPOSITORY_RESEARCH.md` describing the CI release-readiness gate.

## Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check tests/tests_github_workflows.mjs
node tests/tests_github_workflows.mjs
node tests/tests_package_manifest.mjs
node tests/tests_public_onboarding_docs.mjs
pnpm run test:github-workflows
pnpm run test:package
pnpm run test:public-docs
```

- [x] Run broad checks:

```bash
pnpm run validate:contracts
pnpm run test:deprecations
pnpm run test:providers
pnpm run test:package-tarball
pnpm run test:release-bundle
pnpm run test:release-promotion
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json
```

- [ ] Commit as `ci: add release readiness workflow`.
- [ ] Push branch `codex/release-readiness-ci`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub `Contracts Validation` and `Release Readiness` checks, merge only when green, sync local `main`, and rerun `pnpm run test:github-workflows`.
