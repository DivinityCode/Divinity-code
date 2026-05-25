# Package Bin Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add verifiable package metadata and a `divinity` CLI bin entry so release artifacts and source-checkout installs have a stable command path.

**Architecture:** Keep the package private while the production warning remains active, but make `npm pack`/pnpm link-style artifacts predictable by declaring bin, engines, package manager, repository, files, and license metadata. Add a package manifest test that executes the declared bin target through Node and checks package-lock root metadata stays in sync where applicable.

**Tech Stack:** Node.js ESM, package manifest metadata, existing CLI entrypoint, Markdown docs.

---

## Current Shape

- `apps/cli/src/index.mjs` has a shebang and executable bit.
- `package.json` has no `bin` field, no `engines`, no `packageManager`, no `repository`, and no package `files` allowlist.
- Public docs mention the installed binary name, but there is no package manifest evidence that `divinity` resolves to the CLI entrypoint.
- The product plan still lists published package/binary installation paths as a remaining public onboarding slice.

## File Structure

- Modify `package.json`.
- Modify `package-lock.json`.
- Create `tests/tests_package_manifest.mjs`.
- Modify `README.md`.
- Modify `docs/INSTALL.md`.
- Modify `docs/QUICKSTART.md`.
- Modify `docs/RELEASE_CHECKLIST.md`.
- Modify `docs/PRODUCT_PLAN.md`.
- Modify `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `package.json` declares `bin.divinity: "apps/cli/src/index.mjs"`.
- `package.json` declares Node engine support, package manager, repository URL, files allowlist, and an explicit non-production license value.
- The declared bin target exists, is executable, starts with a Node shebang, and can run a simple CLI command through Node.
- `package-lock.json` root package metadata mirrors relevant package metadata.
- README and docs mention the source checkout command path and local pnpm global-link path without recommending unsupported global npm or npx install paths.
- Product Plan and Repository Research mark package/bin manifest readiness as implemented while keeping published packages/binaries as future work.

## Tasks

### Task 1: Red Test

- [x] Add `tests/tests_package_manifest.mjs` that:
  - reads `package.json` and `package-lock.json`;
  - expects `bin.divinity` to point at `apps/cli/src/index.mjs`;
  - expects `engines.node`, `packageManager`, `repository.url`, `license`, and `files`;
  - checks the bin path exists, is executable, has a Node shebang, and emits valid JSON for `providers`;
  - checks package-lock root `bin`, `engines`, `license`, and `devDependencies` align with package.json.
- [x] Register `test:package` and include it in `test`.
- [x] Run:

```bash
node tests/tests_package_manifest.mjs
```

Expected: FAIL because the manifest lacks the bin and package metadata.

### Task 2: Manifest Implementation

- [x] Add package metadata to `package.json`.
- [x] Add matching root metadata to `package-lock.json`.
- [x] Run the package manifest test until green.

### Task 3: Docs

- [x] Update README validation/docs to mention `pnpm run test:package`.
- [x] Update Install and Quickstart docs with source-checkout and `pnpm link --global` command paths.
- [x] Update Release Checklist with package manifest and bin smoke gates.
- [x] Update Product Plan and Repository Research status.

### Task 4: Verification

- [x] Run syntax/focused checks:

```bash
node --check tests/tests_package_manifest.mjs
node tests/tests_package_manifest.mjs
pnpm run test:package
pnpm run test:public-docs
```

- [x] Run broader checks:

```bash
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

- [ ] Commit as `chore: add package bin manifest`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:package`.

## Self-Review

- Spec coverage: This advances public release packaging by making the CLI binary path and package metadata explicit and tested.
- Scope boundary: This does not remove the non-production warning, publish a package, add hosted identity/billing/secrets, or recommend unsupported global npm/npx install paths.
- Placeholder scan: No placeholder tasks remain.
