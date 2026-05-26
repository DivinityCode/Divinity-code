# Release Promotion Preflight Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic release promotion preflight manifest that tells operators whether a release candidate may be promoted to public package and signed binary distribution.

**Architecture:** Extend `packages/release-artifacts` with `divinity.release_promotion_preflight.v1`, exposed both inside `release-status` metadata and through a `release:promotion-preflight` writer. The preflight remains blocked while `private: true`, the README production warning, missing registry token, native binary packaging, or signing gates are unresolved; it never publishes, signs, or stores secrets.

**Tech Stack:** Node.js ESM, existing `packages/release-artifacts`, package scripts, tests under `tests/`, Markdown docs.

---

## File Map

- Create `tests/scripts_release_promotion_preflight.mjs`: CLI wrapper for `writeReleasePromotionPreflight()` with `--output` and `--` support.
- Create `tests/tests_release_promotion_preflight.mjs`: verifies promotion preflight output, blockers, target state, gate commands, credential redaction, and generated file behavior.
- Modify `packages/release-artifacts/src/index.mjs`: add constants, `buildReleasePromotionPreflight()`, `writeReleasePromotionPreflight()`, and release manifest integration.
- Modify `package.json`: add `release:promotion-preflight` and `test:release-promotion`, and include the test in `pnpm test`.
- Modify `tests/tests_package_manifest.mjs`: assert the new package scripts.
- Modify `tests/tests_release_artifacts.mjs`: assert `release_promotion_preflight` metadata and release gate.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI `release-status` exposes promotion preflight metadata.
- Modify docs:
  - `README.md`
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`
  - `tests/tests_public_onboarding_docs.mjs`

## Task 1: Failing Promotion Preflight Tests

- [x] **Step 1: Add `tests/tests_release_promotion_preflight.mjs`**

Test command:

```bash
node tests/scripts_release_promotion_preflight.mjs -- --output <tmp>/release-promotion-preflight.json
```

Expected assertions:

```js
assert.equal(result.ok, true);
assert.equal(result.artifact_path, outputPath);
assert.equal(preflight.format, 'divinity.release_promotion_preflight.v1');
assert.equal(preflight.status, 'blocked');
assert.equal(preflight.public_release_ready, false);
assert.equal(preflight.package.name, packageJson.name);
assert.equal(preflight.package.version, packageJson.version);
assert.equal(preflight.package.private, true);
assert.equal(preflight.registry_publish.provenance_required, true);
assert.equal(preflight.registry_publish.token_configured, false);
assert.equal(preflight.binary_distribution.status, 'blocked');
assert.equal(preflight.signing.status, 'blocked');
assert.deepEqual(preflight.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token',
  'native_binary_build_pending',
  'signing_blocked'
]);
```

The test must verify required artifacts include `dist/release-artifacts.json`, `dist/release-bundle/manifest.json`, `dist/release-bundle/attestation.json`, and `dist/binary/manifest.json`; release gates include package, binary, bundle, release-artifacts, release-status, contracts, smoke, and full-suite checks; serialized preflight omits the temp path, `process.cwd()`, `node_modules/`, `secret://`, and raw env secret values.

- [x] **Step 2: Add script and release metadata assertions**

Update existing tests so:

- `package.json` has `release:promotion-preflight: "node tests/scripts_release_promotion_preflight.mjs"`.
- `package.json` has `test:release-promotion: "node tests/tests_release_promotion_preflight.mjs"`.
- `release_promotion_preflight.format === "divinity.release_promotion_preflight.v1"`.
- `release_promotion_preflight.status === "blocked"`.
- `release_promotion_preflight.command === "pnpm run release:promotion-preflight"`.
- `release_promotion_preflight.smoke_test_command === "pnpm run test:release-promotion"`.
- `release_promotion_preflight.blockers` includes `package_private`, `non_production_warning`, `missing_registry_token`, `native_binary_build_pending`, and `signing_blocked`.
- release gates include `pnpm run test:release-promotion`.

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_promotion_preflight.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: missing script, package script, and `release_promotion_preflight` metadata failures.

## Task 2: Implement Promotion Preflight

- [x] **Step 1: Add constants**

In `packages/release-artifacts/src/index.mjs`, export:

```js
export const RELEASE_PROMOTION_PREFLIGHT_FORMAT = 'divinity.release_promotion_preflight.v1';
export const DEFAULT_RELEASE_PROMOTION_PREFLIGHT_OUTPUT = path.join('dist', 'release-promotion-preflight.json');
```

- [x] **Step 2: Add builder**

Implement `buildReleasePromotionPreflight({ packageJson, publishingBlocked, warningActive = true, env = process.env } = {})`. It must return a blocked preflight with package identity, registry publish target, binary distribution target, signing readiness, required artifacts, release gates, blockers, redaction flags, and reason.

- [x] **Step 3: Add writer**

Implement `writeReleasePromotionPreflight({ output = DEFAULT_RELEASE_PROMOTION_PREFLIGHT_OUTPUT, cwd = process.cwd(), env = process.env } = {})` that writes the preflight JSON to disk and returns `{ ok, artifact_path, artifact }`.

- [x] **Step 4: Wire release artifacts**

Add `release_promotion_preflight: buildReleasePromotionPreflight(...)` to `buildReleaseArtifactsManifest()` and add a required gate:

```js
{
  gate_id: 'release_promotion_preflight',
  command: 'pnpm run test:release-promotion',
  required: true
}
```

- [x] **Step 5: Add wrapper script and package scripts**

Create `tests/scripts_release_promotion_preflight.mjs` mirroring other release wrappers and add package scripts:

```json
"release:promotion-preflight": "node tests/scripts_release_promotion_preflight.mjs",
"test:release-promotion": "node tests/tests_release_promotion_preflight.mjs"
```

- [x] **Step 6: Verify green**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_promotion_preflight.mjs
node tests/tests_release_promotion_preflight.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: all pass.

## Task 3: Documentation Updates

- [x] Update README validation guidance for `release:promotion-preflight` and `test:release-promotion`.
- [x] Update release-artifacts README with `divinity.release_promotion_preflight.v1`.
- [x] Update install guide and release checklist with the promotion preflight commands and blocker meaning.
- [x] Update architecture, product plan, and research ledger with the promotion preflight gate.
- [x] Update `tests/tests_public_onboarding_docs.mjs` assertions for the new public docs command.

## Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/scripts_release_promotion_preflight.mjs
node tests/tests_release_promotion_preflight.mjs
node tests/tests_package_manifest.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
pnpm run release:promotion-preflight -- --output "$(mktemp -d)/release-promotion-preflight.json"
pnpm run test:release-promotion
pnpm run test:release-bundle
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:public-docs
```

- [x] Run broad checks:

```bash
pnpm run validate:contracts
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json && git check-ignore -q dist/binary/manifest.json && git check-ignore -q dist/release-bundle/manifest.json && git check-ignore -q dist/release-bundle/attestation.json && git check-ignore -q dist/release-promotion-preflight.json
```

- [ ] Commit as `feat: add release promotion preflight`.
- [ ] Push branch `codex/release-promotion-preflight`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:release-promotion`, `pnpm run test:release-artifacts`, and `pnpm run test:release-status`.
