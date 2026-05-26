# Release Candidate Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a single release-candidate bundle gate that assembles the local package tarball, release metadata, binary launcher artifacts, and checksums for review before public publishing is enabled.

**Architecture:** Extend `packages/release-artifacts` with a `writeReleaseCandidateBundle()` writer and a `divinity.release_candidate_bundle.v1` manifest under `dist/release-bundle/`. The bundle reuses the existing release-artifact manifest and binary launcher writer, runs `npm pack` into the bundle, writes bundle-level `SHA256SUMS`, and stores only relative bundle paths in the manifest while keeping package registry and signed native binary publishing blocked.

**Tech Stack:** Node.js ESM, existing `packages/release-artifacts`, npm pack, tests under `tests/`, package scripts, Markdown docs.

---

## File Map

- Create `tests/scripts_release_bundle.mjs`: thin CLI wrapper for `writeReleaseCandidateBundle()`.
- Create `tests/tests_release_candidate_bundle.mjs`: verifies bundle contents, checksums, manifest redaction, package tarball presence, release artifact metadata, and binary artifact metadata.
- Modify `packages/release-artifacts/src/index.mjs`: add bundle constants, bundle writer, bundle readiness metadata, and release gate entry.
- Modify `tests/tests_release_artifacts.mjs`: assert release manifests expose bundle readiness and the new bundle gate.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI release status exposes bundle readiness.
- Modify `tests/tests_package_manifest.mjs`: assert `release:bundle` and `test:release-bundle` scripts are registered.
- Modify `package.json`: add `release:bundle` and `test:release-bundle`, and include the bundle test in `test`.
- Modify docs:
  - `README.md`
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Bundle Tests

- [x] **Step 1: Add `tests/tests_release_candidate_bundle.mjs`**

Add a test that runs:

```bash
node tests/scripts_release_bundle.mjs -- --output <tmp>/bundle
```

Expected manifest assertions:

```js
assert.equal(result.ok, true);
assert.equal(result.manifest.format, 'divinity.release_candidate_bundle.v1');
assert.equal(result.manifest.status, 'generated');
assert.equal(result.manifest.public_release_ready, false);
assert.equal(result.manifest.output_directory, 'dist/release-bundle');
assert.equal(result.manifest.checksums_file, 'SHA256SUMS');
assert.equal(result.manifest.redacts_local_paths, true);
assert.equal(result.manifest.redacts_signing_secrets, true);
assert.deepEqual(result.manifest.blockers, [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
```

The test must verify:

- `release-artifacts.json`, `package/divinity-code-0.1.0.tgz`, `binary/manifest.json`, `binary/SHA256SUMS`, and top-level `SHA256SUMS` exist.
- top-level bundle artifact sha256 values match file bytes.
- the package tarball has `artifact_kind: "package_tarball"`.
- the binary manifest artifact has `artifact_kind: "binary_manifest"`.
- serialized bundle manifest omits `process.cwd()`, the temp output path, `node_modules/`, and `secret://`.

- [x] **Step 2: Add script/release readiness assertions**

Update existing tests so:

- `package.json` has `release:bundle: "node tests/scripts_release_bundle.mjs"` and `test:release-bundle: "node tests/tests_release_candidate_bundle.mjs"`.
- `release_candidate_bundle.format === "divinity.release_candidate_bundle_readiness.v1"`.
- `release_candidate_bundle.status === "blocked"`.
- `release_candidate_bundle.build_command === "pnpm run release:bundle"`.
- `release_candidate_bundle.smoke_test_command === "pnpm run test:release-bundle"`.
- blockers include `package_private`, `non_production_warning`, `native_binary_build_pending`, and `signing_blocked`.
- release gates include `pnpm run test:release-bundle`.

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_candidate_bundle.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: bundle test fails because the script does not exist; package/release tests fail on missing scripts and readiness metadata.

## Task 2: Implement Release Candidate Bundle Writer

- [x] **Step 1: Add package exports**

In `packages/release-artifacts/src/index.mjs`, export:

```js
export const RELEASE_CANDIDATE_BUNDLE_FORMAT = 'divinity.release_candidate_bundle.v1';
export const RELEASE_CANDIDATE_BUNDLE_READINESS_FORMAT = 'divinity.release_candidate_bundle_readiness.v1';
export const DEFAULT_RELEASE_BUNDLE_OUTPUT = path.join('dist', 'release-bundle');
```

- [x] **Step 2: Add `writeReleaseCandidateBundle()`**

Implement `writeReleaseCandidateBundle({ output = DEFAULT_RELEASE_BUNDLE_OUTPUT, cwd = process.cwd(), npmCommand = defaultNpmCommand() } = {})` that:

- writes `release-artifacts.json` in the bundle root using `buildReleaseArtifactsManifest()`;
- runs `npm pack --json --pack-destination <bundle>/package`;
- calls `writeReleaseBinaryArtifacts({ cwd, output: <bundle>/binary })`;
- writes top-level `SHA256SUMS`;
- writes `manifest.json` with relative bundle artifact paths and blockers.

- [x] **Step 3: Add script wrapper**

Create `tests/scripts_release_bundle.mjs` with `--output` support, `--` separator support, and JSON output, mirroring `tests/scripts_release_binary.mjs`.

- [x] **Step 4: Verify green for bundle test**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_bundle.mjs
node tests/tests_release_candidate_bundle.mjs
```

Expected: all pass.

## Task 3: Wire Scripts And Release Metadata

- [x] Add `release:bundle` and `test:release-bundle` scripts to `package.json`.
- [x] Include `node tests/tests_release_candidate_bundle.mjs` in the full `test` script near release artifact tests.
- [x] Add `buildReleaseCandidateBundleReadiness()` to release artifacts:
  - format `divinity.release_candidate_bundle_readiness.v1`
  - status `blocked`
  - build command `pnpm run release:bundle`
  - smoke command `pnpm run test:release-bundle`
  - includes `package_tarball`, `release_artifacts_manifest`, and `binary_artifacts_manifest`
  - blockers `package_private`, `non_production_warning`, `native_binary_build_pending`, `signing_blocked`
- [x] Add `pnpm run test:release-bundle` to release gates.

## Task 4: Documentation Updates

- [x] Update README validation guidance for `release:bundle` and `test:release-bundle`.
- [x] Update release-artifacts README with `divinity.release_candidate_bundle.v1`.
- [x] Update install guide and release checklist with the bundle generation/smoke commands.
- [x] Update architecture, product plan, and research ledger with the release-candidate bundle gate.

## Task 5: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_bundle.mjs
node tests/tests_release_candidate_bundle.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
pnpm run release:bundle -- --output "$(mktemp -d)/bundle"
pnpm run test:release-bundle
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
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json && git check-ignore -q dist/binary/manifest.json && git check-ignore -q dist/release-bundle/manifest.json
```

- [ ] Commit as `feat: add release candidate bundle gate`.
- [ ] Push branch `codex/release-candidate-bundle`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:release-bundle`, `pnpm run test:release-artifacts`, and `pnpm run test:release-status`.
