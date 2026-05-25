# Provider Tool Continuation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow provider chat calls to continue after operator-reviewed provider tool executions by adding sanitized execution-summary context to the next model request.

**Architecture:** Keep provider tool execution operator-gated and redacted. Add provider proxy continuation context that accepts existing `divinity.provider_tool_execution.v1` records, filters them to completed or failed/blocked summaries, and appends a transport-compatible user context message before the next upstream request. Wire the same input through API and CLI while preserving route policy, provider/tool compatibility checks, usage budgets, prompt budgets, and redaction guarantees.

**Tech Stack:** Node.js ESM, existing provider proxy route policy, existing provider tool execution records, local mock provider tests under `tests/`.

---

## Current Shape

- Provider chat/stream can return `status: "requires_action"` with redacted `tool_call_requests`.
- Provider tool-call approval records capture operator approve/reject decisions without raw arguments.
- Provider tool execution records consume approved calls and currently support read-only `read_file`, storing output summaries and metadata only.
- The current flow stops after execution records. The next model call cannot receive execution result summaries without manually rewriting a prompt.
- Hermes Agent's current release and source layout continue to separate provider identity, transport mode, and toolset/schema handling; Divinity should mirror that by adding transport-neutral continuation context rather than hard-coding provider-specific tool loops in each surface.

## File Structure

- Modify `packages/provider-proxy/src/index.mjs`.
- Modify `apps/api/src/server.mjs`.
- Modify `apps/cli/src/index.mjs`.
- Modify `tests/tests_provider_proxy_chat.mjs`.
- Modify `tests/tests_api_provider_proxy_chat.mjs`.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`.
- Modify docs in `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, `docs/REPOSITORY_RESEARCH.md`, `apps/api/README.md`, `apps/cli/README.md`, and `packages/provider-proxy/README.md`.

## Acceptance Criteria

- `executeProviderProxyChat()` accepts `provider_tool_executions` and sends a sanitized continuation context message to the provider.
- Continuation context includes only execution id, tool call id, tool name, status, adapter, output summary, and output metadata.
- Continuation context excludes prompt text, credentials, raw tool arguments, argument values, file paths, file contents, and provider response text.
- Continuation context is appended after caller-provided messages and works with Chat Completions, Anthropic Messages, and OpenAI Responses because it is represented as an ordinary user message before transport-specific projection.
- Existing prompt budget checks include continuation context so a continuation cannot bypass prompt budget limits.
- API `POST /provider-proxy/chat` accepts `provider_tool_executions`.
- CLI `provider-chat` accepts one or more `--tool-execution-file <path>` JSON files containing a single execution or an array of executions.
- Docs state that continuation uses redacted execution summaries only and does not automatically execute tools, reveal raw outputs, use shared keys, or bypass limits.

## Tasks

### Task 1: Red Tests

- [x] Extend `tests/tests_provider_proxy_chat.mjs` with a mock provider call where:
  - `provider_tool_executions` contains a completed `read_file` execution with secret file path and secret content-like metadata fields;
  - the upstream mock receives the original user message plus one extra user continuation message;
  - that continuation message contains the execution id, tool call id, tool name, status, adapter, output summary, and safe metadata;
  - the continuation message does not contain the secret path, raw argument values, or secret output content.
- [x] Extend `tests/tests_provider_proxy_chat.mjs` with a prompt-budget case proving continuation context counts toward `request_budget.max_prompt_chars`.
- [x] Extend `tests/tests_api_provider_proxy_chat.mjs` so `POST /provider-proxy/chat` forwards `provider_tool_executions` to the mock provider without leaking secret values.
- [x] Extend `tests/tests_cli_provider_proxy_chat.mjs` so `provider-chat --tool-execution-file <json>` forwards the redacted execution summary to the mock provider without leaking secret values.
- [x] Run:

```bash
node tests/tests_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
```

Expected: FAIL because continuation context is not implemented and CLI rejects `--tool-execution-file`.

### Task 2: Provider Proxy Implementation

- [x] Add a helper in `packages/provider-proxy/src/index.mjs` that normalizes `provider_tool_executions` into sanitized records.
- [x] Add a helper that builds a single user continuation message with only safe fields.
- [x] Apply continuation messages before prompt-budget measurement and before `buildTransportRequest()`.
- [x] Ensure invalid/non-object execution inputs are ignored rather than forwarded raw.
- [x] Run focused provider proxy test until green.

### Task 3: API And CLI Wiring

- [x] API: pass `body.provider_tool_executions` to `executeProviderProxyChat()`.
- [x] CLI: parse `--tool-execution-file` and `--tool-execution-file=<path>` into an array of execution records.
- [x] CLI: load each JSON file as either a single execution object, an `execution` wrapper object, or an array of execution objects.
- [x] CLI: reject unreadable or invalid JSON files with a clear `provider-chat` error.
- [x] Run focused API/CLI tests until green.

### Task 4: Docs And Verification

- [x] Update architecture, product plan, free-provider research, API/CLI/provider-proxy READMEs, and repository research.
- [x] Run syntax checks:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
node --check tests/tests_provider_proxy_chat.mjs
node --check tests/tests_api_provider_proxy_chat.mjs
node --check tests/tests_cli_provider_proxy_chat.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
pnpm run test:providers
```

- [x] Run broader checks:

```bash
pnpm run validate:contracts
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files"
test ! -e .divinity.json
test ! -e .divinity-provider-limits.json
test ! -e .divinity-provider-usage.json
```

- [ ] Commit as `feat: add provider tool continuation context`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused provider verification.

## Self-Review

- Spec coverage: This implements the documented next tool-governance slice for model-result continuation after operator-reviewed execution records.
- Scope boundary: This does not execute provider tools automatically, does not store or forward raw tool arguments or file contents, does not add hosted secrets, and does not bypass provider limits or signup requirements.
- Placeholder scan: No placeholder tasks remain.
