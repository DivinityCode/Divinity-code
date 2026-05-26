# Release Source Provenance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add redacted source provenance metadata to release artifacts so release candidates can be traced to a Git commit without leaking local paths or repository state details.

**Architecture:** Extend `packages/release-artifacts` to build `source_provenance` from the package repository metadata and local Git commands. The manifest should report commit SHA, branch, tracked dirty-state, and redaction guarantees; if Git metadata is unavailable, it should fail closed into `status: "unavailable"` rather than throwing.

**Tech Stack:** Node.js ESM, release artifact package, CLI `release-status`, package/docs test scripts.

---

### Task 1: Source Provenance Contract

**Files:**
- Modify: `tests/tests_release_artifacts.mjs`
- Modify: `tests/tests_cli_release_status.mjs`
- Modify: `packages/release-artifacts/src/index.mjs`

- [x] **Step 1: Add failing release artifact assertions**

In `tests/tests_release_artifacts.mjs`, assert generated artifacts include:

```js
assert.equal(artifact.source_provenance.format, 'divinity.release_source_provenance.v1');
assert.equal(artifact.source_provenance.status, 'available');
assert.equal(artifact.source_provenance.vcs, 'git');
assert.equal(artifact.source_provenance.repository_url, packageJson.repository.url);
assert.match(artifact.source_provenance.commit_sha, /^[a-f0-9]{40}$/);
assert.match(artifact.source_provenance.short_commit_sha, /^[a-f0-9]{7,12}$/);
assert.equal(typeof artifact.source_provenance.branch, 'string');
assert.equal(typeof artifact.source_provenance.tracked_changes, 'boolean');
assert.equal(artifact.source_provenance.untracked_files_ignored, true);
assert.equal(artifact.source_provenance.redacts_paths, true);
assert.equal(JSON.stringify(artifact.source_provenance).includes('tests/tests_release_artifacts.mjs'), false);
```

Also assert unavailable provenance is non-throwing:

```js
const unavailableProvenanceArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  gitCommand: '/definitely/missing/git'
});
assert.equal(unavailableProvenanceArtifact.source_provenance.status, 'unavailable');
assert.equal(unavailableProvenanceArtifact.source_provenance.commit_sha, '');
```

- [x] **Step 2: Add failing CLI release-status assertions**

In `tests/tests_cli_release_status.mjs`, assert:

```js
assert.equal(result.release.source_provenance.format, 'divinity.release_source_provenance.v1');
assert.equal(result.release.source_provenance.status, 'available');
assert.match(result.release.source_provenance.commit_sha, /^[a-f0-9]{40}$/);
assert.equal(result.release.source_provenance.redacts_paths, true);
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: FAIL because `source_provenance` is not present yet.

- [x] **Step 4: Implement source provenance metadata**

In `packages/release-artifacts/src/index.mjs`:
- import `execFileSync` from `child_process`;
- add `SOURCE_PROVENANCE_FORMAT = "divinity.release_source_provenance.v1"`;
- add `gitText()` helper that runs `git` with args and returns trimmed output or `""`;
- add `buildSourceProvenance({ cwd, packageJson, gitCommand = "git" })`;
- use `git rev-parse HEAD`, `git rev-parse --abbrev-ref HEAD`, and `git status --porcelain --untracked-files=no`;
- do not include changed file names, raw status output, absolute paths, or untracked files;
- include unavailable metadata if Git commands fail;
- wire `buildReleaseArtifactsManifest()` to include `source_provenance`.

- [x] **Step 5: Verify green**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: PASS.

### Task 2: Documentation

**Files:**
- Modify: `packages/release-artifacts/README.md`
- Modify: `docs/INSTALL.md`
- Modify: `docs/RELEASE_CHECKLIST.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document:
- release artifacts include Git source provenance;
- provenance includes commit SHA, branch, tracked-change boolean, repository URL from package metadata, and redaction flags;
- provenance ignores untracked files and does not expose changed file paths;
- unavailable Git metadata is represented as unavailable rather than failing artifact generation.

- [x] **Step 2: Run doc gates**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
```

Expected: PASS.

### Task 3: Verification And Publish

- [x] **Step 1: Focused verification**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/tests_release_artifacts.mjs
node --check tests/tests_cli_release_status.mjs
pnpm run test:release-artifacts
pnpm run test:release-status
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
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json
```

- [x] **Step 3: Commit and publish**

Commit message: `feat: add release source provenance metadata`

Push branch `codex/release-source-provenance`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:release-artifacts`.
