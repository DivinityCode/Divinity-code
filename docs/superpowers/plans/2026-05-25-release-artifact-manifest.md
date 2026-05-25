# Release Artifact Manifest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a deterministic generated release artifact manifest so public preview releases can describe package, binary, and source-checkout installation paths without publishing while the project remains private.

**Architecture:** Keep publishing blocked by `private: true` and the README warning, but add a Node-only release artifact generator under `tests/` that writes a JSON manifest to `dist/` or a caller-provided output path. The manifest captures package metadata, CLI bin metadata, install paths, release gates, and the non-production warning state, then tests verify the artifact is deterministic, safe, and non-polluting.

**Tech Stack:** Node.js ESM, JSON release manifest, existing package metadata, Markdown docs, repository tests under `tests/`.

---

## Current Shape

- `package.json` declares `bin.divinity`, Node engine, package manager, repository metadata, and `private: true`.
- Public docs describe source checkout and local `pnpm link --global` paths.
- Product Plan still lists generated release artifacts and published package/binary install paths as the next public-readiness slice.
- The repo has no generated release manifest and no release artifact verification command.

## File Structure

- Create `tests/scripts_release_artifacts.mjs`.
- Create `tests/tests_release_artifacts.mjs`.
- Modify `package.json`.
- Modify `.gitignore`.
- Modify `README.md`.
- Modify `docs/INSTALL.md`.
- Modify `docs/RELEASE_CHECKLIST.md`.
- Modify `docs/PRODUCT_PLAN.md`.
- Modify `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `pnpm run release:artifacts` writes `dist/release-artifacts.json` by default.
- `node tests/scripts_release_artifacts.mjs --output <path>` writes the same manifest to an explicit path without writing repo-root state.
- The manifest includes:
  - `format: "divinity.release_artifacts.v1"`;
  - package name, version, private flag, license, repository URL, Node engine, package manager, and CLI bin;
  - source checkout and local pnpm global-link install paths marked `available`;
  - package registry and binary download install paths marked `blocked` while `private: true`;
  - verification gates for `test:package`, runtime/source doctor profiles, contracts, smoke, provider tests, and full tests;
  - no shared-key, no-signup, quota-bypass, `npx divinity`, or unsupported global npm install instructions.
- `dist/` is ignored so generated artifacts do not pollute normal git status.
- README, Install Guide, Release Checklist, Product Plan, and Repository Research describe the release artifact manifest and keep production publishing gated.

## Tasks

### Task 1: Red Test

- [x] Add `tests/tests_release_artifacts.mjs` that:
  - runs `tests/scripts_release_artifacts.mjs --output <tmp>/release-artifacts.json`;
  - asserts the output file exists and parses as JSON;
  - asserts package metadata mirrors `package.json`;
  - asserts install paths include `source_checkout`, `pnpm_global_link`, `package_registry`, and `binary_download`;
  - asserts source and pnpm link paths are `available`;
  - asserts package registry and binary download paths are `blocked` while `package.private === true`;
  - asserts release gates include `pnpm run test:package`, `node apps/cli/src/index.mjs doctor`, `node apps/cli/src/index.mjs doctor --profile source`, `pnpm run validate:contracts`, `pnpm run test:smoke`, `pnpm run test:providers`, and `pnpm test`;
  - asserts serialized manifest does not contain `npm install -g divinity-code`, `npx divinity`, `public shared key`, `no-signup`, or `bypass`.
- [x] Register `test:release-artifacts` and include it in `test`.
- [x] Run:

```bash
node tests/tests_release_artifacts.mjs
```

Expected: FAIL because the generator does not exist.

### Task 2: Generator Implementation

- [x] Add `tests/scripts_release_artifacts.mjs` with:
  - a `parseArgs()` helper supporting `--output <path>` and `--output=<path>`;
  - a `buildManifest()` helper that reads `package.json` and returns the manifest shape;
  - a default output path of `dist/release-artifacts.json`;
  - directory creation before writing output;
  - JSON output to stdout containing `{ ok: true, artifact_path, artifact }`.
- [x] Add `dist/` to `.gitignore`.
- [x] Run:

```bash
node tests/tests_release_artifacts.mjs
```

Expected: PASS with `{"ok":true,"test":"release-artifacts"}`.

### Task 3: Docs

- [x] Update README validation docs to mention `pnpm run release:artifacts` and `pnpm run test:release-artifacts`.
- [x] Update `docs/INSTALL.md` with release artifact manifest guidance.
- [x] Update `docs/RELEASE_CHECKLIST.md` with release artifact generation and verification.
- [x] Update `docs/PRODUCT_PLAN.md` and `docs/REPOSITORY_RESEARCH.md` to mark generated release artifacts as implemented while keeping published package/binary paths gated.

### Task 4: Verification

- [x] Run focused checks:

```bash
node --check tests/scripts_release_artifacts.mjs
node --check tests/tests_release_artifacts.mjs
node tests/tests_release_artifacts.mjs
pnpm run test:release-artifacts
pnpm run release:artifacts
pnpm run test:public-docs
```

- [x] Run broader checks:

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
git check-ignore -q dist/release-artifacts.json
```

- [ ] Commit as `chore: add release artifact manifest`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:release-artifacts`.

## Self-Review

- Spec coverage: This advances the public release packaging gap by generating a verifiable artifact manifest while keeping unsafe publishing blocked.
- Scope boundary: This does not publish to a registry, remove the README warning, add hosted secret integration, or recommend unsupported install paths.
- Placeholder scan: No placeholder tasks remain.
