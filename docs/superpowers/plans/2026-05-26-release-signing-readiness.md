# Release Signing Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make release signing inputs explicit and testable in release artifacts without publishing packages or removing the non-production warning.

**Architecture:** Extend `packages/release-artifacts` to report redacted signing input readiness from environment configuration. The manifest keeps `artifact_signing.status: "blocked"` while `package.json` remains private and the README warning is active, but exposes whether a future signing command, command args, key reference, and identity have been configured without storing their raw values.

**Tech Stack:** Node.js ESM, release artifact package, CLI `release-status`, package/docs test scripts.

---

### Task 1: Release Signing Metadata Contract

**Files:**
- Modify: `tests/tests_release_artifacts.mjs`
- Modify: `tests/tests_cli_release_status.mjs`
- Modify: `packages/release-artifacts/src/index.mjs`

- [x] **Step 1: Add failing release artifact assertions**

In `tests/tests_release_artifacts.mjs`, import `buildReleaseArtifactsManifest()` and assert:

```js
const configuredSigningArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
    DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
  }
});
assert.equal(configuredSigningArtifact.artifact_signing.status, 'blocked');
assert.equal(configuredSigningArtifact.artifact_signing.configuration.status, 'configured');
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_absolute, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.command_args_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.key_ref_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.identity_configured, true);
assert.equal(configuredSigningArtifact.artifact_signing.configuration.ready_when_release_gates_clear, true);
assert.equal(JSON.stringify(configuredSigningArtifact).includes('secret://divinity/release/signing-key'), false);
assert.equal(JSON.stringify(configuredSigningArtifact).includes('release@example.com'), false);
```

Also assert an invalid relative command reports `status: "invalid"` and does not throw:

```js
const invalidSigningArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: {
    DIVINITY_RELEASE_SIGNING_COMMAND: 'cosign',
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['sign'])
  }
});
assert.equal(invalidSigningArtifact.artifact_signing.configuration.status, 'invalid');
assert.match(invalidSigningArtifact.artifact_signing.configuration.reason, /absolute executable path/);
```

- [x] **Step 2: Add failing CLI release-status assertions**

In `tests/tests_cli_release_status.mjs`, allow `runCli()` to receive an `env`, then run:

```js
const configuredResult = runCli(['release-status'], {
  cwd: mkdtempSync(path.join(tmpdir(), 'divinity-release-status-signing-')),
  env: {
    ...process.env,
    DIVINITY_RELEASE_SIGNING_COMMAND: process.execPath,
    DIVINITY_RELEASE_SIGNING_COMMAND_ARGS: JSON.stringify(['--version']),
    DIVINITY_RELEASE_SIGNING_KEY_REF: 'secret://divinity/release/signing-key',
    DIVINITY_RELEASE_SIGNING_IDENTITY: 'release@example.com'
  }
});
assert.equal(configuredResult.release.artifact_signing.configuration.status, 'configured');
assert.equal(configuredResult.release.artifact_signing.configuration.ready_when_release_gates_clear, true);
assert.equal(JSON.stringify(configuredResult).includes('secret://divinity/release/signing-key'), false);
assert.equal(JSON.stringify(configuredResult).includes('release@example.com'), false);
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: FAIL because `artifact_signing.configuration` is not present yet.

- [x] **Step 4: Implement signing readiness metadata**

In `packages/release-artifacts/src/index.mjs`:
- add env constants:
  - `DIVINITY_RELEASE_SIGNING_COMMAND`
  - `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS`
  - `DIVINITY_RELEASE_SIGNING_KEY_REF`
  - `DIVINITY_RELEASE_SIGNING_IDENTITY`
- parse command args as a JSON string array but do not store the argument values in the manifest;
- require configured signing commands to be absolute, reporting invalid metadata instead of throwing;
- report only booleans, env var names, status, and a redacted reason;
- keep `artifact_signing.status: "blocked"` while the package is private and the non-production warning is active.

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
- release signing input readiness uses redacted env-driven metadata;
- `DIVINITY_RELEASE_SIGNING_COMMAND` must be an absolute executable path;
- `DIVINITY_RELEASE_SIGNING_COMMAND_ARGS` must be a JSON array of strings;
- `DIVINITY_RELEASE_SIGNING_KEY_REF` and `DIVINITY_RELEASE_SIGNING_IDENTITY` are reported as configured booleans only;
- publishing and signing remain blocked while the non-production warning and `private: true` gates are active.

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

- [ ] **Step 3: Commit and publish**

Commit message: `feat: add release signing readiness metadata`

Push branch `codex/release-signing-readiness`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:release-artifacts`.
