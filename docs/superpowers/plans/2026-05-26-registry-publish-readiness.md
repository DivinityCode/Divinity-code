# Registry Publish Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make npm registry publishing readiness explicit in release artifacts without publishing, clearing `private: true`, removing the README warning, or exposing registry tokens.

**Architecture:** Extend `packages/release-artifacts` with a redacted `registry_publish_readiness` object inside `divinity.release_artifacts.v1`. The object reports package name/version, registry URL, provenance requirement, publish/dry-run commands, token env-var name, token configured boolean, redaction guarantees, and blockers while keeping actual token values and local paths out of CLI and generated metadata.

**Tech Stack:** Node.js ESM, existing release artifact manifest, CLI `release-status`, Node assertion tests, Markdown docs.

---

## File Map

- Modify `packages/release-artifacts/src/index.mjs`: add registry publish readiness metadata builder and wire it into `buildReleaseArtifactsManifest()`.
- Modify `tests/tests_release_artifacts.mjs`: assert generated release artifacts include blocked, token-redacted registry publish readiness metadata.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI `release-status` exposes the same registry readiness and redacts `NPM_TOKEN` values.
- Modify docs:
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Registry Publish Readiness Tests

- [x] **Step 1: Add release artifact assertions**

In `tests/tests_release_artifacts.mjs`, after the package metadata assertions, add:

```js
assert.equal(artifact.registry_publish_readiness.format, 'divinity.release_registry_publish_readiness.v1');
assert.equal(artifact.registry_publish_readiness.status, 'blocked');
assert.equal(artifact.registry_publish_readiness.package_name, packageJson.name);
assert.equal(artifact.registry_publish_readiness.package_version, packageJson.version);
assert.equal(artifact.registry_publish_readiness.registry_url, 'https://registry.npmjs.org/');
assert.equal(artifact.registry_publish_readiness.provenance_required, true);
assert.equal(artifact.registry_publish_readiness.publish_command, 'npm publish --provenance --access public');
assert.equal(artifact.registry_publish_readiness.dry_run_command, 'npm publish --dry-run --provenance --access public');
assert.equal(artifact.registry_publish_readiness.token_env_var, 'NPM_TOKEN');
assert.equal(artifact.registry_publish_readiness.token_configured, false);
assert.equal(artifact.registry_publish_readiness.redacts_token, true);
assert.equal(artifact.registry_publish_readiness.redacts_local_paths, true);
assert.deepEqual(artifact.registry_publish_readiness.blockers, [
  'package_private',
  'non_production_warning',
  'missing_registry_token'
]);
assert.equal(JSON.stringify(artifact.registry_publish_readiness).includes(process.cwd()), false);
```

Also add a configured-token case after the configured signing artifact:

```js
const configuredPublishArtifact = buildReleaseArtifactsManifest({
  cwd: process.cwd(),
  env: { NPM_TOKEN: 'npm-secret-token-value' }
});
assert.equal(configuredPublishArtifact.registry_publish_readiness.status, 'blocked');
assert.equal(configuredPublishArtifact.registry_publish_readiness.token_configured, true);
assert.deepEqual(configuredPublishArtifact.registry_publish_readiness.blockers, [
  'package_private',
  'non_production_warning'
]);
assert.equal(JSON.stringify(configuredPublishArtifact).includes('npm-secret-token-value'), false);
```

- [x] **Step 2: Add CLI release-status assertions**

In `tests/tests_cli_release_status.mjs`, after the package/private warning assertions, add:

```js
assert.equal(result.release.registry_publish_readiness.format, 'divinity.release_registry_publish_readiness.v1');
assert.equal(result.release.registry_publish_readiness.status, 'blocked');
assert.equal(result.release.registry_publish_readiness.provenance_required, true);
assert.equal(result.release.registry_publish_readiness.token_env_var, 'NPM_TOKEN');
assert.equal(result.release.registry_publish_readiness.token_configured, false);
assert.equal(result.release.registry_publish_readiness.redacts_token, true);
assert.ok(result.release.registry_publish_readiness.blockers.includes('package_private'));
assert.ok(result.release.registry_publish_readiness.blockers.includes('non_production_warning'));
```

Add a configured-token CLI case after the configured signing assertions:

```js
const tokenConfiguredResult = runCli(['release-status'], {
  cwd: mkdtempSync(path.join(tmpdir(), 'divinity-release-status-registry-token-')),
  env: {
    ...process.env,
    NPM_TOKEN: 'npm-secret-token-value'
  }
});
assert.equal(tokenConfiguredResult.release.registry_publish_readiness.token_configured, true);
assert.equal(JSON.stringify(tokenConfiguredResult).includes('npm-secret-token-value'), false);
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: both fail because `registry_publish_readiness` is not present.

## Task 2: Implement Registry Publish Readiness Metadata

- [x] **Step 1: Add metadata builder**

In `packages/release-artifacts/src/index.mjs`, add:

```js
export const RELEASE_REGISTRY_PUBLISH_READINESS_FORMAT = 'divinity.release_registry_publish_readiness.v1';
export const NPM_TOKEN_ENV = 'NPM_TOKEN';
```

Add:

```js
function buildRegistryPublishReadiness({ packageJson, publishingBlocked, warningActive = true, env = process.env }) {
  const tokenConfigured = Boolean(cleanString(env[NPM_TOKEN_ENV]));
  const blockers = [];
  if (publishingBlocked) blockers.push('package_private');
  if (warningActive) blockers.push('non_production_warning');
  if (!tokenConfigured) blockers.push('missing_registry_token');
  const status = blockers.length ? 'blocked' : 'ready';
  return {
    format: RELEASE_REGISTRY_PUBLISH_READINESS_FORMAT,
    status,
    package_name: packageJson.name,
    package_version: packageJson.version,
    registry_url: 'https://registry.npmjs.org/',
    provenance_required: true,
    publish_command: 'npm publish --provenance --access public',
    dry_run_command: 'npm publish --dry-run --provenance --access public',
    token_env_var: NPM_TOKEN_ENV,
    token_configured: tokenConfigured,
    redacts_token: true,
    redacts_local_paths: true,
    blockers,
    reason: status === 'ready'
      ? 'Registry publishing metadata is ready once release gates pass.'
      : 'Registry publishing remains blocked until package privacy, production warning, and token readiness gates clear.'
  };
}
```

- [x] **Step 2: Wire manifest**

In `buildReleaseArtifactsManifest()`, include:

```js
registry_publish_readiness: buildRegistryPublishReadiness({
  packageJson,
  publishingBlocked,
  warningActive: true,
  env
}),
```

Place it beside `artifact_signing` so release metadata groups publishing/signing readiness together.

- [x] **Step 3: Verify green**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: all pass.

## Task 3: Update Documentation

- [x] **Step 1: Update release package docs**

Update `packages/release-artifacts/README.md` and `docs/INSTALL.md` to state that release metadata reports npm registry publish readiness with `npm publish --provenance --access public`, token readiness via `NPM_TOKEN`, and redaction guarantees while publishing stays blocked.

- [x] **Step 2: Update release checklist**

Update `docs/RELEASE_CHECKLIST.md` review commands to print `registry_publish_readiness.status`, `token_configured`, and blockers. Add a checklist item confirming `NPM_TOKEN` values are not printed.

- [x] **Step 3: Update architecture and product/research notes**

Update `docs/ARCHITECTURE.md`, `docs/PRODUCT_PLAN.md`, and `docs/REPOSITORY_RESEARCH.md` so public release packaging lists registry publish readiness beside source provenance, SBOM, integrity, and signing readiness. Append research ledger item:

```markdown
68. **Registry publish readiness:** added redacted npm registry publish readiness metadata to release artifacts and CLI release status, including provenance publish commands, `NPM_TOKEN` configured state, blockers, and token/path redaction while package publishing remains blocked by `private: true` and the non-production warning.
```

## Task 4: Verification And Publish

- [x] **Step 1: Focused checks**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
pnpm run test:release-artifacts
pnpm run test:release-status
pnpm run test:public-docs
pnpm run test:deprecations
```

- [x] **Step 2: Broad gates**

Run:

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

- [ ] **Step 3: Commit and publish**

Commit message:

```bash
feat: add registry publish readiness metadata
```

Push branch `codex/registry-publish-readiness`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun:

```bash
pnpm run test:release-artifacts
pnpm run test:release-status
```

## Self Review

- Spec coverage: The plan advances public distribution readiness by adding explicit npm registry publish readiness metadata without publishing, clearing safety gates, or exposing tokens.
- Placeholder scan: No placeholders are present; each code and command step has concrete content.
- Type consistency: The new field is `registry_publish_readiness`, format is `divinity.release_registry_publish_readiness.v1`, and token readiness uses `NPM_TOKEN` consistently.
