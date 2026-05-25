# Public Onboarding Docs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verifiable public install, quickstart, upgrade, and release-readiness documentation so external builders can start without reading repository internals.

**Architecture:** Keep this as a documentation and validation slice. Add a focused public onboarding smoke test that checks the required docs exist, are linked from the README, include the current Node/Corepack/pnpm workflow, reference current CLI/API/provider commands, and avoid unsupported/deprecated install instructions. Register the test in `package.json` so public docs remain guarded by the normal suite.

**Tech Stack:** Markdown docs, Node.js ESM test under `tests/`, existing package script conventions.

---

## Current Shape

- The README has a development warning and high-level repo map, but it does not link install, quickstart, upgrade, or release readiness docs.
- Product Plan Phase 3 explicitly lists public onboarding and release packaging as a next production slice.
- Local `npm` is unavailable in this environment, while Node and Corepack pnpm are usable. Public docs should document the current reliable path without presenting deprecated or unsupported package-manager flows as canonical.
- Existing tests validate contracts and behavior, but no test guards public onboarding docs.

## File Structure

- Create `docs/INSTALL.md`.
- Create `docs/QUICKSTART.md`.
- Create `docs/UPGRADE.md`.
- Create `docs/RELEASE_CHECKLIST.md`.
- Create `tests/tests_public_onboarding_docs.mjs`.
- Modify `README.md`.
- Modify `docs/PRODUCT_PLAN.md`.
- Modify `docs/REPOSITORY_RESEARCH.md`.
- Modify `package.json`.

## Acceptance Criteria

- README links to install, quickstart, upgrade, and release checklist docs.
- Install docs specify supported local prerequisites, Node, Corepack pnpm fallback, optional npm, `pnpm install`, `pnpm run validate:contracts`, and `pnpm test`.
- Quickstart docs show a first run path using `divinity init`, `divinity doctor`, `divinity providers`, `divinity provider-route`, `divinity run`, `divinity status`, and `pnpm run test:smoke`.
- Upgrade docs include `git pull --ff-only`, dependency refresh, contract validation, full tests, provider-focused tests, smoke tests, and a deprecation/current-surface review.
- Release checklist includes branch cleanliness, docs freshness, README warning review, contract validation, full tests, smoke tests, provider tests, root pollution checks, conflict marker scan, and GitHub Actions.
- Public docs do not recommend unsupported global npm installation or npx execution.
- `npm` remains documented as optional/unavailable-friendly rather than required as the only path.

## Tasks

### Task 1: Red Test

- [x] Add `tests/tests_public_onboarding_docs.mjs` that reads README and public onboarding docs.
- [x] Assert `docs/INSTALL.md`, `docs/QUICKSTART.md`, `docs/UPGRADE.md`, and `docs/RELEASE_CHECKLIST.md` exist.
- [x] Assert README links all four docs.
- [x] Assert the docs include the required commands and current package-manager guidance.
- [x] Assert the docs do not contain `npm install -g divinity-code`, `npx divinity`, or `npm install` as the only install path.
- [x] Register `test:public-docs` and include it in `test`.
- [x] Run:

```bash
node tests/tests_public_onboarding_docs.mjs
```

Expected: FAIL because the public onboarding docs do not exist yet.

### Task 2: Docs Implementation

- [x] Add `docs/INSTALL.md` with supported prerequisites, dependency install, validation, provider credential setup, local API/dashboard notes, and troubleshooting for missing `npm`.
- [x] Add `docs/QUICKSTART.md` with a 10-minute local path from clone to smoke test and first CLI/API run.
- [x] Add `docs/UPGRADE.md` with a safe pull/update/verify procedure and deprecation review.
- [x] Add `docs/RELEASE_CHECKLIST.md` with release gates and non-production warning review.
- [x] Update README documents list and validation section.
- [x] Update Product Plan public onboarding status and Repository Research build slice list.

### Task 3: Verification

- [x] Run syntax check:

```bash
node --check tests/tests_public_onboarding_docs.mjs
```

- [x] Run focused checks:

```bash
node tests/tests_public_onboarding_docs.mjs
pnpm run test:public-docs
pnpm run validate:contracts
pnpm run test:smoke
```

- [x] Run broader checks:

```bash
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
test ! -e .divinity-provider-usage.json
```

- [ ] Commit as `docs: add public onboarding guides`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:public-docs`.

## Self-Review

- Spec coverage: This advances the public production-readiness requirement with install, quickstart, upgrade, and release documentation plus a guard test.
- Scope boundary: This does not claim the product is production-ready and does not add hosted identity, billing, shared credentials, no-signup API keys, or provider limit bypasses.
- Placeholder scan: No placeholder tasks remain.
