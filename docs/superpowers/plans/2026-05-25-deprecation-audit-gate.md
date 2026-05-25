# Deprecation Audit Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an automated deprecation/current-surface audit so public docs and release metadata cannot drift back to deprecated install commands, unsafe provider instructions, or stale provider token fields.

**Architecture:** Keep this as a Node-only verification slice under `tests/`. Add a focused audit test that scans public action docs, release artifact output, and provider proxy docs/code for known stale or unsafe patterns, then wire it into package scripts, release gates, and public docs.

**Tech Stack:** Node.js ESM, Markdown docs, package scripts, release artifact manifest generator, provider proxy docs/code.

---

## Current Shape

- `docs/UPGRADE.md` asks humans to run a manual deprecation review with `rg`.
- `tests/tests_public_onboarding_docs.mjs` blocks a small subset of unsupported install commands.
- `tests/tests_release_artifacts.mjs` blocks a few unsafe strings in generated release metadata.
- There is no dedicated `test:deprecations` gate, and the generated release artifact does not list a deprecation audit gate.

## File Structure

- Create `tests/tests_deprecation_audit.mjs`.
- Modify `package.json`.
- Modify `tests/scripts_release_artifacts.mjs`.
- Modify `tests/tests_release_artifacts.mjs`.
- Modify `tests/tests_public_onboarding_docs.mjs`.
- Modify `docs/UPGRADE.md`.
- Modify `docs/RELEASE_CHECKLIST.md`.
- Modify `docs/PRODUCT_PLAN.md`.
- Modify `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `pnpm run test:deprecations` runs `node tests/tests_deprecation_audit.mjs`.
- The full `pnpm test` script includes `tests/tests_deprecation_audit.mjs`.
- The deprecation audit:
  - verifies actionable public setup docs do not include `npm install -g divinity-code`, `npx divinity`, stale `max_tokens` guidance for OpenAI-compatible/Responses paths, or instructions to use shared public keys/no-signup keys/quota bypass;
  - verifies `docs/UPGRADE.md` tells users to run `pnpm run test:deprecations` instead of relying only on a manual `rg`;
  - generates release metadata to a temp file and verifies `test:deprecations` is one of the release gates;
  - checks provider proxy code/docs keep the current token field split: Chat Completions use `max_completion_tokens`, Responses use `max_output_tokens`, and Anthropic Messages may use current `max_tokens`;
  - allows negative policy language that blocks unsafe provider behavior.
- `test:public-docs`, `test:release-artifacts`, release checklist docs, Product Plan, and Repository Research mention the automated deprecation audit.

## Tasks

### Task 1: Red Test

- [x] Add `tests/tests_deprecation_audit.mjs` that:
  - reads `package.json` and expects `scripts["test:deprecations"] === "node tests/tests_deprecation_audit.mjs"`;
  - expects the full `test` script to contain `node tests/tests_deprecation_audit.mjs`;
  - expects `docs/UPGRADE.md` and `docs/RELEASE_CHECKLIST.md` to include `pnpm run test:deprecations`;
  - runs `tests/scripts_release_artifacts.mjs --output <tmp>/release-artifacts.json` and expects a release gate with command `pnpm run test:deprecations`;
  - scans README, Install, Quickstart, Upgrade, Release Checklist, and release artifact JSON for exact unsupported install commands;
  - checks provider proxy README and implementation for current provider token field usage.
- [x] Run:

```bash
node tests/tests_deprecation_audit.mjs
```

Expected: FAIL because `test:deprecations` and the release gate are not implemented yet.

### Task 2: Wire Audit Gate

- [x] Add `test:deprecations` to `package.json`.
- [x] Add `node tests/tests_deprecation_audit.mjs` to the full `test` script.
- [x] Add `test:deprecations` to `tests/scripts_release_artifacts.mjs` release gates.
- [x] Update `tests/tests_release_artifacts.mjs` to expect the deprecation gate.
- [x] Run:

```bash
node tests/tests_deprecation_audit.mjs
```

Expected: FAIL until docs mention the audit command.

### Task 3: Docs

- [x] Update `docs/UPGRADE.md` to replace the manual-only deprecation review with `pnpm run test:deprecations` plus optional manual follow-up.
- [x] Update `docs/RELEASE_CHECKLIST.md` with the deprecation audit gate.
- [x] Update `tests/tests_public_onboarding_docs.mjs` to require `pnpm run test:deprecations`.
- [x] Update `docs/PRODUCT_PLAN.md` and `docs/REPOSITORY_RESEARCH.md` to mark the deprecation audit gate as implemented.
- [x] Run:

```bash
node tests/tests_deprecation_audit.mjs
```

Expected: PASS with `{"ok":true,"test":"deprecation-audit"}`.

### Task 4: Verification

- [x] Run focused checks:

```bash
node --check tests/tests_deprecation_audit.mjs
node tests/tests_deprecation_audit.mjs
pnpm run test:deprecations
pnpm run test:public-docs
pnpm run test:release-artifacts
pnpm run release:artifacts
```

- [x] Run broader checks:

```bash
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
test ! -e .divinity-provider-usage.json
git check-ignore -q dist/release-artifacts.json
```

- [ ] Commit as `test: add deprecation audit gate`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:deprecations`.

## Self-Review

- Spec coverage: This directly addresses the objective's requirement to keep docs current and avoid deprecated instructions.
- Scope boundary: This does not claim all upstream releases are current forever and does not remove the non-production warning.
- Placeholder scan: No placeholder tasks remain.
