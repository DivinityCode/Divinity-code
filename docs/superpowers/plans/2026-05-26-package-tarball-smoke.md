# Package Tarball Smoke Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a distribution-readiness gate that proves the packed `divinity-code` package installs into a clean temporary project and the `divinity` CLI runs outside the source checkout.

**Architecture:** Add a Node-only test that runs `npm pack --json --pack-destination <tmp>`, installs the resulting tarball into a second temporary project, and executes the installed CLI bin for runtime-safe commands. Wire the test into `package.json`, release artifact gates, release checklist docs, and repository research notes.

**Tech Stack:** Node.js ESM, npm CLI, existing package manifest, release artifact generator, release/package tests.

---

### Task 1: Distribution Smoke Test

**Files:**
- Create: `tests/tests_package_tarball_smoke.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing test**

Create `tests/tests_package_tarball_smoke.mjs` that:
- runs `npm pack --json --pack-destination <tmp>/pack`;
- asserts the tarball exists and has a `.tgz` extension;
- creates `<tmp>/consumer/package.json`;
- runs `npm install --no-audit --no-fund --ignore-scripts <tarball>`;
- runs `node node_modules/.bin/divinity doctor`;
- runs `node node_modules/.bin/divinity providers`;
- asserts returned JSON is valid and does not depend on source-checkout-only files.

- [x] **Step 2: Run test to verify it fails**

Run: `node tests/tests_package_tarball_smoke.mjs`

Expected: FAIL until the test file exists and/or until package metadata includes all runtime files.

- [x] **Step 3: Add package script**

Add `"test:package-tarball": "node tests/tests_package_tarball_smoke.mjs"` and include it in `npm test`/`pnpm test`.

- [x] **Step 4: Run test to verify it passes**

Run: `node tests/tests_package_tarball_smoke.mjs`

Expected: PASS and print `{"ok":true,"test":"package-tarball-smoke"}`.

### Task 2: Release Manifest and Docs

**Files:**
- Modify: `tests/scripts_release_artifacts.mjs`
- Modify: `tests/tests_release_artifacts.mjs`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] **Step 1: Add release gate**

Add release gate:

```json
{
  "gate_id": "package_tarball_smoke",
  "command": "pnpm run test:package-tarball",
  "required": true
}
```

- [x] **Step 2: Add local tarball install path**

Add an available install path for local release-candidate package tarballs that remains distinct from blocked package-registry publishing.

- [x] **Step 3: Update docs**

Document `pnpm run test:package-tarball` in the release checklist and product plan bootstrap status.

- [x] **Step 4: Run release artifact tests**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_public_onboarding_docs.mjs
```

Expected: PASS.

### Task 3: Research Refresh

**Files:**
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`

- [x] **Step 1: Update live repo signals**

Use the GitHub API results gathered on 2026-05-26:
- Claude Code `v2.1.150`, published 2026-05-23.
- OpenAI Codex `rust-v0.133.0`, published 2026-05-21.
- Hermes Agent `v2026.5.16`, published 2026-05-16.
- Paperclip `v2026.525.0`, published 2026-05-25.

- [x] **Step 2: Add package-smoke implication**

Record that Hermes and Codex emphasize one-command install/package paths, while Paperclip emphasizes plugin/runtime readiness and local-cloud sync; Divinity now responds with a packed-package smoke gate.

- [x] **Step 3: Run deprecation/public doc checks**

Run:

```bash
node tests/tests_deprecation_audit.mjs
node tests/tests_public_onboarding_docs.mjs
```

Expected: PASS.

### Task 4: Final Verification and Publish

**Files:**
- Verify all changed files.

- [x] **Step 1: Syntax checks**

Run:

```bash
node --check tests/tests_package_tarball_smoke.mjs
node --check tests/scripts_release_artifacts.mjs
```

- [x] **Step 2: Focused tests**

Run:

```bash
npm run test:package-tarball
pnpm run test:package
pnpm run test:release-artifacts
pnpm run test:public-docs
pnpm run test:deprecations
```

- [x] **Step 3: Broader checks**

Run:

```bash
pnpm test
npm ci
npm audit --audit-level=high
git diff --check
rg -n '^(<{7}|={7}|>{7})'
```

- [x] **Step 4: Commit and publish**

Commit message: `test: add package tarball smoke gate`

Push branch and open a draft PR against `main`.
