# Provider Streaming Normalization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add controlled provider streaming support that normalizes upstream SSE events into redacted provider stream metadata across package, CLI, and API surfaces.

**Architecture:** Reuse the existing provider proxy route, credential, toolset, budget, and limit-ledger checks before opening an upstream stream. Add a streaming request path that sets `stream: true`, parses server-sent events, emits normalized text/tool/error events through an optional callback, and returns a final `divinity.provider_proxy_stream_result.v1` summary. API `POST /provider-proxy/chat/stream` streams those normalized events back to clients as SSE; CLI `provider-chat --stream` prints the final redacted summary.

**Tech Stack:** Node.js ESM, built-in `http`/`https`, SSE parsing, local mock HTTP servers, existing provider runtime/proxy/CLI/API packages, repository tests under `tests/`.

---

## Current Shape

- `executeProviderProxyChat()` supports non-streaming Chat Completions, Anthropic Messages, and OpenAI Responses transports.
- Provider-returned tool calls are already governance events, not executions.
- API has an SSE helper for run streams.
- Product docs name streaming as the next provider runtime production slice.
- Official provider docs indicate:
  - Chat Completions streams use `stream: true` and SSE chunks with delta objects.
  - OpenAI Responses streams emit events such as `response.output_text.delta`, `response.output_item.added`, and `response.function_call_arguments.delta`.
  - Anthropic Messages streams use `stream: true` and named SSE events such as `message_start`, `content_block_delta`, `message_delta`, and `message_stop`.

## File Structure

- Modify `packages/provider-proxy/src/index.mjs`: add `executeProviderProxyChatStream()`, SSE request parsing, stream request body support, normalized stream event helpers, and shared preflight preparation with existing chat execution.
- Modify `apps/cli/src/index.mjs`: add `provider-chat --stream` option and call the streaming helper.
- Modify `apps/api/src/server.mjs`: add `POST /provider-proxy/chat/stream` that forwards normalized provider stream events as SSE and finishes with a final summary event.
- Modify `tests/tests_provider_proxy_stream.mjs`: package-level tests with local mock SSE servers for Chat Completions, Anthropic Messages, OpenAI Responses, redacted tool calls, and upstream `429`.
- Modify `tests/tests_cli_provider_proxy_chat.mjs`: CLI `provider-chat --stream` smoke against a local mock SSE server.
- Modify `tests/tests_api_provider_proxy_chat.mjs`: API stream endpoint smoke that verifies `text/event-stream` and normalized events.
- Modify `package.json`: include package stream test in `test` and `test:providers`.
- Modify docs in `packages/provider-proxy/README.md`, `apps/cli/README.md`, `apps/api/README.md`, `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, and `docs/PRODUCT_PLAN.md`.

## Acceptance Criteria

- Streaming execution uses the same route, credential, endpoint override, toolset capability, prompt budget, output budget, and limit-ledger checks as non-streaming chat execution.
- Streaming request bodies set `stream: true` for all supported transports.
- Upstream SSE parsing supports `event:` and `data:` lines, ignores comments and `[DONE]`, and handles unknown event types without failing.
- Text deltas are emitted as normalized events and accumulated into `output_text`.
- Tool-call streams are redacted: raw argument deltas are not returned, but `tool_call_requests` and `tool_call_review` metadata are produced when enough provider metadata exists.
- Anthropic thinking deltas and signatures are not returned as chain-of-thought content; they are counted as redacted events.
- Upstream `429` still returns `status: "limited"` and records a retry window when a ledger is supplied.
- API `/provider-proxy/chat/stream` returns SSE with normalized event payloads, not raw provider request bodies, credentials, or raw tool arguments.
- Tests use local mock servers only.

## Tasks

### Task 1: Package Red Tests

**Files:**
- Create: `tests/tests_provider_proxy_stream.mjs`
- Modify: `package.json`

- [x] Add a local SSE mock helper that records request body and headers, responds with `content-type: text/event-stream`, and emits provider-shaped events.
- [x] Add Chat Completions text-stream test:

```js
const result = await executeProviderProxyChatStream({
  candidates: [{ provider_id: 'custom_openai_compatible', base_url: server.base_url }],
  requested_model: 'mock-model',
  messages: [{ role: 'user', content: 'secret prompt' }],
  max_completion_tokens: 16
});

assert.equal(server.requests[0].body.stream, true);
assert.equal(result.format, 'divinity.provider_proxy_stream_result.v1');
assert.equal(result.status, 'completed');
assert.equal(result.output_text, 'Hello stream');
assert.equal(result.stream_events.filter(event => event.type === 'text_delta').length, 2);
assert.equal(JSON.stringify(result).includes('secret prompt'), false);
```

- [x] Add Anthropic text-stream test with `content_block_delta` `text_delta`.
- [x] Add OpenAI Responses text-stream test with `response.output_text.delta`.
- [x] Add tool-call redaction tests:
  - Chat Completions `delta.tool_calls[].function.arguments` must not appear in the result.
  - Responses `response.function_call_arguments.delta` must not appear in the result.
  - Anthropic `input_json_delta.partial_json` must not appear in the result.
  - Each should return `status: "requires_action"` and a `tool_call_review` control when the stream declares the tool name/id.
- [x] Add an Anthropic `thinking_delta` test that returns a `redacted_reasoning_delta` event count without exposing thinking text.
- [x] Add an upstream `429` test that returns `status: "limited"` and records the limit ledger.
- [x] Register `tests/tests_provider_proxy_stream.mjs` in `test` and `test:providers`.
- [x] Run:

```bash
node tests/tests_provider_proxy_stream.mjs
```

Expected: FAIL because `executeProviderProxyChatStream()` is not exported yet.

### Task 2: Implement Package Stream Helper

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`

- [x] Refactor shared chat preflight into `prepareProviderProxyChat()` that returns either `{ ok: false, result }` or `{ ok: true, route, runtime, toolsetResolution, credential, request, requestedOutputTokens }`.
- [x] Extend `buildTransportRequest({ stream = false })` so each supported transport includes `stream: true` when requested.
- [x] Add `postSse(url, body, headers, signal, onChunk)` that posts JSON, parses SSE records, and invokes `onChunk({ event, data, payload })`.
- [x] Add `normalizeStreamPayload({ runtime, event, payload, state })`:
  - Chat Completions: map `choices[].delta.content` to `{ type: "text_delta", text }`; track `delta.tool_calls` by index/id/name and count/redact arguments.
  - Anthropic: map `content_block_start` tool metadata, `content_block_delta` text, input JSON, and thinking/signature deltas; redact input/thinking/signature values.
  - Responses: map `response.output_text.delta`, `response.output_item.added` function calls, and `response.function_call_arguments.delta`; redact argument deltas.
- [x] Add `executeProviderProxyChatStream()` that:
  - runs shared preflight;
  - returns blocked/limited/failed results using `format: "divinity.provider_proxy_stream_result.v1"`;
  - calls optional `on_event(event)` for normalized events;
  - returns final output text, stream events, event counts, usage when available, and redacted tool-call governance.
- [x] Reuse existing `toolCallRequest()` and `toolCallReviewControl()`.

### Task 3: CLI/API Red Tests And Wiring

**Files:**
- Modify: `tests/tests_cli_provider_proxy_chat.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] Add CLI test for `provider-chat --stream --provider custom_openai_compatible --base-url <mock> --message "secret prompt" --model mock-model --max-completion-tokens 16`.
- [x] Add API test for `POST /provider-proxy/chat/stream` that asserts:
  - HTTP status `200`;
  - content type begins `text/event-stream`;
  - at least one SSE event named `provider_stream_event`;
  - final event named `provider_stream_completed`;
  - response text does not include prompt or credential values.
- [x] Run the new CLI/API tests and observe the expected failures before wiring.
- [x] CLI: parse `--stream` in `parseProviderChatArgs()` and call `executeProviderProxyChatStream()` when set.
- [x] API: add `POST /provider-proxy/chat/stream`; set SSE headers; call `executeProviderProxyChatStream({ on_event })`; write `provider_stream_event` and final `provider_stream_completed`/`provider_stream_failed` events.

### Task 4: Docs

**Files:**
- Modify: `packages/provider-proxy/README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] Document `executeProviderProxyChatStream()`, CLI `provider-chat --stream`, and API `POST /provider-proxy/chat/stream`.
- [x] State that normalized streaming exposes text deltas and redacted audit/tool metadata, not raw prompts, credentials, request bodies, tool arguments, or thinking/signature content.
- [x] Update product docs so streaming moves from “next production slice” to bootstrap status, leaving hosted secrets, fuller request/token budget ledgers, and approved tool execution loops as future slices.

### Task 5: Verification And Publish

- [x] Run syntax checks:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_provider_proxy_stream.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_proxy_stream.mjs
node tests/tests_cli_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
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

- [ ] Commit as `feat: add provider stream normalization`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused provider verification.

## Self-Review

- Spec coverage: This advances production readiness by adding streaming to the provider proxy while preserving route policy, redaction, tool governance, and limit handling.
- Scope boundary: It does not implement hosted secrets, automatic tool execution loops, provider quota bypass, or full request/token budget persistence.
- Placeholder scan: No placeholder tasks remain.
