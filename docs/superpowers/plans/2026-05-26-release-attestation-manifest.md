# Release Attestation Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a redacted, signable release attestation manifest to the local release-candidate bundle so package and binary artifacts have provenance evidence before public publishing is enabled.

**Architecture:** Extend `packages/release-artifacts` with `divinity.release_attestation_readiness.v1` metadata in `release-status` and `divinity.release_attestation.v1` inside `dist/release-bundle/attestation.json`. The attestation records package identity, source provenance, release metadata digest, subject artifact digests, release blockers, and signing status without absolute paths, `node_modules` paths, provider credentials, registry tokens, or signing secret references.

**Tech Stack:** Node.js ESM, existing `packages/release-artifacts`, release bundle writer, Node test scripts under `tests/`, Markdown docs.

---

## File Map

- Modify `packages/release-artifacts/src/index.mjs`: add attestation constants, readiness metadata, attestation builder, and bundle writer integration.
- Modify `tests/tests_release_candidate_bundle.mjs`: assert `attestation.json` exists, is included in the bundle manifest, has valid subject digests, and redacts sensitive/local values.
- Modify `tests/tests_release_artifacts.mjs`: assert release artifacts expose attestation readiness.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI `release-status` exposes attestation readiness.
- Modify docs:
  - `README.md`
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Attestation Tests

- [x] **Step 1: Add bundle attestation assertions**

In `tests/tests_release_candidate_bundle.mjs`, extend the expected bundle file list with:

```js
'attestation.json'
```

Assert:

```js
const attestationArtifact = artifactsById.get('release_attestation');
assert.equal(attestationArtifact.artifact_kind, 'release_attestation');
assert.equal(attestationArtifact.path, 'attestation.json');

const attestation = JSON.parse(readFileSync(path.join(outputDir, 'attestation.json'), 'utf8'));
assert.equal(attestation.format, 'divinity.release_attestation.v1');
assert.equal(attestation.status, 'generated');
assert.equal(attestation.public_release_ready, false);
assert.equal(attestation.package.name, packageJson.name);
assert.equal(attestation.package.version, packageJson.version);
assert.equal(attestation.package.private, true);
assert.equal(attestation.source_provenance.format, 'divinity.release_source_provenance.v1');
assert.equal(attestation.release_metadata.path, 'release-artifacts.json');
assert.match(attestation.release_metadata.sha256, /^[a-f0-9]{64}$/);
assert.equal(attestation.signing.required, true);
assert.equal(attestation.signing.status, 'blocked');
assert.deepEqual(attestation.blockers, [
  'package_private',
  'non_production_warning',
  'native_binary_build_pending',
  'signing_blocked'
]);
assert.equal(attestation.subject_count, attestation.subjects.length);
```

Verify each subject path exists, has a matching sha256/byte count, contains no `absolute_path`, and the serialized attestation omits `process.cwd()`, the temp output path, `node_modules/`, `secret://`, `NPM_TOKEN`, and signing key/identity values.

- [x] **Step 2: Add readiness assertions**

Update `tests/tests_release_artifacts.mjs` and `tests/tests_cli_release_status.mjs` to assert:

```js
release_attestation.format === 'divinity.release_attestation_readiness.v1'
release_attestation.status === 'blocked'
release_attestation.artifact_format === 'divinity.release_attestation.v1'
release_attestation.attestation_path === 'dist/release-bundle/attestation.json'
release_attestation.build_command === 'pnpm run release:bundle'
release_attestation.smoke_test_command === 'pnpm run test:release-bundle'
release_attestation.signing_required === true
release_attestation.signing_status === 'blocked'
release_attestation.blockers includes package_private, non_production_warning, native_binary_build_pending, signing_blocked
release_attestation.redacts_local_paths === true
release_attestation.redacts_signing_secrets === true
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_candidate_bundle.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: failures on missing `attestation.json` and missing `release_attestation` readiness metadata.

## Task 2: Implement Attestation Metadata

- [x] **Step 1: Add constants**

In `packages/release-artifacts/src/index.mjs`, export:

```js
export const RELEASE_ATTESTATION_FORMAT = 'divinity.release_attestation.v1';
export const RELEASE_ATTESTATION_READINESS_FORMAT = 'divinity.release_attestation_readiness.v1';
```

- [x] **Step 2: Add readiness builder**

Implement `buildReleaseAttestationReadiness({ publishingBlocked, warningActive = true } = {})` returning the metadata asserted in Task 1. Reuse `releaseBundleBlockers()`.

- [x] **Step 3: Add attestation builder**

Implement `buildReleaseAttestation({ packageJson, releaseArtifact, subjects, blockers })` that returns:

```js
{
  format: RELEASE_ATTESTATION_FORMAT,
  generated_by: 'packages/release-artifacts',
  status: 'generated',
  predicate_type: 'divinity.release_candidate_bundle.provenance.v1',
  public_release_ready: false,
  package: { name, version, private },
  source_provenance,
  release_metadata: { path: 'release-artifacts.json', sha256, bytes, format },
  build: { build_type, package_manager, node_engine, commands },
  signing: { required, status, blockers, redacts_signing_secrets },
  blockers,
  redacts_local_paths: true,
  redacts_signing_secrets: true,
  subject_count,
  subjects
}
```

Subjects must be copied from bundle artifacts with only `artifact_id`, `artifact_kind`, `path`, `bytes`, and `sha256`.

- [x] **Step 4: Wire bundle writer**

In `writeReleaseCandidateBundle()`, write `attestation.json` after the initial subject artifact list is built and before the top-level `SHA256SUMS` is written. Add the attestation artifact to the bundle artifact list so top-level checksums and `manifest.json` include it. Do not include the attestation itself as a subject to avoid circular provenance.

- [x] **Step 5: Verify green**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_candidate_bundle.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: all pass.

## Task 3: Documentation Updates

- [x] Update README validation guidance to mention bundle attestation.
- [x] Update release-artifacts README with `divinity.release_attestation.v1`.
- [x] Update install guide and release checklist with attestation verification.
- [x] Update architecture, product plan, and research ledger with the release attestation slice.

## Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_candidate_bundle.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
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
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json && git check-ignore -q dist/binary/manifest.json && git check-ignore -q dist/release-bundle/manifest.json && git check-ignore -q dist/release-bundle/attestation.json
```

- [ ] Commit as `feat: add release attestation manifest`.
- [ ] Push branch `codex/release-attestation-manifest`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:release-bundle`, `pnpm run test:release-artifacts`, and `pnpm run test:release-status`.
