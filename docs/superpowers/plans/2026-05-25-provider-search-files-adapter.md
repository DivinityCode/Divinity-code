# Provider Search Files Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second approved provider tool execution adapter, `search_files`, so Hermes-style provider tool calls can request repository search context without automatic execution or raw data leakage.

**Architecture:** Extend the existing `packages/provider-tool-executions` boundary. The adapter consumes only approved, redacted provider tool-call approvals plus fresh operator-supplied arguments, searches inside the run workspace, and returns redacted summary metadata only. API and CLI support come through the existing `createProviderToolExecution()` integration, while contracts and docs are updated to recognize the new adapter.

**Tech Stack:** Node.js ESM, provider tool execution package, JSON Schema contracts, CLI/API integration tests, Markdown docs.

---

## Current Shape

- Provider tool execution currently supports only `read_file`.
- Toolset metadata already exposes `search_files` in the `file` toolset.
- CLI/API `provider-tool-execute` already call `createProviderToolExecution()`, so new adapters should be added at the package boundary and verified through package, CLI, and API tests.
- Execution records must not persist raw argument values, file paths, search queries, file contents, or model prompts.

## File Structure

- Modify `tests/tests_provider_tool_executions.mjs` for red/green package coverage.
- Modify `tests/tests_cli_provider_proxy_chat.mjs` for local CLI `search_files` execution coverage.
- Modify `tests/tests_api_provider_proxy_chat.mjs` for API `search_files` execution coverage.
- Modify `packages/provider-tool-executions/src/index.mjs` to implement the adapter.
- Modify `packages/contracts/schemas/provider-tool-execution.v1.json` and `packages/contracts/schemas/run.v1.json` to allow `adapter: "search_files"`.
- Modify `packages/provider-tool-executions/README.md`, `docs/ARCHITECTURE.md`, `apps/api/README.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, and `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `search_files` execution requires an approved `divinity.provider_tool_call_approval.v1` record with `argument_keys: ["path", "query"]`.
- `argument_values` keys must exactly match the approval keys and must be supplied by the operator at execution time.
- The adapter only searches inside `workspace_root`; path traversal fails closed.
- Completed records use `status: "completed"` and `adapter: "search_files"`.
- Records include redacted metadata such as `files_scanned`, `match_count`, `matching_files_count`, `query_redacted: true`, `paths_redacted: true`, and `content_redacted: true`.
- Serialized execution records do not include raw search query, raw path values, matched file paths, or matched file contents.
- CLI and API provider-tool execution flows can create a `search_files` execution without extra route changes.
- Contract validation accepts `adapter: "search_files"` in provider tool execution records.
- Docs no longer say provider tool execution supports only `read_file`.

## Tasks

### Task 1: Red Tests

- [x] Add a `search_files` package test to `tests/tests_provider_tool_executions.mjs` that creates a workspace with files containing a secret query and asserts:
  - execution status is `completed`;
  - adapter is `search_files`;
  - metadata counts are present;
  - serialized execution does not include the query, searched path, matched path, or file contents.
- [x] Add a path traversal assertion for `search_files`.
- [x] Extend CLI and API provider proxy chat tests with approved `search_files` execution.
- [x] Run:

```bash
node tests/tests_provider_tool_executions.mjs
```

Expected: FAIL because `search_files` is still unsupported.

### Task 2: Adapter Implementation

- [x] Add a workspace-contained `searchFilesExecution()` helper in `packages/provider-tool-executions/src/index.mjs`.
- [x] Search files recursively under the operator-supplied workspace-relative `path`, skipping `.git`, `node_modules`, and `dist`.
- [x] Treat the operator-supplied query as a case-insensitive literal string.
- [x] Return only redacted counts and booleans in `output_metadata`.
- [x] Dispatch `approval.name === "search_files"` to the new helper.
- [x] Run:

```bash
node tests/tests_provider_tool_executions.mjs
```

Expected: PASS for package behavior.

### Task 3: Contracts And Docs

- [x] Add `"search_files"` to provider tool execution adapter enums in both contract schemas.
- [x] Update provider execution docs from “read_file only” to “read_file and search_files”.
- [x] Update Product Plan and Repository Research with this implemented production-readiness slice.
- [x] Run:

```bash
pnpm run validate:contracts
pnpm run test:providers
```

Expected: PASS.

### Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/provider-tool-executions/src/index.mjs
node --check tests/tests_provider_tool_executions.mjs
pnpm run validate:contracts
pnpm run test:providers
```

- [x] Run broader checks:

```bash
pnpm test
pnpm run test:deprecations
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
```

- [ ] Commit as `feat: add provider search files adapter`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:providers`.

## Self-Review

- Spec coverage: The plan advances provider/tool execution production readiness and the Hermes-style tool-call loop without introducing automatic tool execution.
- Safety coverage: Raw queries, paths, matched filenames, and file contents stay out of execution records and provider continuation context.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
