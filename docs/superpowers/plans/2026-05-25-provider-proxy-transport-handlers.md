# Provider Proxy Transport Handlers Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe transport-specific provider proxy handlers for Anthropic Messages and OpenAI Responses without weakening the existing no-shared-key, no-bypass, and no-credential-redirection boundaries.

**Architecture:** Keep `planProviderProxyRoute()` as the only provider selection entrypoint, then dispatch execution by `selected_provider_runtime.transport`. Add local no-key custom provider catalog entries for Anthropic-compatible and OpenAI Responses-compatible test endpoints so tests can verify request shapes without redirecting real provider credentials. Preserve the existing `divinity.provider_proxy_chat_result.v1` response envelope for CLI/API compatibility while adding transport-specific request fields and response normalization.

**Tech Stack:** Node ESM, built-in `http`/`https` clients, local `http` mock servers in tests, existing CLI/API JSON surfaces, repository tests under `tests/`.

---

### Task 1: Failing Transport Tests

**Files:**
- Modify: `packages/provider-runtime/providers.v1.json`
- Modify: `tests/tests_provider_runtime.mjs`
- Modify: `tests/tests_provider_proxy_chat.mjs`
- Modify: `tests/tests_cli_provider_proxy_chat.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`

- [x] **Step 1: Add runtime catalog expectations**

Extend provider runtime tests to expect two local no-key custom providers:
- `custom_anthropic_compatible` with `transport: "anthropic_messages"`.
- `custom_openai_responses` with `transport: "codex_responses"`.

Both must allow a local `base_url` without configured credentials, and both must keep secret values out of serialized runtime metadata.

- [x] **Step 2: Add package transport tests**

Extend `tests/tests_provider_proxy_chat.mjs` with local mock servers that assert:
- `custom_anthropic_compatible` posts to `/v1/messages`.
- Anthropic requests send `anthropic-version: 2023-06-01`, do not send `Authorization` for no-key local tests, use `max_tokens`, and move system messages to top-level `system`.
- Anthropic responses normalize `content`, `stop_reason`, and `usage`, and returned JSON omits prompts and configured secret values.
- `custom_openai_responses` posts to `/responses`.
- Responses requests use `input`, `instructions`, and `max_output_tokens`, and do not send deprecated `max_tokens` or chat-only `max_completion_tokens`.
- Responses results normalize assistant message content, status, output text, and usage while omitting prompts and secret values.
- Credentialed endpoint override blocking still prevents real `anthropic` and `openai_api` providers from being redirected to a local `base_url`.

- [x] **Step 3: Add CLI/API transport tests**

Extend:
- `tests/tests_cli_provider_proxy_chat.mjs` for `provider-chat --provider custom_openai_responses --base-url <mock>`.
- `tests/tests_api_provider_proxy_chat.mjs` for `POST /provider-proxy/chat` using `custom_anthropic_compatible`.

Assert completed status, correct transport, correct transport-specific request field, no prompt/secret echo, and local mock request count.

### Task 2: Implement Transport Dispatch

**Files:**
- Modify: `packages/provider-runtime/src/index.mjs`
- Modify: `packages/provider-runtime/providers.v1.json`
- Modify: `packages/provider-proxy/src/index.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] **Step 1: Add local custom provider entries**

Add `custom_anthropic_compatible` and `custom_openai_responses` entries to the provider catalog. Generalize local no-key provider detection so custom local providers using `http://localhost`, `http://127.0.0.1`, `http://0.0.0.0`, or IPv6 localhost can resolve with `auth.mode: "none"` only when the resolved URL is local.

- [x] **Step 2: Dispatch by transport**

In `executeProviderProxyChat()`, replace the single `chat_completions` check with transport dispatch:
- `chat_completions` -> `POST <base_url>/chat/completions`, `messages`, `max_completion_tokens`.
- `anthropic_messages` -> `POST <base_url>/v1/messages`, `messages`, `system`, `max_tokens`, `x-api-key`, `anthropic-version: 2023-06-01`.
- `codex_responses` -> `POST <base_url>/responses`, `input`, `instructions`, `max_output_tokens`, `Authorization: Bearer`.

Keep `429` fail-closed behavior, prompt budget checks, token budget checks, and credentialed endpoint override blocking before network I/O.

- [x] **Step 3: Normalize results safely**

Return the existing envelope plus transport-specific normalized fields:
- `status`, `provider_id`, `model`, `transport`, `upstream_status`, `response_id`, `message`, `finish_reason`, `usage`, and `output_text` when available.
- Do not return request bodies, prompt messages, system prompts, or credential values.

- [x] **Step 4: Accept output-token aliases**

Let CLI/API callers pass `--max-output-tokens` or JSON `max_output_tokens` as aliases for the same budgeted output-token limit while preserving existing `--max-completion-tokens` and `max_completion_tokens` compatibility.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`
- Modify: `packages/provider-proxy/README.md`

- [x] **Step 1: Document transport support**

Document that provider proxy chat execution now supports:
- OpenAI-compatible Chat Completions via `/chat/completions` and `max_completion_tokens`.
- Anthropic Messages via `/v1/messages`, `anthropic-version`, and `max_tokens`.
- OpenAI Responses via `/responses` and `max_output_tokens`.

Mention that streaming, managed rate-limit storage, hosted secret stores, and live tool-call execution remain future work.

- [x] **Step 2: Run verification**

Run:

```bash
node --check packages/provider-runtime/src/index.mjs
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_provider_runtime.mjs
node --check tests/tests_provider_proxy_chat.mjs
node --check tests/tests_cli_provider_proxy_chat.mjs
node --check tests/tests_api_provider_proxy_chat.mjs
node tests/tests_provider_runtime.mjs
node tests/tests_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:cli
pnpm run test:api
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

### Task 4: Publish

- [x] Commit as `feat: add provider proxy transport handlers`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete.

## Self-Review

- Spec coverage: This directly advances Phase 3 provider runtime configuration by replacing blocked catalog transports with explicit handlers while retaining the safe-provider policy.
- Deprecated API scan: OpenAI Responses uses `max_output_tokens`; Chat Completions keeps `max_completion_tokens`; Anthropic Messages uses its current `max_tokens` field.
- Safety boundary: Shared public keys, signup bypass, limit bypass, and credentialed endpoint redirection remain excluded.
