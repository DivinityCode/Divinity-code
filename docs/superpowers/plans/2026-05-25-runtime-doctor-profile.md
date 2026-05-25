# Runtime Doctor Profile Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `divinity doctor` usable from an installed or linked package outside the repository root while keeping source-checkout diagnostics available for contributors.

**Architecture:** Split CLI doctor checks into a default `runtime` profile and an explicit `source` profile. The runtime profile checks the executable environment, package-manager availability, Git, provider catalog, toolset catalog, and optional credentials without requiring the current working directory to be the Divinity source tree. The source profile preserves the existing repository-internal checks for contributor validation.

**Tech Stack:** Node.js ESM CLI, built-in `child_process`, `fs`, `path`, `url`, Markdown docs, repository tests under `tests/`.

---

## Current Shape

- `divinity doctor` always checks `package.json`, `node_modules`, AJV dev dependencies, and `apps/api/src/server.mjs` under `process.cwd()`.
- Public docs recommend `divinity doctor` after `pnpm link --global`, but a linked/installed CLI may run from an arbitrary project directory.
- The Product Plan still lists environment bootstrap checks that do not require repo internals as a remaining public-readiness slice.

## File Structure

- Modify `apps/cli/src/index.mjs`.
- Modify `tests/tests_cli_doctor.mjs`.
- Modify `apps/cli/README.md`.
- Modify `docs/INSTALL.md`.
- Modify `docs/QUICKSTART.md`.
- Modify `docs/RELEASE_CHECKLIST.md`.
- Modify `docs/PRODUCT_PLAN.md`.
- Modify `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `divinity doctor` defaults to a `runtime` profile and can be run from a temp directory without requiring repo-root files.
- Runtime doctor output includes `profile: "runtime"` plus required checks for Node, package-manager readiness, Git, CLI entrypoint, provider catalog, and toolset catalog.
- Runtime doctor output keeps Docker and LLM provider credentials optional, and it does not print secret values.
- Runtime doctor output does not include source-only checks: `package_json`, `node_modules`, `ajv_dependencies`, or `api_server_source`.
- `divinity doctor --profile source` preserves the source-checkout checks and includes `profile: "source"`.
- Unknown doctor options and profiles return a structured `{ ok: false, command: "doctor", error }` payload instead of throwing an unstructured stack.
- Docs distinguish public runtime diagnostics from contributor source diagnostics.

## Tasks

### Task 1: Red Test

- [x] Update `tests/tests_cli_doctor.mjs` to:
  - run default `doctor` from a temp directory;
  - assert `profile === "runtime"`;
  - assert runtime checks include `node`, `npm`, `pnpm`, `package_manager`, `docker`, `git`, `cli_entrypoint`, `provider_catalog`, `toolset_catalog`, and `llm_provider_credentials`;
  - assert runtime checks do not include `package_json`, `node_modules`, `ajv_dependencies`, or `api_server_source`;
  - run `doctor --profile source` from the repository root;
  - assert source checks preserve the existing repo-internal diagnostics;
  - run `doctor --profile invalid` and assert it returns a structured error.
- [x] Run:

```bash
node tests/tests_cli_doctor.mjs
```

Expected: FAIL because default `doctor` still emits source-only checks and has no profile parser.

### Task 2: CLI Implementation

- [x] Add `fileURLToPath` from `url` and derive the current CLI entrypoint from `import.meta.url`.
- [x] Add `cliEntrypointCheck()` that reports the executable source path without reading cwd-local repo files.
- [x] Add `parseDoctorArgs(values)` supporting:
  - no args: `runtime`;
  - `--profile runtime`;
  - `--profile source`;
  - `--runtime`;
  - `--source`.
- [x] Split check builders:
  - `buildRuntimeDoctorChecks()` for runtime-safe checks;
  - `buildSourceDoctorChecks()` that appends source-only checks.
- [x] Update `doctorPayload(options)` to include `profile` and required-only `ok` semantics.
- [x] Update `doctor()` to catch parser errors and print `{ ok: false, command: "doctor", error }`.
- [x] Run:

```bash
node tests/tests_cli_doctor.mjs
```

Expected: PASS with `{"ok":true,"test":"cli-doctor"}`.

### Task 3: Docs

- [x] Update `apps/cli/README.md` to document default runtime diagnostics and `doctor --profile source`.
- [x] Update `docs/INSTALL.md` and `docs/QUICKSTART.md` so public setup uses plain `divinity doctor` and contributor setup can use `divinity doctor --profile source`.
- [x] Update `docs/RELEASE_CHECKLIST.md` to run both runtime and source doctor checks.
- [x] Update `docs/PRODUCT_PLAN.md` and `docs/REPOSITORY_RESEARCH.md` to mark repo-independent runtime doctor checks as implemented.

### Task 4: Verification

- [x] Run focused syntax and doctor checks:

```bash
node --check apps/cli/src/index.mjs
node --check tests/tests_cli_doctor.mjs
node tests/tests_cli_doctor.mjs
pnpm run test:cli
pnpm run test:public-docs
```

- [x] Run package and broader checks:

```bash
pnpm run test:package
pnpm run validate:contracts
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
test ! -e .divinity-provider-usage.json
```

- [ ] Commit as `feat: add runtime doctor profile`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:cli`.

## Self-Review

- Spec coverage: This addresses the public-readiness gap for environment bootstrap checks that do not depend on repo internals.
- Scope boundary: This does not publish packages, remove the non-production warning, or add hosted secret integration.
- Placeholder scan: No placeholder tasks remain.
