# Runner Isolation Profiles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add explicit runner isolation profiles and deterministic container command planning so execution surfaces can advertise workspace snapshot isolation and a future Docker-backed sandbox path.

**Architecture:** Keep current workspace snapshot execution unchanged, but model isolation as shared metadata. Add a new `packages/runner-isolation` package that exports public profile metadata and builds shell-free Docker argv plans. Capabilities and workspace creation consume the package so CLI/API clients can discover supported isolation modes and runs carry the selected profile.

**Tech Stack:** Node ESM modules, built-in `assert`, JSON Schema draft 2020-12 through existing AJV validation, existing CLI/API capability catalog.

---

### Task 1: RED Tests For Runner Isolation

**Files:**
- Create: `tests/tests_runner_isolation.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing package test**

```js
import assert from 'assert/strict';
import path from 'path';

import {
  createContainerCommandPlan,
  publicRunnerIsolationProfiles,
  resolveRunnerIsolationProfile
} from '../packages/runner-isolation/src/index.mjs';

const profiles = publicRunnerIsolationProfiles();

assert.deepEqual(profiles.map(profile => profile.profile_id), [
  'workspace_snapshot',
  'container_sandbox'
]);
assert.equal(profiles.find(profile => profile.profile_id === 'workspace_snapshot').requires_runtime, false);
assert.equal(profiles.find(profile => profile.profile_id === 'container_sandbox').runtime, 'docker');
assert.equal(profiles.find(profile => profile.profile_id === 'container_sandbox').network, 'none');
assert.equal(resolveRunnerIsolationProfile({ profile_id: 'missing' }).profile_id, 'workspace_snapshot');

const plan = createContainerCommandPlan({
  workspacePath: '/tmp/divinity-workspace',
  command: ['node', 'tests/tests_dashboard_static.mjs']
});

assert.equal(plan.profile_id, 'container_sandbox');
assert.equal(plan.runtime, 'docker');
assert.equal(plan.shell_interpolation, false);
assert.deepEqual(plan.command, ['node', 'tests/tests_dashboard_static.mjs']);
assert.ok(plan.argv.includes('--network'));
assert.ok(plan.argv.includes('none'));
assert.ok(plan.argv.includes('type=bind,source=/tmp/divinity-workspace,target=/workspace'));
assert.deepEqual(plan.argv.slice(-2), ['node', 'tests/tests_dashboard_static.mjs']);
assert.equal(path.isAbsolute(plan.workspace_mount.source), true);

assert.throws(() => createContainerCommandPlan({
  workspacePath: '/tmp/divinity-workspace',
  command: 'node tests/tests_dashboard_static.mjs'
}), /command must be a non-empty argv array/);

console.log(JSON.stringify({ ok: true, test: 'runner-isolation' }));
```

- [x] **Step 2: Add the test command wiring**

Add `node tests/tests_runner_isolation.mjs` to the root `test` chain and add a focused script:

```json
"test:runner-isolation": "node tests/tests_runner_isolation.mjs && node tests/tests_workspaces.mjs && node tests/tests_api_workspaces.mjs && node tests/tests_capabilities.mjs && node tests/tests_api_capabilities.mjs && node tests/tests_cli_capabilities.mjs"
```

- [x] **Step 3: Run RED**

Run: `node tests/tests_runner_isolation.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `packages/runner-isolation/src/index.mjs`.

### Task 2: Implement Runner Isolation Package

**Files:**
- Create: `packages/runner-isolation/src/index.mjs`
- Create: `packages/runner-isolation/README.md`

- [x] **Step 1: Add the minimal package implementation**

```js
import path from 'path';

export const RUNNER_ISOLATION_PROFILES = [
  {
    profile_id: 'workspace_snapshot',
    kind: 'workspace',
    description: 'Execute from a per-run workspace snapshot or shallow Git clone managed by Divinity Code.',
    requires_runtime: false,
    runtime: null,
    image: null,
    network: 'host_default',
    workspace_mount: null,
    shell_interpolation: false
  },
  {
    profile_id: 'container_sandbox',
    kind: 'container',
    description: 'Plan execution inside a Docker container with the run workspace bind-mounted at /workspace.',
    requires_runtime: true,
    runtime: 'docker',
    image: 'node:22-bookworm-slim',
    network: 'none',
    workspace_mount: '/workspace',
    shell_interpolation: false
  }
];

function cloneProfile(profile) {
  return { ...profile };
}

export function publicRunnerIsolationProfiles() {
  return RUNNER_ISOLATION_PROFILES.map(cloneProfile);
}

export function resolveRunnerIsolationProfile({ profile_id } = {}) {
  return cloneProfile(
    RUNNER_ISOLATION_PROFILES.find(profile => profile.profile_id === profile_id)
      || RUNNER_ISOLATION_PROFILES[0]
  );
}

export function createContainerCommandPlan({ workspacePath, command, profile_id = 'container_sandbox' } = {}) {
  if (!Array.isArray(command) || command.length === 0 || command.some(part => typeof part !== 'string' || part.length === 0)) {
    throw new Error('command must be a non-empty argv array');
  }

  const profile = resolveRunnerIsolationProfile({ profile_id });
  if (profile.kind !== 'container') {
    throw new Error(`runner isolation profile is not container-backed: ${profile.profile_id}`);
  }

  const source = path.resolve(workspacePath || process.cwd());
  const target = profile.workspace_mount;
  const mount = `type=bind,source=${source},target=${target}`;

  return {
    profile_id: profile.profile_id,
    runtime: profile.runtime,
    image: profile.image,
    network: profile.network,
    workdir: target,
    workspace_mount: {
      source,
      target,
      mode: 'rw'
    },
    command: [...command],
    argv: [
      profile.runtime,
      'run',
      '--rm',
      '--network',
      profile.network,
      '--mount',
      mount,
      '-w',
      target,
      profile.image,
      ...command
    ],
    shell_interpolation: false
  };
}
```

- [x] **Step 2: Run GREEN**

Run: `node tests/tests_runner_isolation.mjs`

Expected: `{"ok":true,"test":"runner-isolation"}`

### Task 3: Surface Profiles In Capabilities And Workspaces

**Files:**
- Modify: `packages/capabilities/src/index.mjs`
- Modify: `packages/contracts/schemas/capabilities.v1.json`
- Modify: `packages/contracts/examples/capabilities.valid.json`
- Modify: `packages/contracts/examples/capabilities.invalid.json`
- Modify: `packages/workspaces/src/index.mjs`
- Modify: `tests/tests_capabilities.mjs`
- Modify: `tests/tests_api_capabilities.mjs`
- Modify: `tests/tests_cli_capabilities.mjs`
- Modify: `tests/tests_workspaces.mjs`
- Modify: `tests/tests_api_workspaces.mjs`

- [x] **Step 1: Add RED assertions**

Add assertions that:
- `createCapabilitiesCatalog()` returns `runner_isolation_profiles`.
- CLI/API capabilities include `container_sandbox`.
- `createRunWorkspace()` returns `workspace.isolation.profile_id === 'workspace_snapshot'` by default.
- `createRunWorkspace({ isolationProfileId: 'container_sandbox' })` records `workspace.isolation.profile_id === 'container_sandbox'`.
- API task creation returns workspace isolation metadata.

- [x] **Step 2: Run RED**

Run: `node tests/tests_capabilities.mjs && node tests/tests_workspaces.mjs`

Expected: FAIL because `runner_isolation_profiles` and `workspace.isolation` are not yet implemented.

- [x] **Step 3: Implement capability and workspace metadata**

Import `publicRunnerIsolationProfiles` in `packages/capabilities/src/index.mjs` and include:

```js
runner_isolation_profiles: publicRunnerIsolationProfiles()
```

Import `resolveRunnerIsolationProfile` in `packages/workspaces/src/index.mjs`; add an `isolationProfileId` option and attach:

```js
isolation: resolveRunnerIsolationProfile({ profile_id: isolationProfileId })
```

Update `capabilities.v1.json` to require `runner_isolation_profiles` and validate each profile field.

- [x] **Step 4: Run GREEN**

Run: `node tests/tests_runner_isolation.mjs && node tests/tests_capabilities.mjs && node tests/tests_workspaces.mjs && node tests/tests_api_workspaces.mjs && node tests/tests_api_capabilities.mjs && node tests/tests_cli_capabilities.mjs && node tests/scripts_validate_contracts.mjs`

Expected: all commands exit 0 with JSON `ok` lines and contract PASS lines.

### Task 4: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/capabilities/README.md`
- Modify: `packages/workspaces/README.md`
- Modify: `packages/contracts/CHANGELOG.md`

- [x] **Step 1: Update docs**

Document that bootstrap execution now exposes workspace snapshot and Docker container-sandbox profiles, while actual local execution still defaults to workspace snapshots. Remove the stale “Containerized runner isolation is still future work” wording and replace it with profile-planning status.

- [x] **Step 2: Run focused verification**

Run:

```bash
node tests/tests_runner_isolation.mjs
node tests/tests_workspaces.mjs
node tests/tests_api_workspaces.mjs
node tests/tests_capabilities.mjs
node tests/tests_api_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: each test exits 0.

- [x] **Step 3: Run broader verification**

Run:

```bash
node --check packages/runner-isolation/src/index.mjs
node --check packages/capabilities/src/index.mjs
node --check packages/workspaces/src/index.mjs
node --check tests/tests_runner_isolation.mjs
node --check tests/scripts_validate_contracts.mjs
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
pnpm run test:runner-isolation
pnpm run validate:contracts
pnpm test
```

Expected: syntax checks and `git diff --check` exit 0; marker scan returns no matches; package scripts exit 0.

### Task 5: Ship The Slice

**Files:**
- All modified files from tasks 1-4

- [x] **Step 1: Commit**

```bash
git add .
git commit -m "feat: add runner isolation profiles"
```

- [x] **Step 2: Push and open PR**

```bash
git push -u origin codex/add-runner-isolation-profiles
```

Open a pull request against `main`, wait for GitHub Actions, and merge only after green checks.

Completed on `main` in commit `8bf9f65`.

## Self-Review

- Spec coverage: This plan addresses the documented containerized runner isolation gap by adding explicit profile metadata, deterministic Docker command planning, capability discovery, workspace metadata, docs, and verification.
- Placeholder scan: No placeholder task remains; each behavior has a concrete file path, assertion, or command.
- Type consistency: Profile field names are consistently `profile_id`, `kind`, `requires_runtime`, `runtime`, `image`, `network`, `workspace_mount`, and `shell_interpolation`.
