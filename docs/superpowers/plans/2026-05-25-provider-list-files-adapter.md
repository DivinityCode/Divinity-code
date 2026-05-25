# Provider List Files Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a read-only `list_files` provider tool execution adapter so operator-approved provider tool calls can request repository shape metadata without exposing raw paths or file contents.

**Architecture:** Extend the existing `packages/provider-tool-executions` boundary. The adapter consumes an approved, redacted provider tool-call approval plus fresh operator-supplied arguments, lists only inside the run workspace, and stores redacted count metadata. Existing CLI/API `provider-tool-execute` paths continue to call `createProviderToolExecution()`, while provider continuation receives only safe numeric and boolean metadata.

**Tech Stack:** Node.js ESM, JSON Schema contracts, provider tool execution package, provider proxy continuation sanitization, CLI/API integration tests, Markdown docs.

---

## Current Shape

- Provider tool execution supports `read_file` and `search_files`.
- Toolset metadata exposes `read_file` and `search_files`, but no dedicated file listing tool.
- CLI/API `provider-tool-execute` already accept arbitrary `key=value` argument values and delegate to `createProviderToolExecution()`.
- Execution records must not persist raw argument values, file paths, filenames, file contents, prompts, credentials, or raw outputs.

## File Structure

- Modify `packages/toolsets/src/index.mjs` to expose `list_files` in the `file` toolset and provider-neutral tool schema.
- Modify `packages/provider-tool-executions/src/index.mjs` to implement `list_files`.
- Modify `packages/provider-proxy/src/index.mjs` to pass only safe `list_files` continuation metadata.
- Modify `packages/contracts/schemas/provider-tool-execution.v1.json` and `packages/contracts/schemas/run.v1.json` to allow `adapter: "list_files"`.
- Modify `tests/tests_toolsets.mjs`, `tests/tests_provider_tool_executions.mjs`, `tests/tests_provider_proxy_chat.mjs`, `tests/tests_cli_provider_proxy_chat.mjs`, and `tests/tests_api_provider_proxy_chat.mjs` for red/green coverage.
- Modify `packages/provider-tool-executions/README.md`, `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, and `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `list_files` is visible in the default `file` toolset and has a provider-neutral schema with `path` and optional `max_depth`.
- `list_files` execution requires an approved `divinity.provider_tool_call_approval.v1` record with exactly the fresh operator-supplied argument keys from approval.
- The adapter only lists inside `workspace_root`; traversal and root-as-file confusion fail closed.
- Completed records use `status: "completed"` and `adapter: "list_files"`.
- Records include only redacted metadata such as `files_listed`, `directories_scanned`, `max_depth`, `paths_redacted: true`, and `content_redacted: true`.
- Serialized execution records and provider continuation context do not include raw path values, filenames, directory names, file contents, prompts, or credentials.
- CLI and API provider-tool execution flows can create `list_files` execution records without new route handlers.
- Contract validation accepts `adapter: "list_files"` in provider tool execution records.
- Docs describe `read_file`, `search_files`, and `list_files` as current read-only adapters.

## Tasks

### Task 1: Red Tests

- [x] Add `list_files` to the expected default file toolset behavior in `tests/tests_toolsets.mjs`.
- [x] Add a `list_files` package test in `tests/tests_provider_tool_executions.mjs` that creates nested secret filenames and asserts completed metadata counts while serialized records omit raw paths and filenames.
- [x] Add traversal coverage for `list_files`.
- [x] Extend provider continuation tests so safe `list_files` numeric/boolean metadata is forwarded and unsafe metadata is dropped.
- [x] Extend CLI and API provider tool execution tests with approved `list_files` records.
- [x] Run `node tests/tests_toolsets.mjs`, `node tests/tests_provider_tool_executions.mjs`, `node tests/tests_provider_proxy_chat.mjs`, `node tests/tests_cli_provider_proxy_chat.mjs`, and `node tests/tests_api_provider_proxy_chat.mjs`.
- [x] Expected result: FAIL because `list_files` is not yet exposed or implemented.

### Task 2: Adapter Implementation

- [x] Add `list_files` to the file toolset and `TOOL_SCHEMAS`.
- [x] Add a workspace-contained `listFilesExecution()` helper in `packages/provider-tool-executions/src/index.mjs`.
- [x] Recursively inspect directories under the approved scope, skip `.git`, `node_modules`, and `dist`, and count files and directories without storing names.
- [x] Respect optional numeric `max_depth`; invalid or missing values default to a bounded recursive scan.
- [x] Dispatch `approval.name === "list_files"` to the new helper.
- [x] Add safe continuation metadata keys for `files_listed`, `directories_scanned`, and `max_depth`.
- [x] Run the focused Node tests from Task 1.
- [x] Expected result: PASS.

### Task 3: Contracts And Docs

- [x] Add `"list_files"` to provider tool execution adapter enums in the provider execution schema and embedded run schema.
- [x] Update provider execution docs from “read_file and search_files” to “read_file, search_files, and list_files”.
- [x] Update Product Plan and Repository Research with the implemented slice.
- [x] Run `pnpm run validate:contracts` and `pnpm run test:providers`.
- [x] Expected result: PASS.

### Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/toolsets/src/index.mjs
node --check packages/provider-tool-executions/src/index.mjs
node --check packages/provider-proxy/src/index.mjs
node --check tests/tests_toolsets.mjs
node --check tests/tests_provider_tool_executions.mjs
pnpm run validate:contracts
pnpm run test:providers
```

- [x] Run broader checks:

```bash
pnpm run test:smoke
pnpm test
pnpm run test:deprecations
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
```

- [ ] Commit as `feat: add provider list files adapter`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:providers`.

## Self-Review

- Spec coverage: This advances the production-readiness objective by adding another Hermes-style read-only provider tool adapter without automatic execution or raw data leakage.
- Safety coverage: Raw paths, filenames, directory names, file contents, prompts, and credentials stay out of execution records and continuation context.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
