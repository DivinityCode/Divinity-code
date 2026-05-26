# Release SBOM Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deterministic release SBOM metadata to release artifacts and CLI `release-status` so release candidates expose package/dependency inventory before public publishing is unblocked.

**Architecture:** Extend `packages/release-artifacts` with a `divinity.release_sbom.v1` manifest built from `package.json` plus `package-lock.json`. Keep this SBOM inventory lightweight and redacted: include package names, versions, dependency scope, direct/transitive relationship, and requested ranges only; do not include local absolute paths, `node_modules` paths, registry URLs, lockfile integrity hashes, prompts, credentials, or generated state.

**Tech Stack:** Node.js ESM, npm lockfile v3 metadata, existing `packages/release-artifacts`, existing CLI `release-status`, Markdown docs, package scripts.

---

## File Map

- Modify `packages/release-artifacts/src/index.mjs`: add `RELEASE_SBOM_FORMAT`, parse package-lock packages, build deterministic SBOM components, and include `release_sbom` in `divinity.release_artifacts.v1`.
- Modify `tests/tests_release_artifacts.mjs`: assert generated SBOM metadata, direct/dev/transitive components, sort order, and redaction.
- Modify `tests/tests_cli_release_status.mjs`: assert CLI `release-status` exposes the same SBOM summary without unsafe paths or lockfile-only fields.
- Modify docs:
  - `packages/release-artifacts/README.md`
  - `docs/INSTALL.md`
  - `docs/RELEASE_CHECKLIST.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing SBOM Tests

- [x] **Step 1: Add release artifact SBOM assertions**

In `tests/tests_release_artifacts.mjs`, load `package-lock.json` beside `package.json`:

```js
const packageLock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
```

Add these assertions after the source provenance assertions and before artifact integrity assertions:

```js
assert.equal(artifact.release_sbom.format, 'divinity.release_sbom.v1');
assert.equal(artifact.release_sbom.status, 'generated');
assert.equal(artifact.release_sbom.source, 'package-lock.json');
assert.equal(artifact.release_sbom.package_manager, 'npm');
assert.equal(artifact.release_sbom.lockfile_version, packageLock.lockfileVersion);
assert.equal(artifact.release_sbom.generated_from_package_files, true);
assert.equal(artifact.release_sbom.redacts_local_paths, true);
assert.equal(artifact.release_sbom.redacts_registry_urls, true);
assert.equal(artifact.release_sbom.redacts_integrity_values, true);
assert.equal(artifact.release_sbom.component_count, artifact.release_sbom.components.length);
assert.ok(artifact.release_sbom.component_count >= 4);

const sbomComponentsById = new Map(artifact.release_sbom.components.map(component => [component.component_id, component]));
const rootComponent = sbomComponentsById.get('npm:divinity-code@0.1.0');
assert.ok(rootComponent, 'missing root SBOM component');
assert.equal(rootComponent.component_type, 'application');
assert.equal(rootComponent.dependency_type, 'root');
assert.equal(rootComponent.direct, false);

const ajvComponent = artifact.release_sbom.components.find(component => component.name === 'ajv');
assert.ok(ajvComponent, 'missing ajv SBOM component');
assert.equal(ajvComponent.version, packageLock.packages['node_modules/ajv'].version);
assert.equal(ajvComponent.component_type, 'library');
assert.equal(ajvComponent.dependency_type, 'development');
assert.equal(ajvComponent.direct, true);
assert.equal(ajvComponent.requested_range, packageJson.devDependencies.ajv);

const ajvFormatsComponent = artifact.release_sbom.components.find(component => component.name === 'ajv-formats');
assert.ok(ajvFormatsComponent, 'missing ajv-formats SBOM component');
assert.equal(ajvFormatsComponent.dependency_type, 'development');
assert.equal(ajvFormatsComponent.direct, true);

const transitiveComponent = artifact.release_sbom.components.find(component => component.name === 'fast-deep-equal');
assert.ok(transitiveComponent, 'missing transitive SBOM component');
assert.equal(transitiveComponent.dependency_type, 'transitive');
assert.equal(transitiveComponent.direct, false);
assert.equal(transitiveComponent.requested_range, '');

const componentIds = artifact.release_sbom.components.map(component => component.component_id);
assert.deepEqual([...componentIds].sort(), componentIds);
for (const component of artifact.release_sbom.components) {
  assert.equal(Object.hasOwn(component, 'path'), false);
  assert.equal(Object.hasOwn(component, 'resolved'), false);
  assert.equal(Object.hasOwn(component, 'integrity'), false);
}
```

Add SBOM-specific disallowed strings to the serialized artifact assertions:

```js
'node_modules/',
process.cwd()
```

- [x] **Step 2: Add CLI release-status SBOM assertions**

In `tests/tests_cli_release_status.mjs`, add after the source provenance assertions:

```js
assert.equal(result.release.release_sbom.format, 'divinity.release_sbom.v1');
assert.equal(result.release.release_sbom.status, 'generated');
assert.equal(result.release.release_sbom.component_count, result.release.release_sbom.components.length);
assert.ok(result.release.release_sbom.components.some(component => (
  component.component_id === 'npm:divinity-code@0.1.0' &&
  component.dependency_type === 'root'
)));
assert.ok(result.release.release_sbom.components.some(component => (
  component.name === 'ajv' &&
  component.dependency_type === 'development' &&
  component.direct === true
)));
assert.equal(JSON.stringify(result.release.release_sbom).includes('node_modules/'), false);
assert.equal(JSON.stringify(result.release.release_sbom).includes(process.cwd()), false);
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_release_artifacts.mjs
```

Expected: FAIL because `artifact.release_sbom` is undefined.

Then run:

```bash
node tests/tests_cli_release_status.mjs
```

Expected: FAIL because `result.release.release_sbom` is undefined.

## Task 2: Implement SBOM Metadata

- [x] **Step 1: Add constants and lockfile loading**

In `packages/release-artifacts/src/index.mjs` add:

```js
export const RELEASE_SBOM_FORMAT = 'divinity.release_sbom.v1';
```

Add a `readPackageLock(root)` helper that reads `package-lock.json` and returns `null` if the file is missing or invalid:

```js
function readPackageLock(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  } catch {
    return null;
  }
}
```

- [x] **Step 2: Add SBOM component helpers**

Add these helpers before `buildReleaseArtifactsManifest()`:

```js
function packageNameFromLockPath(lockPath) {
  const normalized = cleanString(lockPath).split(path.sep).join('/');
  if (!normalized.startsWith('node_modules/')) return '';
  const parts = normalized.slice('node_modules/'.length).split('/');
  if (parts[0]?.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
  }
  return parts[0] || '';
}

function directDependencyType(name, packageJson) {
  if (Object.hasOwn(packageJson.dependencies || {}, name)) return 'production';
  if (Object.hasOwn(packageJson.devDependencies || {}, name)) return 'development';
  if (Object.hasOwn(packageJson.optionalDependencies || {}, name)) return 'optional';
  if (Object.hasOwn(packageJson.peerDependencies || {}, name)) return 'peer';
  return '';
}

function requestedRange(name, packageJson) {
  return cleanString(
    (packageJson.dependencies || {})[name] ||
    (packageJson.devDependencies || {})[name] ||
    (packageJson.optionalDependencies || {})[name] ||
    (packageJson.peerDependencies || {})[name]
  );
}

function componentId(name, version) {
  return `npm:${name}@${version}`;
}
```

- [x] **Step 3: Build release SBOM**

Add `buildReleaseSbom({ packageJson, packageLock })`:

```js
function buildReleaseSbom({ packageJson, packageLock }) {
  if (!packageLock || !packageLock.packages || typeof packageLock.packages !== 'object') {
    return {
      format: RELEASE_SBOM_FORMAT,
      status: 'unavailable',
      source: 'package-lock.json',
      package_manager: 'npm',
      lockfile_version: null,
      generated_from_package_files: true,
      redacts_local_paths: true,
      redacts_registry_urls: true,
      redacts_integrity_values: true,
      component_count: 0,
      components: [],
      reason: 'package-lock.json was unavailable or invalid when release metadata was generated.'
    };
  }

  const components = [{
    component_id: componentId(packageJson.name, packageJson.version),
    name: packageJson.name,
    version: packageJson.version,
    component_type: 'application',
    dependency_type: 'root',
    direct: false,
    requested_range: '',
    license: cleanString(packageJson.license)
  }];

  for (const [lockPath, entry] of Object.entries(packageLock.packages)) {
    if (!lockPath || lockPath === '') continue;
    const name = packageNameFromLockPath(lockPath);
    const version = cleanString(entry?.version);
    if (!name || !version) continue;
    const directType = directDependencyType(name, packageJson);
    components.push({
      component_id: componentId(name, version),
      name,
      version,
      component_type: 'library',
      dependency_type: directType || 'transitive',
      direct: Boolean(directType),
      requested_range: directType ? requestedRange(name, packageJson) : '',
      license: cleanString(entry?.license)
    });
  }

  components.sort((left, right) => left.component_id.localeCompare(right.component_id));
  const uniqueComponents = [];
  const seen = new Set();
  for (const component of components) {
    if (seen.has(component.component_id)) continue;
    seen.add(component.component_id);
    uniqueComponents.push(component);
  }

  return {
    format: RELEASE_SBOM_FORMAT,
    status: 'generated',
    source: 'package-lock.json',
    package_manager: 'npm',
    lockfile_version: packageLock.lockfileVersion || null,
    generated_from_package_files: true,
    redacts_local_paths: true,
    redacts_registry_urls: true,
    redacts_integrity_values: true,
    component_count: uniqueComponents.length,
    components: uniqueComponents
  };
}
```

- [x] **Step 4: Include SBOM in manifest**

Inside `buildReleaseArtifactsManifest()`, after loading `packageJson`, add:

```js
const packageLock = readPackageLock(root);
```

Include in the returned manifest:

```js
release_sbom: buildReleaseSbom({ packageJson, packageLock }),
```

- [x] **Step 5: Verify green**

Run:

```bash
node tests/tests_release_artifacts.mjs
node tests/tests_cli_release_status.mjs
```

Expected: both pass.

## Task 3: Documentation

- [x] **Step 1: Update release docs**

Update `packages/release-artifacts/README.md`, `docs/INSTALL.md`, and `docs/RELEASE_CHECKLIST.md` to describe the new SBOM metadata. The docs must state:

- the SBOM is `divinity.release_sbom.v1`;
- it is generated from `package.json` and `package-lock.json`;
- it includes package/dependency names, versions, direct/transitive relationship, requested ranges, and license strings when present;
- it omits local absolute paths, `node_modules` paths, registry URLs, and lockfile integrity values;
- it does not unblock registry publishing or binary downloads while release gates remain blocked.

- [x] **Step 2: Update product and architecture docs**

Update `docs/ARCHITECTURE.md` and `docs/PRODUCT_PLAN.md` so public release packaging lists SBOM metadata beside source provenance, integrity, and signing readiness.

- [x] **Step 3: Update research ledger**

Append this item to `docs/REPOSITORY_RESEARCH.md`:

```md
66. **Release SBOM metadata:** added deterministic `divinity.release_sbom.v1` metadata to release artifacts and CLI release status from `package.json` plus `package-lock.json`, exposing package/dependency inventory without local paths, `node_modules` paths, registry URLs, or lockfile integrity values.
```

## Task 4: Verification, Commit, PR

- [x] **Step 1: Syntax and focused checks**

Run:

```bash
node --check packages/release-artifacts/src/index.mjs
node --check tests/tests_release_artifacts.mjs
node --check tests/tests_cli_release_status.mjs
pnpm run test:release-artifacts
pnpm run test:release-status
```

Expected: all commands exit 0.

- [x] **Step 2: Docs and release gates**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
pnpm run release:artifacts
pnpm run validate:contracts
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit and publish**

Run:

```bash
git status --short
git add packages/release-artifacts/src/index.mjs tests/tests_release_artifacts.mjs tests/tests_cli_release_status.mjs packages/release-artifacts/README.md docs/INSTALL.md docs/RELEASE_CHECKLIST.md docs/ARCHITECTURE.md docs/PRODUCT_PLAN.md docs/REPOSITORY_RESEARCH.md docs/superpowers/plans/2026-05-26-release-sbom-metadata.md
git commit -m "feat: add release sbom metadata"
git push -u origin codex/release-sbom-metadata
```

Then open a ready PR against `main`, wait for GitHub checks, merge only if checks are green, sync local `main`, and rerun:

```bash
pnpm run test:release-artifacts
pnpm run test:release-status
```

Expected: PR merged, local `main` clean except `.codex/`, focused release checks still green.

## Self-Review

- Spec coverage: The plan advances public release packaging by adding SBOM metadata without removing the non-production warning, clearing `private: true`, publishing packages, or creating binary downloads.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
- Type consistency: The field is `release_sbom`; the nested format is `divinity.release_sbom.v1`; components use `component_id`, `component_type`, `dependency_type`, `direct`, `requested_range`, and `license`.
