# Binary Artifact Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a local binary artifact build and smoke gate for release candidates without claiming public signed native binaries are ready.

**Architecture:** Add a release-binary package entrypoint that writes deterministic launcher artifacts, a checksum file, and a redacted `divinity.release_binary_artifacts.v1` manifest under `dist/binary/`. The launcher artifacts are explicitly marked as Node runtime launchers, not native binaries; release readiness then removes the missing build/smoke blockers but keeps binary downloads blocked by the non-production warning, native binary publishing, and release signing gates.

**Tech Stack:** Node.js ESM, existing `packages/release-artifacts`, tests under `tests/`, package scripts, Markdown docs.

---

## File Map

- Create `tests/scripts_release_binary.mjs`: thin CLI wrapper for `writeReleaseBinaryArtifacts()`.
- Create `tests/tests_release_binary_artifacts.mjs`: verifies generated launchers, checksums, manifest redaction, and launcher smoke behavior.
- Modify `packages/release-artifacts/src/index.mjs`: add binary artifact manifest writer and update binary release readiness metadata.
- Modify `tests/tests_release_artifacts.mjs`: assert the readiness metadata now reports available build/smoke/checksum gates while public downloads remain blocked.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI release status exposes the same updated readiness blockers.
- Modify `tests/tests_package_manifest.mjs`: assert `release:binary` and `test:binary` scripts are registered.
- Modify `package.json`: add `release:binary` and `test:binary`, and include `test:binary` in `test`.
- Modify docs:
  - `README.md`
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Binary Artifact Tests

- [x] **Step 1: Add `tests/tests_release_binary_artifacts.mjs`**

Add a test that runs:

```bash
node tests/scripts_release_binary.mjs --output <tmp>/binary
```

Expected manifest assertions:

```js
assert.equal(result.ok, true);
assert.equal(result.manifest.format, 'divinity.release_binary_artifacts.v1');
assert.equal(result.manifest.status, 'generated');
assert.equal(result.manifest.artifact_type, 'node_launcher');
assert.equal(result.manifest.native_binary, false);
assert.equal(result.manifest.public_download_ready, false);
assert.equal(result.manifest.binary_name, 'divinity');
assert.equal(result.manifest.output_directory, 'dist/binary');
assert.equal(result.manifest.checksums_file, 'SHA256SUMS');
assert.equal(result.manifest.redacts_local_paths, true);
assert.equal(result.manifest.redacts_signing_secrets, true);
assert.equal(result.manifest.artifacts.length, 5);
```

The test must verify all generated files exist under the temp output directory, every artifact sha256 matches its file bytes, `SHA256SUMS` contains the same digests, POSIX launchers are executable, the current-platform launcher can run `doctor` when supported, and serialized JSON does not include `process.cwd()` or the temp output path.

- [x] **Step 2: Add package/release readiness assertions**

Update existing tests so:

- `package.json` has `release:binary: "node tests/scripts_release_binary.mjs"` and `test:binary: "node tests/tests_release_binary_artifacts.mjs"`.
- `binary_release_readiness.build_pipeline.status === "available"`.
- `binary_release_readiness.smoke_gate.status === "available"`.
- `binary_release_readiness.checksum_status === "generated"`.
- blockers are exactly `["non_production_warning", "native_binary_build_pending", "signing_blocked"]`.
- the release gates include `pnpm run test:binary`.

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_binary_artifacts.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: binary artifact test fails because the script/package export does not exist; package/release tests fail on missing scripts and old blockers.

## Task 2: Implement Binary Artifact Writer

- [x] **Step 1: Add package exports**

In `packages/release-artifacts/src/index.mjs`, export:

```js
export const RELEASE_BINARY_ARTIFACTS_FORMAT = 'divinity.release_binary_artifacts.v1';
export const DEFAULT_RELEASE_BINARY_OUTPUT = path.join('dist', 'binary');
```

Add `writeReleaseBinaryArtifacts({ output = DEFAULT_RELEASE_BINARY_OUTPUT, cwd = process.cwd() } = {})`.

- [x] **Step 2: Generate artifacts**

Generate five deterministic launcher artifacts:

- `divinity-linux-x64`
- `divinity-linux-arm64`
- `divinity-darwin-x64`
- `divinity-darwin-arm64`
- `divinity-win32-x64.cmd`

Each POSIX launcher should be executable and run the repo CLI through Node. The Windows artifact is a `.cmd` launcher, not an `.exe`, so the manifest must keep `native_binary: false`.

- [x] **Step 3: Write checksums and manifest**

Write `SHA256SUMS` and `manifest.json`. Return:

```js
{
  ok: true,
  output_directory: absoluteOutputDirectory,
  checksum_path: absoluteChecksumPath,
  manifest_path: absoluteManifestPath,
  manifest
}
```

The returned manifest must store only redacted relative output metadata and no absolute local paths.

- [x] **Step 4: Add script wrapper**

Create `tests/scripts_release_binary.mjs` with `--output` support and JSON output, mirroring `tests/scripts_release_artifacts.mjs`.

- [x] **Step 5: Verify green for binary test**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_binary.mjs
node tests/tests_release_binary_artifacts.mjs
```

Expected: all pass.

## Task 3: Wire Release Metadata and Scripts

- [x] Add `release:binary` and `test:binary` scripts to `package.json`.
- [x] Include `node tests/tests_release_binary_artifacts.mjs` in the full `test` script near release artifact tests.
- [x] Update `buildBinaryReleaseReadiness()` so the generated metadata points at the new local pipeline:
  - `build_pipeline.status: "available"`
  - `build_pipeline.artifact_format: "divinity.release_binary_artifacts.v1"`
  - `smoke_gate.status: "available"`
  - `checksum_status: "generated"`
  - blockers: `non_production_warning`, `native_binary_build_pending`, `signing_blocked`
  - reason states public signed native binary downloads remain blocked.
- [x] Add `pnpm run test:binary` to `release_gates`.

## Task 4: Documentation Updates

- [x] Update README validation guidance for `release:binary` and `test:binary`.
- [x] Update release-artifacts README with `divinity.release_binary_artifacts.v1`.
- [x] Update install guide and release checklist with local binary launcher artifact generation and smoke verification.
- [x] Update architecture, product plan, and research ledger with the new local binary artifact pipeline.

## Task 5: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_binary.mjs
node tests/tests_release_binary_artifacts.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
pnpm run release:binary -- --output "$(mktemp -d)/binary"
pnpm run test:binary
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:package
pnpm run test:public-docs
pnpm run test:deprecations
```

- [x] Run broad checks:

```bash
pnpm run validate:contracts
pnpm run test:package-tarball
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json && git check-ignore -q dist/binary/manifest.json
```

- [x] Commit as `feat: add binary artifact release gate`.
- [ ] Push branch `codex/binary-artifact-pipeline`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:binary`, `pnpm run test:release-artifacts`, and `pnpm run test:release-status`.
