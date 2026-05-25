# Approval Revision Resubmit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add approval revision request and resubmission workflows without changing existing approve/reject semantics.

**Architecture:** Store a single latest `approval_revision` record on each run. Requesting a revision is only valid from `awaiting_approval` and moves the run to `paused`; resubmitting is only valid from `paused` with a requested revision and moves the run back to `awaiting_approval`. Approval snapshots expose the revision record so CLI and dashboard/API callers can inspect review state without a second route.

**Tech Stack:** Node.js ESM, built-in `assert`, HTTP API routes, JSON Schema draft 2020-12, AJV contract validation.

---

### Task 1: RED Tests For Revision Records

**Files:**
- Create: `packages/approval-revisions/src/index.mjs`
- Create: `tests/tests_approval_revisions.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing package test**

Create `tests/tests_approval_revisions.mjs`:

```js
import assert from 'assert/strict';

import { createApprovalRevision, resubmitApprovalRevision } from '../packages/approval-revisions/src/index.mjs';

const revision = createApprovalRevision({
  run_id: 'run_revision_123',
  actor: 'operator@example.com',
  reason: 'Rollback evidence is missing.',
  requested_changes: ['Attach rollback plan', 'Confirm maintenance window'],
  requested_at: '2026-05-25T00:00:01Z'
});

assert.equal(revision.revision_id, 'approval_revision_run_revision_123_001');
assert.equal(revision.run_id, 'run_revision_123');
assert.equal(revision.actor, 'operator@example.com');
assert.equal(revision.reason, 'Rollback evidence is missing.');
assert.deepEqual(revision.requested_changes, ['Attach rollback plan', 'Confirm maintenance window']);
assert.equal(revision.status, 'requested');
assert.equal(revision.requested_at, '2026-05-25T00:00:01Z');

const resubmitted = resubmitApprovalRevision(revision, {
  actor: 'builder@example.com',
  reason: 'Rollback plan attached.',
  resubmitted_at: '2026-05-25T00:01:00Z'
});

assert.equal(resubmitted.revision_id, revision.revision_id);
assert.equal(resubmitted.status, 'resubmitted');
assert.equal(resubmitted.resubmitted_by, 'builder@example.com');
assert.equal(resubmitted.resubmission_reason, 'Rollback plan attached.');
assert.equal(resubmitted.resubmitted_at, '2026-05-25T00:01:00Z');

assert.throws(() => createApprovalRevision({
  run_id: 'run_revision_123',
  reason: ' '
}), /approval revision reason must be non-empty/);

console.log(JSON.stringify({ ok: true, test: 'approval-revisions' }));
```

- [x] **Step 2: Run test to verify RED**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_approval_revisions.mjs
```

Expected: FAIL because `packages/approval-revisions/src/index.mjs` does not exist.

- [x] **Step 3: Implement the package helper**

Create `packages/approval-revisions/src/index.mjs`:

```js
function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

export function createApprovalRevision({
  run_id,
  actor = 'operator',
  reason,
  requested_changes = [],
  requested_at = new Date().toISOString(),
  index = 1
}) {
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) {
    throw new Error('approval revision reason must be non-empty');
  }

  return {
    revision_id: ['approval_revision', run_id || 'run_unknown', String(index).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id: run_id || 'run_unknown',
    actor: String(actor || '').trim() || 'operator',
    reason: normalizedReason,
    requested_changes: normalizeList(requested_changes),
    status: 'requested',
    requested_at
  };
}

export function resubmitApprovalRevision(revision, {
  actor = 'operator',
  reason = '',
  resubmitted_at = new Date().toISOString()
} = {}) {
  return {
    ...revision,
    status: 'resubmitted',
    resubmitted_by: String(actor || '').trim() || 'operator',
    resubmission_reason: String(reason || '').trim(),
    resubmitted_at
  };
}
```

- [x] **Step 4: Register focused tests**

Add `node tests/tests_approval_revisions.mjs` to the top-level `test` script before API approval tests, and add it to `test:approval`.

- [x] **Step 5: Run package test to verify GREEN**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_approval_revisions.mjs
```

Expected: PASS with `{ "ok": true, "test": "approval-revisions" }`.

### Task 2: RED API And CLI Workflow Tests

**Files:**
- Create: `tests/tests_api_approval_revisions.mjs`
- Create: `tests/tests_cli_approval_revisions.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing API workflow test**

Create `tests/tests_api_approval_revisions.mjs` with assertions that:
- A high-risk task starts `awaiting_approval`.
- `POST /runs/:id/approval/revision` returns HTTP 200, stores `approval_revision.status === "requested"`, moves the run to `paused`, emits `approval_revision_requested` and `status_changed`, and removes the run from `GET /approvals`.
- Approving while paused returns HTTP 409 `run is not awaiting approval`.
- `POST /runs/:id/approval/resubmit` returns HTTP 200, stores `approval_revision.status === "resubmitted"`, moves the run back to `awaiting_approval`, and puts the run back in `GET /approvals`.
- `GET /runs/:id/approval` includes the latest revision record.

- [x] **Step 2: Write the failing CLI workflow test**

Create `tests/tests_cli_approval_revisions.mjs` with assertions that:
- Local `approval-revision <run_id> --reason ... --change ...` prints a structured revision record and `status: "paused"`.
- Local `approval-resubmit <run_id> --reason ...` prints a structured revision record and `status: "awaiting_approval"`.
- API-backed `approval-revision` and `approval-resubmit` drive the same API workflow and return the updated run payload.

- [x] **Step 3: Register focused workflow tests**

Add `node tests/tests_api_approval_revisions.mjs` to top-level `test`, `test:api`, and `test:approval`.
Add `node tests/tests_cli_approval_revisions.mjs` to top-level `test`, `test:cli`, and `test:approval`.

- [x] **Step 4: Run tests to verify RED**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_api_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_cli_approval_revisions.mjs
```

Expected: API test fails with 404 for the missing revision route. CLI test fails because the commands are unknown.

### Task 3: Implement Contracts, API, And CLI

**Files:**
- Create: `packages/contracts/schemas/approval-revision.v1.json`
- Create: `packages/contracts/examples/approval-revision.valid.json`
- Create: `packages/contracts/examples/approval-revision.invalid.json`
- Modify: `packages/contracts/schemas/run.v1.json`
- Modify: `packages/contracts/schemas/event.v1.json`
- Modify: `packages/contracts/schemas/audit.v1.json`
- Modify: `packages/contracts/examples/run.valid.json`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `tests/scripts_validate_contracts.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `apps/cli/src/index.mjs`

- [x] **Step 1: Add the approval revision contract**

Create `approval-revision.v1.json` with required `revision_id`, `run_id`, `actor`, `reason`, `requested_changes`, `status`, and `requested_at`. Allow optional `resubmitted_by`, `resubmission_reason`, and `resubmitted_at`. Add valid and invalid examples, include optional `approval_revision` on Run, add `approval_revision_requested` and `approval_resubmitted` event types, add `approval_revision` audit type, and register the examples in `tests/scripts_validate_contracts.mjs`.

- [x] **Step 2: Implement API routes**

Import `createApprovalRevision` and `resubmitApprovalRevision`. Add:
- `POST /runs/:id/approval/revision`: valid only for `awaiting_approval`, creates the revision, records `approval_revision` audit, emits `approval_revision_requested`, changes run status to `paused`, emits/audits `status_changed`, persists, broadcasts, and returns public run.
- `POST /runs/:id/approval/resubmit`: valid only for `paused` runs with `approval_revision.status === "requested"`, marks the revision resubmitted, records `approval_revision` audit, changes status to `awaiting_approval`, emits `approval_resubmitted` and `status_changed`, persists, broadcasts, and returns public run.
- Extend `approvalSnapshot(run)` with `revision: run.approval_revision || null`.

- [x] **Step 3: Implement CLI commands**

Add argument parsing for `approval-revision` and `approval-resubmit`. Support `--api`, `--actor`, `--reason`, repeated `--change` / `--requested-change`. Without `--api`, return local structured payloads. With `--api`, POST to the new API routes.

- [x] **Step 4: Run focused tests**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_api_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_cli_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/scripts_validate_contracts.mjs
```

Expected: all commands exit 0.

### Task 4: Documentation And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/api/README.md`
- Modify: `apps/cli/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DOMAIN_MODEL.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update documentation**

Document the new revision/resubmit commands and API routes, the paused-to-awaiting lifecycle, the approval snapshot `revision` field, contract paths, and implementation status in repository research docs.

- [x] **Step 2: Run final verification**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check apps/api/src/server.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check apps/cli/src/index.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check packages/approval-revisions/src/index.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check tests/tests_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check tests/tests_api_approval_revisions.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check tests/tests_cli_approval_revisions.mjs
PATH="/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282:$PATH" /home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node /home/danie/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs run test:approval
PATH="/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282:$PATH" /home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node /home/danie/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs run validate:contracts
git diff --check
rg -n '^(<{7}|={7}|>{7})' .
test -z "$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print)"
```

Expected: all commands exit 0, conflict marker scan prints no matches, and root test/script pollution check is empty.
