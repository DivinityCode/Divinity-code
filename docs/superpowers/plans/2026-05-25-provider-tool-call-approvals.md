# Provider Tool-Call Approval Records Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add durable, redacted approval records for provider-returned tool calls so operator decisions are represented before any future live tool execution loop can consume them.

**Architecture:** Keep provider proxy execution as the boundary for live LLM calls and keep tool execution out of this slice. Add a `divinity.provider_tool_call_approval.v1` contract plus a small package that turns a redacted provider tool-call request into an approve/reject record. Wire an API route under runs so decisions are attached to run state and audit export, and wire a CLI command that can either emit a local record or post it to the API.

**Tech Stack:** Node.js ESM, JSON Schema draft 2020-12, existing CLI/API route patterns, existing audit records, local tests under `tests/`.

---

## Current Shape

- Provider proxy chat and stream execution return `requires_action` with redacted `tool_call_requests` and a required `tool_call_review` operator control.
- Existing approval routes record run approval decisions, comments, revisions, and resubmissions, but they do not record decisions for individual provider tool calls.
- Existing audit export has no `provider_tool_call_approval` audit type.
- Product docs explicitly leave approved live tool execution loops as future work.

## File Structure

- Create `packages/contracts/schemas/provider-tool-call-approval.v1.json`.
- Create `packages/contracts/examples/provider-tool-call-approval.valid.json`.
- Create `packages/contracts/examples/provider-tool-call-approval.invalid.json`.
- Modify `tests/scripts_validate_contracts.mjs` to validate the new schema examples.
- Create `packages/provider-tool-approvals/src/index.mjs`.
- Create `tests/tests_provider_tool_approvals.mjs`.
- Modify `apps/api/src/server.mjs`.
- Modify `apps/cli/src/index.mjs`.
- Modify `tests/tests_api_provider_proxy_chat.mjs`.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`.
- Modify `package.json`.
- Modify docs in `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, `apps/api/README.md`, and `apps/cli/README.md`.

## Acceptance Criteria

- Provider tool-call approval records have `format: "divinity.provider_tool_call_approval.v1"`.
- Records include run id, tool call id, provider id, transport, tool name, sorted argument keys, `arguments_redacted: true`, decision, actor, reason, and decision timestamp.
- Raw tool argument values are never accepted or returned.
- Invalid decisions and non-redacted tool-call requests fail closed.
- API `POST /runs/:id/provider-tool-call-approvals` appends the approval record to the run, records an audit entry with type `provider_tool_call_approval`, persists/broadcasts the run, and returns `{ approval, run }`.
- API `GET /runs/:id/provider-tool-call-approvals` lists attached records.
- CLI `provider-tool-approval` can create a local record without `--api`, or post the same payload to the API with `--api`.
- No tool execution happens in this slice.

## Tasks

### Task 1: Contract And Package Red Tests

- [x] Add schema and valid/invalid examples for `provider-tool-call-approval`.
- [x] Register the schema examples in `tests/scripts_validate_contracts.mjs`.
- [x] Add `tests/tests_provider_tool_approvals.mjs` that imports `createProviderToolCallApproval()` and expects:
  - approve record from a redacted request;
  - reject record from a redacted request;
  - sorted argument keys;
  - serialized output excludes a secret argument value;
  - invalid decision throws;
  - raw `arguments` or `arguments_redacted: false` throws.
- [x] Register the package test in `test` and `test:providers`.
- [x] Run:

```bash
node tests/tests_provider_tool_approvals.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: FAIL because the package/schema are not implemented or registered yet.

### Task 2: Implement Approval Package And Contract

- [x] Implement `createProviderToolCallApproval()` in `packages/provider-tool-approvals/src/index.mjs`.
- [x] Normalize tool-call request input from `tool_call_request` or direct fields.
- [x] Require `decision` to be `approve` or `reject`.
- [x] Require redacted arguments and reject raw `arguments`, `input`, or `argument_values` fields.
- [x] Derive stable approval ids as `provider_tool_call_approval_<run_id>_<tool_call_id>_<index>`.
- [x] Run package and contract tests until green.

### Task 3: API/CLI Red Tests And Wiring

- [x] Extend API provider proxy chat test to:
  - create a run;
  - submit a provider tool-call approval to `POST /runs/:id/provider-tool-call-approvals`;
  - assert HTTP `201`, approval metadata, redaction, run attachment, and audit hash;
  - list approvals through `GET /runs/:id/provider-tool-call-approvals`.
- [x] Extend CLI provider proxy chat test to cover `provider-tool-approval` local and API modes.
- [x] Run the new API/CLI tests and observe expected failures before wiring.
- [x] API: add `GET`/`POST /runs/:id/provider-tool-call-approvals`.
- [x] CLI: parse `provider-tool-approval` arguments and post to the API when `--api` is supplied.
- [x] Run focused API/CLI tests until green.

### Task 4: Docs

- [x] Document the new API route and CLI command.
- [x] Update architecture/free-provider/product docs to say approved tool execution remains future work, but redacted per-tool-call approval recording is now represented.
- [x] State explicitly that this does not execute provider-returned tools automatically.

### Task 5: Verification And Publish

- [x] Run syntax checks:

```bash
node --check packages/provider-tool-approvals/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
node --check tests/tests_provider_tool_approvals.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_tool_approvals.mjs
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

- [ ] Commit as `feat: add provider tool-call approval records`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused provider verification.

## Self-Review

- Spec coverage: This turns provider tool-call governance from a transient result into a contract-visible operator decision record.
- Scope boundary: This does not execute tools, pass raw arguments to clients, persist hosted secrets, or bypass provider limits.
- Placeholder scan: No placeholder tasks remain.
