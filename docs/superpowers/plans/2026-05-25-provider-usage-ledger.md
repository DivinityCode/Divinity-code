# Provider Usage Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans or superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a redacted provider request/token usage ledger so free-tier and paid provider routing can enforce operator-owned budgets without storing prompts, credentials, request bodies, or public shared keys.

**Architecture:** Keep the existing provider limit ledger for upstream `429` retry windows. Add a separate `divinity.provider_usage_ledger.v1` package that records provider/model request counts and token totals by UTC day. Wire provider chat and streaming execution to record completed and requires-action calls, expose optional budget gates before upstream requests, and make API/CLI use a configured file-backed ledger when `DIVINITY_PROVIDER_USAGE_LEDGER_PATH` is set.

**Tech Stack:** Node.js ESM, JSON Schema draft 2020-12, existing provider proxy route policy, existing CLI/API route patterns, local tests under `tests/`.

---

## Current Shape

- `packages/provider-proxy/src/limit-ledger.mjs` tracks provider retry windows from upstream `429` responses only.
- Provider chat and stream results carry usage metadata from Chat Completions, Anthropic Messages, and OpenAI Responses, but no managed request/token usage totals are persisted.
- `docs/FREE_LLM_PROVIDER_RESEARCH.md` explicitly lists fuller per-provider request/token budgets as the next safe slice.
- Public shared keys, no-signup credentials, and quota-bypass rotation remain excluded.

## File Structure

- Create `packages/provider-proxy/src/usage-ledger.mjs`.
- Modify `packages/provider-proxy/src/index.mjs`.
- Modify `apps/api/src/server.mjs`.
- Modify `apps/cli/src/index.mjs`.
- Create `tests/tests_provider_usage_ledger.mjs`.
- Modify `tests/tests_provider_proxy_chat.mjs`.
- Modify `tests/tests_provider_proxy_stream.mjs`.
- Modify `tests/tests_api_provider_proxy_chat.mjs`.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`.
- Modify `package.json`.
- Create `packages/contracts/schemas/provider-usage-ledger.v1.json`.
- Create `packages/contracts/examples/provider-usage-ledger.valid.json`.
- Create `packages/contracts/examples/provider-usage-ledger.invalid.json`.
- Modify `tests/scripts_validate_contracts.mjs`.
- Modify docs in `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, `docs/REPOSITORY_RESEARCH.md`, `apps/api/README.md`, `apps/cli/README.md`, and `packages/provider-proxy/README.md`.

## Acceptance Criteria

- Usage ledger records have `format: "divinity.provider_usage_ledger.v1"`.
- Ledger keys are provider id, model id, and UTC day. Prompt text, request bodies, credentials, tool arguments, and provider response text are never persisted.
- Completed, streaming completed, and `requires_action` provider calls record one request plus available input/output/total token counts.
- Usage records are exposed in provider chat/stream result metadata as `usage_ledger_record` without secret values.
- A `usage_budget` input can block a request before the upstream call when daily request or token totals would exceed configured limits.
- API and CLI use `DIVINITY_PROVIDER_USAGE_LEDGER_PATH` when configured, while preserving in-memory/no-ledger behavior when absent.
- Docs state that usage budgets are for operator-owned providers only and do not enable public shared keys or quota bypass.

## Tasks

### Task 1: Ledger Red Tests

- [x] Add `tests/tests_provider_usage_ledger.mjs` that expects:
  - `createProviderUsageLedger()` records request, input, output, and total token counts by provider/model/day;
  - file-backed ledgers round-trip through JSON without prompt, credential, request-body, or response text fields;
  - `wouldExceedBudget()` blocks when next request or token totals would pass a daily cap;
  - invalid negative counts normalize to zero.
- [x] Add schema and valid/invalid examples for `provider-usage-ledger`.
- [x] Register schema examples in `tests/scripts_validate_contracts.mjs`.
- [x] Register the ledger test in `test` and `test:providers`.
- [x] Run:

```bash
node tests/tests_provider_usage_ledger.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: FAIL because the usage ledger package is not implemented yet.

### Task 2: Provider Proxy Red Tests

- [x] Extend `tests/tests_provider_proxy_chat.mjs` so a completed Chat Completions call with usage records `usage_ledger_record`, then a second call with a strict `usage_budget.max_daily_requests` is blocked before the mock server receives another request.
- [x] Extend `tests/tests_provider_proxy_stream.mjs` so a completed stream records available usage totals.
- [x] Run the focused provider tests and observe expected failures before wiring.

### Task 3: Implement Ledger And Provider Proxy Wiring

- [x] Implement `createProviderUsageLedger()` and `createConfiguredProviderUsageLedger()` in `packages/provider-proxy/src/usage-ledger.mjs`.
- [x] Export the usage ledger helpers from `packages/provider-proxy/src/index.mjs`.
- [x] Add preflight budget checks to provider chat/stream preparation using `usage_budget`.
- [x] Record usage for completed and requires-action chat results after normalization.
- [x] Record usage for completed stream results after stream normalization.
- [x] Return `usage_ledger_record` on results when a ledger records usage.
- [x] Run package/provider tests until green.

### Task 4: API/CLI Wiring Tests And Implementation

- [x] Extend API provider proxy chat tests to use a temp `DIVINITY_PROVIDER_USAGE_LEDGER_PATH`, assert completed calls include `usage_ledger_record`, and assert a second request can be blocked by `usage_budget.max_daily_requests`.
- [x] Extend CLI provider proxy chat tests to use `DIVINITY_PROVIDER_USAGE_LEDGER_PATH` and assert `provider-chat` outputs `usage_ledger_record`.
- [x] API: create a configured provider usage ledger and pass it to chat and stream executions.
- [x] CLI: create a configured provider usage ledger and pass it to chat execution.
- [x] CLI/API: parse and forward `usage_budget.max_daily_requests`, `usage_budget.max_daily_input_tokens`, `usage_budget.max_daily_output_tokens`, and `usage_budget.max_daily_total_tokens`.
- [x] Run focused API/CLI tests until green.

### Task 5: Docs And Verification

- [x] Update architecture, product plan, free-provider research, API/CLI/provider-proxy READMEs, repository research, and contract changelog.
- [x] Run syntax checks:

```bash
node --check packages/provider-proxy/src/usage-ledger.mjs
node --check packages/provider-proxy/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
node --check tests/tests_provider_usage_ledger.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_usage_ledger.mjs
node tests/tests_provider_proxy_chat.mjs
node tests/tests_provider_proxy_stream.mjs
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
pnpm run validate:contracts
pnpm run test:providers
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

- [ ] Commit as `feat: add provider usage ledger`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused provider verification.

## Self-Review

- Spec coverage: This directly implements the documented next safe slice for fuller per-provider request/token budgets.
- Scope boundary: This does not add public shared keys, no-signup credentials, quota bypass, hidden failover, hosted secrets, or new live external provider tests.
- Placeholder scan: No placeholder tasks remain.
