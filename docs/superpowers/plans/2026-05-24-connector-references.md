# Connector References Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Allow runs to carry ticket, docs, and CI connector references, with validation, API attachment/listing, CLI run output, dashboard visibility, contracts, and documentation.

**Architecture:** Extend `packages/connectors` from adapter discovery into reference creation and validation. Store connector references directly on run payloads, emit audit/timeline records on API attachment, and keep the public surface deterministic and JSON-only.

**Tech Stack:** Node ESM, built-in `node:test` style assertions through standalone `.mjs` tests, existing HTTP API server, static dashboard JS, JSON Schema contracts with AJV validation.

---

### Task 1: Connector Reference Helpers

**Files:**
- Modify: `packages/connectors/src/index.mjs`
- Test: `tests/tests_connector_references.mjs`

- [x] **Step 1: Write the failing helper test**

Create `tests/tests_connector_references.mjs` that imports `createConnectorReference`, `createConnectorReferences`, and `CONNECTOR_ADAPTERS`. It should assert:
- a `ticket_reference` with `resource_type: "ticket"` produces `format: "divinity.connector_reference.v1"`, a `ref_` id, the input run id, adapter, resource id, URL, title, metadata, `attached_by`, and `attached_at`;
- `createConnectorReferences` preserves array order;
- an unknown adapter throws `unknown connector adapter`;
- an unsupported resource type throws `resource_type`.

- [x] **Step 2: Run RED**

Run: `/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_connector_references.mjs`

Expected: fail because the reference helper exports do not exist.

- [x] **Step 3: Implement helpers**

Add helper exports to `packages/connectors/src/index.mjs`:
- `connectorAdapterById(adapter)`
- `createConnectorReference({ run_id, reference, attached_by, attached_at })`
- `createConnectorReferences({ run_id, references, attached_by, attached_at })`

Validate adapter id, allowed resource type, and non-empty `resource_id`. Include optional `url`, `title`, and object `metadata`.

- [x] **Step 4: Run GREEN**

Run the same connector-reference test and expect JSON output `{"ok":true,"test":"connector-references"}`.

### Task 2: API Connector Attachment

**Files:**
- Modify: `apps/api/src/server.mjs`
- Test: `tests/tests_api_connectors.mjs`

- [x] **Step 1: Write the failing API test**

Create `tests/tests_api_connectors.mjs` that starts the API with `DIVINITY_API_AUTOSTART=0`, creates a run, posts a connector reference to `POST /runs/:id/connectors`, verifies `GET /runs/:id/connectors`, verifies the run event `connector_reference_attached`, verifies audit record type `connector_reference`, and verifies a bad adapter returns HTTP 400.

- [x] **Step 2: Run RED**

Run: `/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_api_connectors.mjs`

Expected: fail with HTTP 404 for `/runs/:id/connectors`.

- [x] **Step 3: Implement API routes**

Import connector helpers, initialize `connector_references: []` on new runs, and add:
- `GET /runs/:id/connectors`
- `POST /runs/:id/connectors`

On POST, validate via `createConnectorReference`, append to the run, emit `connector_reference_attached`, audit `connector_reference` and `run_event`, persist, broadcast, and return `{ connector_reference, run }`. Return HTTP 400 for validation errors.

- [x] **Step 4: Run GREEN**

Run the API connector test and expect JSON output `{"ok":true,"test":"api-connectors"}`.

### Task 3: CLI Initial Connector References

**Files:**
- Modify: `apps/cli/src/index.mjs`
- Test: `tests/tests_cli_connector_references.mjs`

- [x] **Step 1: Write the failing CLI test**

Create `tests/tests_cli_connector_references.mjs` that runs:

```bash
node apps/cli/src/index.mjs run --connector ticket_reference:ticket:DIV-17:https://example.test/tickets/DIV-17 "Read the repository README"
```

It should assert the objective excludes the connector flag, the task includes a connector reference request, and the run output includes one resolved connector reference with adapter `ticket_reference` and resource id `DIV-17`.

- [x] **Step 2: Run RED**

Run the CLI connector-reference test.

Expected: fail because the CLI currently treats `--connector` as part of the objective and emits no connector references.

- [x] **Step 3: Implement parsing and output**

Add `parseRunArgs(values)` and `parseConnectorReferenceFlag(value)` to support repeated `--connector adapter:resource_type:resource_id[:url]` flags. In `run()`, create resolved connector references after `run_id` exists and include both `task.connector_references` and top-level `connector_references` in output.

- [x] **Step 4: Run GREEN**

Run the CLI connector-reference test and expect JSON output `{"ok":true,"test":"cli-connector-references"}`.

### Task 4: Contracts, Dashboard, And Docs

**Files:**
- Create: `packages/contracts/schemas/connector-reference.v1.json`
- Create: `packages/contracts/examples/connector-reference.valid.json`
- Create: `packages/contracts/examples/connector-reference.invalid.json`
- Modify: `tests/scripts_validate_contracts.mjs`
- Modify: `package.json`
- Modify: `tests/tests_dashboard_static.mjs`
- Modify: `apps/dashboard/app.js`
- Modify: `apps/dashboard/styles.css`
- Modify: `README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `packages/connectors/README.md`
- Modify: `apps/api/README.md`
- Modify: `apps/cli/README.md`

- [x] **Step 1: Write contract and dashboard RED checks**

Add schema examples to `tests/scripts_validate_contracts.mjs`, add connector tests to `package.json`, and extend dashboard static assertions to require connector reference labels and rendering.

- [x] **Step 2: Implement docs and dashboard rendering**

Render `connector_references` in the dashboard run detail, include sample ticket/docs/CI references, and document the API/CLI connector reference surface.

- [x] **Step 3: Run focused validation**

Run:
- `node tests/scripts_validate_contracts.mjs`
- `node tests/tests_dashboard_static.mjs`
- `node tests/tests_connector_references.mjs`
- `node tests/tests_api_connectors.mjs`
- `node tests/tests_cli_connector_references.mjs`

Expected: all emit passing JSON or PASS lines.

### Task 5: Final Verification And Publish

**Files:** all changed files in this branch.

- [x] **Step 1: Run syntax and hygiene checks**

Run Node `--check` on changed `.mjs` files, parse all tracked JSON files, `git diff --check`, conflict marker scan, and root test/script cleanup check.

- [x] **Step 2: Run project checks**

Run cached pnpm equivalents of:
- `pnpm run validate:contracts`
- `pnpm run test`

Record local `npm --version` status in the PR body if it remains unavailable.

- [x] **Step 3: Publish**

Commit as `feat: add connector references`, push `codex/add-connector-references`, open a ready PR to `main`, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun post-merge verification.

Completed on `main` in commit `cb9bb5e`.
