# Binary Release Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make signed binary download readiness explicit in release artifacts without publishing binaries, clearing `private: true`, removing the README warning, or pretending a binary build pipeline exists.

**Architecture:** Extend `packages/release-artifacts` with a redacted `binary_release_readiness` object inside `divinity.release_artifacts.v1`. The object reports target binary filenames, build/smoke command placeholders, checksum and signing requirements, blockers, and redaction guarantees while keeping binary downloads blocked under the existing release gates.

**Tech Stack:** Node.js ESM, existing release artifact manifest, CLI `release-status`, Node assertion tests, Markdown docs.

---

## File Map

- Modify `packages/release-artifacts/src/index.mjs`: add binary release readiness metadata builder and wire it into `buildReleaseArtifactsManifest()`.
- Modify `tests/tests_release_artifacts.mjs`: assert generated release artifacts include blocked, redacted binary release readiness metadata.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI `release-status` exposes the same binary release readiness metadata.
- Modify docs:
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Binary Release Readiness Tests

- [x] **Step 1: Add release artifact assertions**

In `tests/tests_release_artifacts.mjs`, assert:

- `artifact.binary_release_readiness.format === 'divinity.release_binary_readiness.v1'`
- `status === 'blocked'`
- `artifact_id === 'binary_download'`
- `binary_name === 'divinity'`
- build command is `pnpm run release:binary`
- smoke command is `pnpm run test:binary`
- signing and checksum requirements are `true`
- supported target filenames are deterministic for Linux, macOS, and Windows x64/arm64 where applicable
- blockers include `non_production_warning`, `missing_binary_build_pipeline`, `missing_binary_smoke_gate`, and `signing_blocked`
- serialized metadata excludes `process.cwd()`
- existing install-path and artifact-signing binary targets remain blocked

- [x] **Step 2: Add CLI release-status assertions**

In `tests/tests_cli_release_status.mjs`, assert CLI `release-status` exposes the same binary readiness format, blocked status, commands, target count, blocker list, and no local working directory path.

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: both fail because `binary_release_readiness` is not present.

## Task 2: Implement Binary Release Readiness Metadata

- [x] **Step 1: Add metadata builder**

In `packages/release-artifacts/src/index.mjs`, add:

```js
export const RELEASE_BINARY_READINESS_FORMAT = 'divinity.release_binary_readiness.v1';
```

Add `buildBinaryReleaseReadiness()` that returns blocked metadata with deterministic target filenames:

- `divinity-linux-x64`
- `divinity-linux-arm64`
- `divinity-darwin-x64`
- `divinity-darwin-arm64`
- `divinity-win32-x64.exe`

The builder must not read or serialize signing keys, local paths, or generated binary artifacts.

- [x] **Step 2: Wire into manifest**

Add `binary_release_readiness` beside `artifact_signing` and `registry_publish_readiness` in `buildReleaseArtifactsManifest()`.

- [x] **Step 3: Verify green**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: all pass.

## Task 3: Documentation Updates

- [x] Update `packages/release-artifacts/README.md` with the new binary readiness field.
- [x] Update `docs/INSTALL.md` to clarify binary downloads remain blocked and what readiness metadata reports.
- [x] Update `docs/RELEASE_CHECKLIST.md` with a binary readiness inspection command and checklist item.
- [x] Update `docs/ARCHITECTURE.md`, `docs/PRODUCT_PLAN.md`, and `docs/REPOSITORY_RESEARCH.md` with the new release packaging status.

## Task 4: Verification

- [x] Run focused checks:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:public-docs
pnpm run test:deprecations
```

- [x] Run broad checks:

```bash
pnpm run validate:contracts
pnpm run test:package
pnpm run test:package-tarball
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json
```

## Task 5: Publish

- [x] Commit as `feat: add binary release readiness metadata`.
- [ ] Push branch `codex/binary-release-readiness`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:release-artifacts` plus `pnpm run test:release-status`.
