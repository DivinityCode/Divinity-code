# PR Summary Artifacts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add a dedicated `pr_summary` artifact so Builder/API runs expose patch metadata and a PR-ready summary artifact matching the product plan.

**Architecture:** Extend the existing `packages/artifacts` package without changing storage or API route mechanics. `createRunArtifacts(...)` will emit one additional artifact type, and CLI/API surfaces will pick it up through their existing artifact metadata flow. Contract, dashboard sample data, and docs will be updated to make the new artifact discoverable.

**Tech Stack:** Node ESM modules, built-in `assert`, existing HTTP API tests, existing AJV contract validation.

---

### Task 1: RED Tests For PR Summary Artifacts

**Files:**
- Modify: `tests/tests_artifacts.mjs`
- Modify: `tests/tests_dashboard_static.mjs`

- [x] **Step 1: Add failing artifact assertions**

Update `tests/tests_artifacts.mjs` so generated, CLI, and API artifact type lists are:

```js
['patch', 'log', 'summary', 'pr_summary']
```

Add assertions that the `pr_summary` content contains:

```js
assert.equal(prSummary.content.format, 'github_pull_request_summary');
assert.match(prSummary.content.title, /Review README/);
assert.match(prSummary.content.body, /## Summary/);
assert.match(prSummary.content.body, /## Validation/);
assert.match(prSummary.content.body, /Preflight decision: allow/);
assert.equal(prSummary.content.decision_trace.chosen_path, 'queue_for_execution');
```

Update API retrieval assertions to fetch the `pr_summary` artifact from `GET /artifacts/:artifact_id`.

- [x] **Step 2: Add failing dashboard static assertion**

Update `tests/tests_dashboard_static.mjs`:

```js
assert(runs.some(run => run.artifacts.some(artifact => artifact.type === 'pr_summary')), 'sample data should include PR summary artifacts');
```

- [x] **Step 3: Run RED**

Run:

```bash
node tests/tests_artifacts.mjs
```

Expected: FAIL because `createRunArtifacts(...)` only emits `patch`, `log`, and `summary`.

### Task 2: Implement PR Summary Artifact

**Files:**
- Modify: `packages/artifacts/src/index.mjs`
- Modify: `apps/dashboard/app.js`

- [x] **Step 1: Add artifact content implementation**

Extend `ARTIFACT_TYPES`:

```js
const ARTIFACT_TYPES = ['patch', 'log', 'summary', 'pr_summary'];
```

Add a `pr_summary` branch to `artifactContent(...)` that returns:

```js
{
  format: 'github_pull_request_summary',
  title: `Divinity task: ${patchText(task.objective, 'No objective provided')}`,
  body: [
    '## Summary',
    `- Objective: ${patchText(task.objective, 'No objective provided')}`,
    `- Run: ${patchText(run_id)}`,
    `- Status: ${patchText(status)}`,
    '',
    '## Validation',
    `- Preflight decision: ${patchText(preflight?.decision, 'not_evaluated')}`,
    `- Risk level: ${patchText(preflight?.risk_level, 'unknown')}`,
    '',
    '## Decision Trace',
    `- Chosen path: ${trace.chosen_path}`,
    `- Rejected alternative: ${trace.rejected_alternative}`,
    `- Rationale: ${trace.rationale}`
  ].join('\n'),
  decision_trace: trace
}
```

- [x] **Step 2: Add dashboard sample metadata**

Add a `pr_summary` artifact to at least one completed sample run in `apps/dashboard/app.js`:

```js
artifact('artifact_pr_summary_0012', 'pr_summary', 'artifact://run_2026_05_24_0012/pr-summary.md')
```

- [x] **Step 3: Run GREEN**

Run:

```bash
node tests/tests_artifacts.mjs
node tests/tests_dashboard_static.mjs
```

Expected: both tests exit 0.

### Task 3: Contracts And Documentation

**Files:**
- Modify: `packages/contracts/schemas/artifact.v1.json`
- Modify: `packages/contracts/examples/artifact.valid.json`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `packages/artifacts/README.md`
- Modify: `README.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `apps/dashboard/README.md`

- [x] **Step 1: Update artifact contract**

Add `pr_summary` to the artifact type enum and make the valid example a PR summary artifact:

```json
{
  "artifact_id": "artifact_run_123_pr_summary",
  "run_id": "run_123",
  "type": "pr_summary",
  "uri": "artifact://run_123/pr_summary"
}
```

- [x] **Step 2: Update docs**

Document that runs now emit patch, log, summary, and PR summary artifacts. Update product plan/bootstrap notes to say the patch plus PR summary artifact deliverable is implemented.

- [x] **Step 3: Run focused validation**

Run:

```bash
node tests/scripts_validate_contracts.mjs
node tests/tests_artifacts.mjs
node tests/tests_dashboard_static.mjs
```

Expected: all commands exit 0.

### Task 4: Ship The Slice

**Files:**
- All modified files from tasks 1-3

- [x] **Step 1: Run broader verification**

Run:

```bash
node --check packages/artifacts/src/index.mjs
node --check tests/tests_artifacts.mjs
node --check tests/tests_dashboard_static.mjs
node --check tests/scripts_validate_contracts.mjs
node -e "const fs=require('fs'); const cp=require('child_process'); const out=cp.execFileSync('rg',['--files','-g','*.json'],{encoding:'utf8'}).trim(); const files=out ? out.split(/\n/).filter(Boolean) : []; for (const f of files) JSON.parse(fs.readFileSync(f,'utf8')); console.log(JSON.stringify({ok:true,json_files:files.length}));"
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
pnpm run validate:contracts
pnpm run test:artifacts
pnpm run test:dashboard
pnpm test
```

Expected: all syntax checks and package scripts exit 0; marker scan returns no matches.

- [ ] **Step 2: Commit, push, PR, merge**

```bash
git add .
git commit -m "feat: add pr summary artifacts"
git push -u origin codex/add-pr-summary-artifacts
```

Open a ready PR to `main`, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun post-merge verification.

## Self-Review

- Spec coverage: The plan maps the product-plan “Patch + PR summary artifacts” deliverable to concrete artifact package behavior, CLI/API metadata, dashboard sample data, contract validation, docs, and PR shipping.
- Placeholder scan: No placeholder steps remain; each task lists exact files, commands, and expected outcomes.
- Type consistency: The new artifact type is consistently named `pr_summary`; content format is `github_pull_request_summary`.
