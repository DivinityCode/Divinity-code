# Release Status Command Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expose release readiness metadata through production code and the CLI instead of keeping it only in a test script.

**Architecture:** Extract release artifact manifest construction from `tests/scripts_release_artifacts.mjs` into a new `packages/release-artifacts` package. Keep the existing script as a thin writer around the package. Add CLI `release-status` to print the same release gate, install path, integrity, signing, package-private, and non-production warning status as JSON without writing `dist/release-artifacts.json`.

**Tech Stack:** Node.js ESM, CLI JSON command surface, release artifact manifest tests, public docs gates.

---

### Task 1: Package Extraction

**Files:**
- Create: `packages/release-artifacts/src/index.mjs`
- Create: `packages/release-artifacts/README.md`
- Modify: `tests/scripts_release_artifacts.mjs`
- Modify: `tests/tests_release_artifacts.mjs`

- [x] **Step 1: Write failing package/script expectations**

Update `tests/tests_release_artifacts.mjs` to assert that generated manifests use `generated_by: "packages/release-artifacts"` and still include the same install paths, release gates, integrity metadata, and signing blockers.

Run:

```bash
node tests/tests_release_artifacts.mjs
```

Expected: FAIL until the manifest builder is extracted and the script delegates to it.

- [x] **Step 2: Extract release artifact builder**

Move manifest construction helpers into `packages/release-artifacts/src/index.mjs` and export:

```js
buildReleaseArtifactsManifest({ cwd = process.cwd(), generated_by = 'packages/release-artifacts' } = {})
writeReleaseArtifactsManifest({ output = path.join('dist', 'release-artifacts.json'), cwd = process.cwd() } = {})
```

Keep path reads resolved relative to `cwd`, preserve the package `files` allowlist walk, and keep blocked publishing/signing behavior unchanged while the README warning and `private: true` remain active.

- [x] **Step 3: Thin script wrapper**

Reduce `tests/scripts_release_artifacts.mjs` to argument parsing plus `writeReleaseArtifactsManifest()`.

Run:

```bash
node tests/tests_release_artifacts.mjs
```

Expected: PASS and print `{"ok":true,"test":"release-artifacts"}`.

### Task 2: CLI Release Status

**Files:**
- Modify: `apps/cli/src/index.mjs`
- Create: `tests/tests_cli_release_status.mjs`
- Modify: `package.json`

- [x] **Step 1: Add failing CLI test**

Create `tests/tests_cli_release_status.mjs` that runs:

```bash
node apps/cli/src/index.mjs release-status
```

Assert:
- `ok: true`
- `command: "release-status"`
- release manifest format is `divinity.release_artifacts.v1`
- package registry and binary download paths are blocked
- signing status is blocked
- release gates include `pnpm test`, `pnpm run test:providers`, and `pnpm run test:smoke`
- output does not include unsafe install/provider strings.

Wire the test into `package.json` with `test:release-status` and the full `test`/`test:cli` chains.

Run:

```bash
node tests/tests_cli_release_status.mjs
```

Expected: FAIL until the command exists.

- [x] **Step 2: Implement CLI command**

Import `buildReleaseArtifactsManifest()` and add `release-status` to the command switch and usage string. The command prints the manifest without writing files.

Run:

```bash
node tests/tests_cli_release_status.mjs
```

Expected: PASS and print `{"ok":true,"test":"cli-release-status"}`.

### Task 3: Docs

**Files:**
- Modify: `README.md`
- Modify: `docs/INSTALL.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/ARCHITECTURE.md`

- [x] **Step 1: Update docs**

Document:
- `release-status` is a read-only CLI view of release readiness.
- `release:artifacts` still writes the manifest for release-candidate review.
- registry and binary paths remain blocked while `private: true` and the non-production warning are active.

- [x] **Step 2: Run doc gates**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
```

Expected: PASS.

### Task 4: Verification And Publish

- [x] **Step 1: Focused verification**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_artifacts.mjs
node --check tests/tests_release_artifacts.mjs
node --check tests/tests_cli_release_status.mjs
node --check apps/cli/src/index.mjs
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:cli
```

- [x] **Step 2: Broad verification**

Run:

```bash
pnpm test
npm ci
npm audit --audit-level=high
pnpm run validate:contracts
pnpm run test:smoke
git diff --check
rg -n '^(<{7}|={7}|>{7})'
```

- [ ] **Step 3: Commit and publish**

Commit message: `feat: add release status command`

Push branch `codex/release-status-command`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:release-status`.
