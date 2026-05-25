# Docker Doctor Diagnostic Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `divinity doctor` report Docker runtime availability now that `container_sandbox` can execute constrained commands through Docker.

**Architecture:** Keep `doctor` as a structured CLI-only readiness command. Add an optional `docker` command probe alongside optional package-manager probes, preserving required-only overall status semantics so missing Docker is visible but not blocking by default.

**Tech Stack:** Node ESM CLI, built-in `spawnSync`, existing CLI doctor test, repository Markdown docs.

---

### Task 1: RED Test

**Files:**
- Modify: `tests/tests_cli_doctor.mjs`

- [x] **Step 1: Add Docker diagnostic assertions**

Require a `docker` check in the doctor output and assert:

```js
assert.ok(checksById.has('docker'), 'missing diagnostic check: docker');
assert.equal(checksById.get('docker').required, false);
assert.equal(typeof checksById.get('docker').ok, 'boolean');
assert.equal(typeof checksById.get('docker').summary, 'string');
```

- [x] **Step 2: Run RED**

Run: `node tests/tests_cli_doctor.mjs`

Expected: FAIL with `missing diagnostic check: docker`.

### Task 2: Implementation

**Files:**
- Modify: `apps/cli/src/index.mjs`

- [x] **Step 1: Add optional Docker check**

In `doctor()`, add:

```js
optionalCommandCheck('docker', 'docker', ['--version'])
```

near the package-manager and git readiness checks.

- [x] **Step 2: Run GREEN**

Run: `node tests/tests_cli_doctor.mjs`

Expected: `{"ok":true,"test":"cli-doctor"}`.

### Task 3: Documentation

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/superpowers/plans/2026-05-25-docker-doctor-diagnostic.md`

- [x] **Step 1: Update docs**

Document that `doctor` reports optional Docker runtime readiness for container-sandbox execution.

- [x] **Step 2: Mark plan steps complete**

Update this plan’s checkboxes as work finishes.

### Task 4: Verification And Publication

**Files:**
- No production edits after verification unless a check gives actionable feedback.

- [x] **Step 1: Focused checks**

Run:

```bash
node --check apps/cli/src/index.mjs
node --check tests/tests_cli_doctor.mjs
node tests/tests_cli_doctor.mjs
pnpm run test:cli
```

- [x] **Step 2: Repository checks**

Run:

```bash
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
```

- [ ] **Step 3: Publish**

Commit as `feat: report docker doctor readiness`, push `codex/add-docker-doctor-diagnostic`, open a PR, and merge after GitHub Actions passes.
