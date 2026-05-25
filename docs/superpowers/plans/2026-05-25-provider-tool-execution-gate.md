# Provider Tool Execution Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an approved, redacted provider tool execution gate so recorded provider tool-call approvals can be consumed without persisting raw arguments or allowing automatic model-driven tool execution.

**Architecture:** Keep provider-returned tool calls gated behind operator approval. Add a `divinity.provider_tool_execution.v1` record and a small execution package that requires an approved provider tool-call approval plus fresh operator-supplied arguments whose keys exactly match the approval. Implement a first read-only local adapter for `read_file`, store only redacted argument keys and output summaries, and expose the flow through API and CLI routes.

**Tech Stack:** Node.js ESM, JSON Schema draft 2020-12, existing run/audit storage, existing CLI/API route patterns, tests under `tests/`.

---

## Current Shape

- Provider proxy chat and stream requests return `requires_action` with redacted `tool_call_requests` when providers ask for tools.
- `provider-tool-approval` and `POST /runs/:id/provider-tool-call-approvals` record approve/reject decisions but do not consume them.
- Approval records intentionally do not store raw argument values, so execution must receive fresh argument values from an operator-controlled request.
- Product docs list approved provider tool execution loops as the next tool-governance production slice.

## File Structure

- Create `packages/contracts/schemas/provider-tool-execution.v1.json`.
- Create `packages/contracts/examples/provider-tool-execution.valid.json`.
- Create `packages/contracts/examples/provider-tool-execution.invalid.json`.
- Modify `tests/scripts_validate_contracts.mjs`.
- Create `packages/provider-tool-executions/src/index.mjs`.
- Create `tests/tests_provider_tool_executions.mjs`.
- Modify `packages/contracts/schemas/run.v1.json`.
- Modify `packages/contracts/schemas/audit.v1.json`.
- Modify `apps/api/src/server.mjs`.
- Modify `apps/cli/src/index.mjs`.
- Modify `tests/tests_api_provider_proxy_chat.mjs`.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`.
- Modify `package.json`.
- Modify docs in `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, `docs/REPOSITORY_RESEARCH.md`, `apps/api/README.md`, `apps/cli/README.md`, and `packages/provider-proxy/README.md`.

## Acceptance Criteria

- Provider tool execution records have `format: "divinity.provider_tool_execution.v1"`.
- Records consume an existing `divinity.provider_tool_call_approval.v1` record with `decision: "approve"`.
- Rejected approvals, missing approvals, and non-redacted approvals fail closed.
- Execution requires fresh `argument_values`; their sorted keys must exactly match the approval `argument_keys`.
- Raw argument values are never persisted in execution records, API responses, CLI output, or audit records.
- The first built-in adapter supports `read_file` only, reads from the run workspace root, blocks path traversal, and stores only output summary/metadata.
- Unsupported provider tool names return a redacted `blocked` execution record instead of executing.
- API exposes `GET` and `POST /runs/:id/provider-tool-executions`.
- CLI exposes `provider-tool-execute`, with local and API modes matching the existing provider approval command style.
- Contracts, docs, and tests reflect that execution is still operator-gated; provider models do not execute tools automatically.

## Tasks

### Task 1: Contract And Package Red Tests

- [x] Add `tests/tests_provider_tool_executions.mjs` covering:
  - approved `read_file` execution with `argument_values: { path: "README.md" }`;
  - execution id and approval id linkage;
  - sorted `argument_keys`, `arguments_redacted: true`, `status: "completed"`, and `adapter: "read_file"`;
  - serialized execution output excludes the raw path value and fixture file contents;
  - rejected approvals throw before execution;
  - argument key mismatches throw;
  - path traversal throws or returns a failed redacted record.
- [x] Add schema and valid/invalid examples for `provider-tool-execution`.
- [x] Register the schema examples in `tests/scripts_validate_contracts.mjs`.
- [x] Register the package test in `test` and `test:providers`.
- [x] Run:

```bash
node tests/tests_provider_tool_executions.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: FAIL because the package and schema are not implemented yet.

### Task 2: Implement Execution Package And Contracts

- [x] Implement `createProviderToolExecution()` in `packages/provider-tool-executions/src/index.mjs`.
- [x] Require an approved, redacted provider tool-call approval.
- [x] Require `argument_values` to be a plain object and its keys to exactly match the approval keys.
- [x] Implement the `read_file` adapter with workspace path containment and summary-only output.
- [x] Return `blocked` records for unsupported tool names without throwing after approval/key validation.
- [x] Add `provider_tool_executions` arrays to run contracts and `provider_tool_execution` to audit contracts.
- [x] Run package and contract tests until green.

### Task 3: API/CLI Red Tests And Wiring

- [x] Extend API provider proxy chat test to:
  - record an approved `read_file` provider tool-call approval;
  - POST to `/runs/:id/provider-tool-executions` with fresh `argument_values`;
  - assert HTTP `201`, redacted completed execution, run attachment, and audit record;
  - assert GET lists the execution;
  - assert raw argument values and fixture file contents are not serialized.
- [x] Extend CLI provider proxy chat test to cover `provider-tool-execute` local and API modes.
- [x] Run the new API/CLI tests and observe expected failures before wiring.
- [x] API: add `GET`/`POST /runs/:id/provider-tool-executions`, append records to the run, audit them, persist, and broadcast.
- [x] CLI: parse `provider-tool-execute` arguments and post to the API when `--api` is supplied.
- [x] Run focused API/CLI tests until green.

### Task 4: Docs

- [x] Document the API route and CLI command.
- [x] Update architecture/free-provider/product docs to state that provider tool execution now consumes approved calls for the first read-only adapter while remaining operator-gated and redacted.
- [x] State explicitly that public shared keys, no-signup credentials, provider limit bypasses, and automatic model-driven tool execution remain out of scope.

### Task 5: Verification And Publish

- [x] Run syntax checks:

```bash
node --check packages/provider-tool-executions/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
node --check tests/tests_provider_tool_executions.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_tool_executions.mjs
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
```

- [x] Run broader checks:

```bash
pnpm run test:providers
pnpm run validate:contracts
pnpm test
```

- [x] Run hygiene:

```bash
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
```

- [ ] Commit as `feat: add provider tool execution gate`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused provider verification.

## Self-Review

- Spec coverage: This consumes existing provider tool approvals with a gated execution record and first read-only adapter.
- Scope boundary: This does not let providers execute tools automatically, does not persist raw arguments, and does not bypass provider limits or credential requirements.
- Placeholder scan: No placeholder tasks remain.
