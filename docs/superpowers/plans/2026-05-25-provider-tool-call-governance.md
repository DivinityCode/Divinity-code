# Provider Tool Call Governance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Detect provider-returned tool calls, normalize them into redacted governance metadata, and require operator review instead of executing tools automatically.

**Architecture:** Keep provider proxy execution as the single boundary for live LLM calls. Extend transport result normalization to recognize Chat Completions `message.tool_calls`, Anthropic Messages `tool_use` content blocks, and OpenAI Responses `function_call` output items, then return `status: "requires_action"` with redacted `tool_call_requests` and an operator control.

**Tech Stack:** Node.js ESM, built-in HTTP mock servers, existing provider proxy package, CLI/API provider-chat surfaces, official OpenAI Responses/Tools docs, and official Anthropic tool-use docs.

---

## Current API Shape Notes

- OpenAI Responses uses typed output Items; function calls are `function_call` Items, and tool calls/tool outputs are correlated with `call_id`.
- Chat Completions remains supported, but Responses is recommended for new OpenAI projects; Chat Completions tool calls appear on `message.tool_calls`.
- Anthropic Messages client tools return `stop_reason: "tool_use"` and `tool_use` content blocks with `id`, `name`, and `input`.
- This slice does not send tool definitions, execute tools, or return tool outputs. It only safely normalizes provider intent for operator review.

## File Structure

- Modify `packages/provider-proxy/src/index.mjs`: add redacted tool-call extraction helpers and set `requires_action` on tool-call responses.
- Modify `apps/api/src/server.mjs`: return HTTP `202` for `requires_action`.
- Modify `tests/tests_provider_proxy_chat.mjs`: assert Chat Completions, Anthropic Messages, and OpenAI Responses tool-call normalization and argument redaction.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`: assert CLI exposes `requires_action` metadata without raw arguments.
- Modify `tests/tests_api_provider_proxy_chat.mjs`: assert API returns HTTP `202` and redacted metadata.
- Modify docs in `apps/cli/README.md`, `apps/api/README.md`, `packages/provider-proxy/README.md`, `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, and `docs/PRODUCT_PLAN.md`.

## Acceptance Criteria

- Provider proxy result status is `requires_action` when a provider response contains tool calls.
- Returned `tool_call_requests` include ids, provider id, transport, tool names, argument keys, and `arguments_redacted: true`; raw argument values are not included.
- Returned `operator_controls` include `tool_call_review` with `status: "required"`.
- The raw prompt and raw tool argument values do not appear anywhere in serialized provider proxy results.
- API `POST /provider-proxy/chat` maps `requires_action` to HTTP `202`.
- Existing completed, blocked, limited, and failed provider proxy paths still work.

## Tasks

### Task 1: Package Red Tests

**Files:**
- Modify: `tests/tests_provider_proxy_chat.mjs`

- [x] Add Chat Completions tool-call response test:

```js
const toolSecret = 'secret tool argument value';
const toolCallServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 200;
  res.setHeader('content-type', 'application/json');
  res.end(JSON.stringify({
    id: 'chatcmpl_tool_mock',
    object: 'chat.completion',
    model: 'mock-model',
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content: null,
        tool_calls: [{
          id: 'call_search_1',
          type: 'function',
          function: {
            name: 'web_search',
            arguments: JSON.stringify({ query: toolSecret })
          }
        }]
      },
      finish_reason: 'tool_calls'
    }],
    usage: { prompt_tokens: 4, completion_tokens: 3, total_tokens: 7 }
  }));
});
```

Assert `status === "requires_action"`, `tool_call_requests[0].name === "web_search"`, `argument_keys` equals `["query"]`, `arguments_redacted === true`, `operator_controls[0].control_id === "tool_call_review"`, and serialized result does not include `toolSecret`.

- [x] Add Anthropic `tool_use` response test with content block `{ type: "tool_use", id, name, input: { path: toolSecret } }`.

- [x] Add OpenAI Responses `function_call` output item test with `{ type: "function_call", call_id, name, arguments: JSON.stringify({ file: toolSecret }) }`.

- [x] Run: `node tests/tests_provider_proxy_chat.mjs`.
Expected: FAIL because tool calls are currently returned as raw provider messages or ignored.

### Task 2: CLI/API Red Tests

**Files:**
- Modify: `tests/tests_cli_provider_proxy_chat.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`

- [x] Add one CLI mock response with Chat Completions `message.tool_calls`; assert `ok === false`, `result.status === "requires_action"`, redacted tool-call metadata exists, and raw argument value is absent.

- [x] Add one API mock response with Chat Completions `message.tool_calls`; assert HTTP status `202`, `result.status === "requires_action"`, redacted tool-call metadata exists, and raw argument value is absent.

- [x] Run: `node tests/tests_cli_provider_proxy_chat.mjs` and `node tests/tests_api_provider_proxy_chat.mjs`.
Expected: FAIL because CLI/API do not yet receive redacted tool-call governance metadata and API does not map `requires_action` to `202`.

### Task 3: Implement Redacted Tool-Call Normalization

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`

- [x] Add helpers:
  - `parseJsonObject(value)`
  - `argumentKeysFrom(value)`
  - `toolCallRequest({ runtime, toolCallId, name, argumentSource })`
  - `toolCallReviewControl(toolCallRequests)`
  - `withToolCallGovernance(result, toolCallRequests)`
  - `redactedChatMessage(message)`
  - `redactedAnthropicContent(content)`

- [x] For Chat Completions:
  - extract `message.tool_calls[]`.
  - do not return raw `function.arguments`.
  - set status to `requires_action` when any tool calls exist.

- [x] For Anthropic Messages:
  - extract `content[]` blocks with `type: "tool_use"`.
  - redact `input` from returned message content.
  - set status to `requires_action` when any tool calls exist.

- [x] For OpenAI Responses:
  - extract `output[]` items with `type: "function_call"`.
  - do not return raw `arguments`.
  - set status to `requires_action` when any function calls exist.

### Task 4: API Status Mapping

**Files:**
- Modify: `apps/api/src/server.mjs`

- [x] Map provider proxy chat result `status === "requires_action"` to HTTP `202`.

### Task 5: Docs

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `packages/provider-proxy/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] Document that provider-chat detects tool calls but does not execute them.
- [x] Document `requires_action`, redacted `tool_call_requests`, and required `tool_call_review` operator control.
- [x] Update the product plan so live tool-call execution governance is now represented as detection/approval metadata, with actual tool execution still a later slice.

### Task 6: Verification And Publish

- [x] Run focused syntax:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_provider_proxy_chat.mjs
node --check tests/tests_cli_provider_proxy_chat.mjs
node --check tests/tests_api_provider_proxy_chat.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
pnpm run test:providers
pnpm run validate:contracts
```

- [x] Run hygiene:

```bash
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

- [x] Run broader project test:

```bash
pnpm test
```

- [ ] Commit as `feat: add provider tool call governance`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete in a docs-only follow-up PR.

## Self-Review

- Spec coverage: The plan covers tool-call detection across all supported transports, redaction, operator controls, CLI/API behavior, docs, and verification.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan consistently uses `requires_action`, `tool_call_requests`, `argument_keys`, and `tool_call_review`.
