# Dashboard Operator Controls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface provider/toolset operator controls in the Operator Dashboard so compatibility and approval requirements are visible before an operator acts.

**Architecture:** Keep the dashboard static-shell architecture intact. Preserve API-loaded run normalization while adding `toolset_resolution` to normalized runs, render a run-detail operator-controls panel, and summarize required controls inside approval cards.

**Tech Stack:** Plain HTML/CSS/ES modules, existing dashboard static sample data, Node static contract tests.

---

## File Structure

- Modify `apps/dashboard/index.html`: add an Operator Controls section in run detail with `data-operator-control-list`.
- Modify `apps/dashboard/app.js`: add sample `task.toolset_resolution` metadata, preserve API `task.toolset_resolution`, render operator controls in run detail, and show required/recommended summaries in approval cards.
- Modify `apps/dashboard/styles.css`: style operator-control rows and compact approval summaries using existing dashboard tokens.
- Modify `tests/tests_dashboard_static.mjs`: assert the new selector, sample data, render functions, and styles.
- Modify `apps/dashboard/README.md`, `docs/ARCHITECTURE.md`, and `docs/PRODUCT_PLAN.md`.

## Acceptance Criteria

- Dashboard static sample data includes at least one run with `task.toolset_resolution.operator_controls`.
- API-loaded runs preserve `run.task.toolset_resolution` into dashboard state.
- Run detail renders an Operator Controls panel with control id, status, reason, provider/capability, affected toolsets, and policy permissions.
- Approval queue cards show a compact operator-control summary for pending runs.
- Static dashboard test checks the selector, sample data, render functions, and CSS classes.

## Tasks

### Task 1: Static Test Red

**Files:**
- Modify: `tests/tests_dashboard_static.mjs`

- [x] Add assertions:

```js
assert(html.includes('data-operator-control-list'), 'missing operator control list selector');
assert(runs.some(run => run.task?.toolset_resolution?.operator_controls?.length > 0), 'sample data should include operator controls');
assert(js.includes('toolset_resolution: run.task?.toolset_resolution || run.toolset_resolution || null'), 'dashboard should preserve API toolset resolution');
assert(js.includes('renderOperatorControls'), 'dashboard should render operator controls');
assert(js.includes('renderApprovalControlSummary'), 'approval cards should summarize operator controls');
assert(css.includes('operator-control-item'), 'dashboard should style operator controls');
assert(css.includes('approval-control-summary'), 'dashboard should style approval control summary');
```

- [x] Run: `node tests/tests_dashboard_static.mjs`.
Expected: FAIL because the dashboard does not have the operator-controls selector, sample data, renderer, or styles yet.

### Task 2: Dashboard Markup And Data

**Files:**
- Modify: `apps/dashboard/index.html`
- Modify: `apps/dashboard/app.js`

- [x] Insert this panel after the decision trace:

```html
<section class="operator-controls-panel" aria-labelledby="operator-controls-heading">
  <h3 id="operator-controls-heading">Operator Controls</h3>
  <ul data-operator-control-list></ul>
</section>
```

- [x] Add `task.toolset_resolution` to one sample awaiting-approval run, including `policy_permissions`, `risk_summary`, one supported provider capability check, one missing provider capability check, and `operator_controls` entries for `approval_required` and `provider_capability_review`.

- [x] Update `normalizeApiRun()` to keep:

```js
toolset_resolution: run.task?.toolset_resolution || run.toolset_resolution || null,
provider_runtime: run.task?.provider_runtime || run.provider_runtime || null,
```

### Task 3: Dashboard Rendering

**Files:**
- Modify: `apps/dashboard/app.js`

- [x] Add helpers:
  - `runToolsetResolution(run)`
  - `runOperatorControls(run)`
  - `operatorControlStatusClass(control)`
  - `renderOperatorControlMeta(control)`
  - `renderOperatorControls(run)`
  - `renderApprovalControlSummary(run)`

- [x] In `renderRunDetail()`, write:

```js
document.querySelector('[data-operator-control-list]').innerHTML = renderOperatorControls(run);
```

- [x] In `renderApprovalQueue()`, include:

```js
${renderApprovalControlSummary(run)}
```

### Task 4: Styling

**Files:**
- Modify: `apps/dashboard/styles.css`

- [x] Include `.operator-controls-panel` in the existing detail panel group with goals, approval comments, connectors, agent activity, and executions.

- [x] Add `.operator-control-item`, `.operator-control-copy`, `.operator-control-meta`, `.operator-permissions`, and `.approval-control-summary` styles with responsive grid/flex behavior and existing status colors.

### Task 5: Docs

**Files:**
- Modify: `apps/dashboard/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] Document that dashboard run detail and approval cards render provider/toolset operator controls.

- [x] Update Product Plan Toolset Governance bootstrap status so dashboard operator controls are marked complete and live tool-call execution governance remains the next slice.

### Task 6: Verification And Publish

- [x] Run focused checks:

```bash
node --check apps/dashboard/app.js
node --check tests/tests_dashboard_static.mjs
node tests/tests_dashboard_static.mjs
pnpm run test:dashboard
pnpm run validate:contracts
```

- [x] Run hygiene:

```bash
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

- [ ] Commit as `feat: surface dashboard operator controls`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete in a docs-only follow-up PR.

## Self-Review

- Spec coverage: The plan covers dashboard detail, approval cards, API run normalization, static tests, styles, docs, and publishing.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan consistently uses `toolset_resolution`, `operator_controls`, `provider_capability_checks`, and `policy_permissions`.
