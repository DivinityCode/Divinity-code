# Scope Observability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add org/project observability rollups so operators can see run counts, approval backlog, and budget utilization by organizational scope.

**Architecture:** Extend `packages/observability` with deterministic `scope_rollups` derived from each run's `task.scope`. The API already returns the shared observability summary, while the dashboard has a local mirror of the summary logic that should render the same rollups for sample and API-loaded runs.

**Tech Stack:** Node ESM, existing standalone `.mjs` tests, static dashboard JavaScript/CSS, JSON Schema contracts validated by AJV.

---

### Task 1: Shared Scope Rollups

**Files:**
- Modify: `packages/observability/src/index.mjs`
- Modify: `tests/tests_observability.mjs`

- [x] **Step 1: Write the failing package test**

Extend `tests/tests_observability.mjs` to create runs across:
- `acme/platform`
- `acme/billing`
- `ops/sandbox`

Assert `summary.scope_rollups` contains deterministic org rollups before project rollups:
- org `acme` with 4 runs, 1 pending approval, estimated cost 4.0, soft limit 9.1, hard limit 18.1;
- project `acme/platform` with 3 runs and estimated cost 2.5;
- project `acme/billing` with 1 run and estimated cost 1.5;
- org `ops` and project `ops/sandbox` with 1 run.

- [x] **Step 2: Run RED**

Run: `/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_observability.mjs`

Expected: fail because `scope_rollups` is undefined.

- [x] **Step 3: Implement rollup generation**

Add helpers in `packages/observability/src/index.mjs`:
- `runScope(run)` returns `task.scope`, `run.scope`, or `default-org/default-project`.
- `emptyScopeRollup(scope)` creates counters and budget totals.
- `addRunToScopeRollup(rollup, run, budget)` increments run count, approval count, cost/limits, status, and risk counts.
- `scopeRollups(runs)` emits sorted org rollups followed by sorted project rollups with utilization ratios.

Return `scope_rollups` from `createObservabilitySummary`.

- [x] **Step 4: Run GREEN**

Run the package observability test and expect `{"ok":true,"test":"observability"}`.

### Task 2: API And Dashboard Surfaces

**Files:**
- Modify: `tests/tests_api_observability.mjs`
- Modify: `tests/tests_dashboard_static.mjs`
- Modify: `apps/dashboard/app.js`
- Modify: `apps/dashboard/index.html`
- Modify: `apps/dashboard/styles.css`

- [x] **Step 1: Write RED surface checks**

Extend API observability test to assert `GET /observability` returns default-org and default-project scope rollups.

Extend dashboard static test to require:
- `data-scope-rollups`
- `renderScopeRollups`
- sample summary includes scope rollups
- scope rollup styles exist.

- [x] **Step 2: Run RED**

Run:
- `node tests/tests_api_observability.mjs`
- `node tests/tests_dashboard_static.mjs`

Expected: API fails on missing `scope_rollups`; dashboard fails on the missing selector/render function.

- [x] **Step 3: Implement surfaces**

Update the dashboard-local `createObservabilitySummary` mirror to compute `scope_rollups`, add a Scope Rollups panel, and render org/project budget rows with utilization percentages.

- [x] **Step 4: Run GREEN**

Run both tests and expect passing JSON output.

### Task 3: Contracts And Docs

**Files:**
- Modify: `packages/contracts/schemas/observability.v1.json`
- Modify: `packages/contracts/examples/observability.valid.json`
- Modify: `packages/contracts/examples/observability.invalid.json`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `apps/api/README.md`
- Modify: `apps/dashboard/README.md`
- Modify: `packages/observability/README.md`

- [x] **Step 1: Update contract RED/GREEN coverage**

Add `scope_rollups` to the observability schema required fields and valid/invalid examples. Run `node tests/scripts_validate_contracts.mjs`; expected GREEN after schema/examples are updated.

- [x] **Step 2: Update docs**

Document org/project rollups as the implemented version of project/team budget observability.

### Task 4: Verification And Publish

**Files:** all changed files in this branch.

- [x] **Step 1: Run focused checks**

Run:
- `node tests/tests_observability.mjs`
- `node tests/tests_api_observability.mjs`
- `node tests/tests_dashboard_static.mjs`
- `node tests/scripts_validate_contracts.mjs`

- [x] **Step 2: Run hygiene and full suite**

Run syntax checks for changed JS/MJS files, parse all JSON, `git diff --check`, conflict-marker scan, root cleanup check, `pnpm run validate:contracts`, `pnpm run test:observability`, and `pnpm test`.

- [x] **Step 3: Publish**

Commit as `feat: add scope observability rollups`, push `codex/add-scope-observability`, open a ready PR to `main`, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun post-merge verification.

Completed on `main` in commit `4b3e392`.
