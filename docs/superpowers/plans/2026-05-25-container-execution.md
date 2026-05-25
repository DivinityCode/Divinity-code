# Container Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Execute constrained shell adapters through the existing Docker `container_sandbox` command plan when a run workspace selects container isolation.

**Architecture:** Keep the current `workspace_snapshot` adapter behavior unchanged. Add a small execution routing layer that detects `run.workspace.isolation.kind === "container"`, builds a Docker argv plan with `packages/runner-isolation`, and invokes the runtime without shell interpolation. Tests use a fake `docker` executable on `PATH` so CI does not require a Docker daemon.

**Tech Stack:** Node ESM modules, built-in `assert`, `spawnSync`, existing runner-isolation command planning, JSON Schema draft 2020-12 contract validation.

---

### Task 1: RED Tests For Container Execution

**Files:**
- Modify: `tests/tests_execution_adapter.mjs`

- [x] **Step 1: Add a fake Docker runtime test**

Add test setup that writes an executable `docker` script into a temp `bin` directory, prepends that directory to `PATH`, and calls `executeStep(...)` for a `node_test` step whose run has:

```js
workspace: {
  kind: 'local_snapshot',
  path: tmpDir,
  isolation: resolveRunnerIsolationProfile({ profile_id: 'container_sandbox' })
}
```

The assertion must prove the adapter remains `node_test`, the execution succeeds, and stdout includes Docker argv details such as `--network none`, the bind mount, and `node tests_execution_fixture.mjs`. The final test also covers `git_status` and `package_script`.

- [x] **Step 2: Run RED**

Run: `node tests/tests_execution_adapter.mjs`

Expected: FAIL because `executeStep(...)` still runs `process.execPath tests_execution_fixture.mjs` locally and does not invoke the fake Docker runtime.

### Task 2: Route Constrained Commands Through Container Plans

**Files:**
- Modify: `packages/execution/src/index.mjs`

- [x] **Step 1: Import command planning**

Import `createContainerCommandPlan` from `packages/runner-isolation/src/index.mjs`.

- [x] **Step 2: Add a constrained command runner**

Add a helper that accepts local and container argv arrays. For local workspaces it calls `spawnSync(localCommand[0], localCommand.slice(1), { cwd, encoding: 'utf8' })`. For container-isolated runs it calls `createContainerCommandPlan({ workspacePath: root, command: containerCommand, profile_id })` and then `spawnSync(plan.argv[0], plan.argv.slice(1), { encoding: 'utf8' })`.

- [x] **Step 3: Use the helper for shell adapters**

Route `git_status`, `node_test`, and `package_script` command execution through the helper. Keep `file_read` local and unchanged because it reads deterministic workspace content without shell execution.

- [x] **Step 4: Run GREEN**

Run: `node tests/tests_execution_adapter.mjs`

Expected: `{"ok":true,"test":"execution-adapter"}`

### Task 3: Contracts And Documentation

**Files:**
- Modify: `packages/runner-isolation/README.md`
- Modify: `packages/execution/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/superpowers/plans/2026-05-25-container-execution.md`

- [x] **Step 1: Update docs**

Document that constrained shell adapters execute through Docker when the run workspace selects `container_sandbox`; if Docker is unavailable, the execution record fails with runtime stderr/error output.

- [x] **Step 2: Update plan checkboxes**

Mark completed steps in this plan.

### Task 4: Verification And Publication

**Files:**
- No production file edits after this step unless verification gives actionable failures.

- [x] **Step 1: Focused checks**

Run:

```bash
node --check packages/execution/src/index.mjs
node tests/tests_execution_adapter.mjs
node tests/tests_api_execution.mjs
node tests/tests_runner_isolation.mjs
```

- [x] **Step 2: Broader checks**

Run:

```bash
node tests/scripts_validate_contracts.mjs
pnpm run test:execution
pnpm run test:runner-isolation
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
```

- [x] **Step 3: Publish**

Commit as `feat: execute container-isolated commands`, push `codex/add-container-execution`, and open a draft PR against `main`.

Completed on `main` in commit `fa87632`.
