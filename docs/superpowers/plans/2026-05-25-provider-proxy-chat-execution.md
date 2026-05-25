# Provider Proxy Chat Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe first live provider-proxy execution path for OpenAI-compatible chat-completions transports, verified only through local mock servers.

**Architecture:** Reuse `packages/provider-proxy` route planning as the only entrypoint for selecting providers. Add a chat execution helper that supports `chat_completions` providers, redacts prompts and credential values from returned metadata, enforces simple request budgets before network I/O, and returns explicit `blocked`, `limited`, `failed`, or `completed` statuses. Other transports remain blocked until dedicated handlers are implemented.

**Tech Stack:** Node ESM, built-in `http`/`https` clients, local `http` mock servers in tests, existing CLI/API JSON surfaces, repository tests under `tests/`.

---

### Task 1: Failing Chat Execution Tests

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `package.json`
- Create: `tests/tests_provider_proxy_chat.mjs`
- Create: `tests/tests_cli_provider_proxy_chat.mjs`
- Create: `tests/tests_api_provider_proxy_chat.mjs`

- [x] **Step 1: Write package test**

Create `tests/tests_provider_proxy_chat.mjs` with local mock HTTP servers that assert:
- `executeProviderProxyChat({ candidates: [{ provider_id: "custom_openai_compatible", base_url }], messages: [{ role: "user", content: "secret prompt" }] })` posts to `/chat/completions`.
- The mock receives `model`, `messages`, and `max_completion_tokens`, and returns an OpenAI-compatible `{ choices, usage }` response.
- The returned result has `format: "divinity.provider_proxy_chat_result.v1"`, `status: "completed"`, provider id `custom_openai_compatible`, assistant content from the mock, and usage totals.
- `JSON.stringify(result)` does not include the prompt text or any configured API key value.
- A mock `429` response returns `status: "limited"`, `upstream_status: 429`, and a retry-after value instead of trying another provider.
- An authorized non-`chat_completions` runtime such as `anthropic` returns `status: "blocked"` with an unsupported transport error.
- A request budget with too many prompt characters returns `status: "blocked"` before hitting the mock server.

- [x] **Step 2: Write CLI/API tests**

Create:
- `tests/tests_cli_provider_proxy_chat.mjs` for `divinity provider-chat --provider custom_openai_compatible --base-url <mock> --message "secret prompt" --max-completion-tokens 32`.
- `tests/tests_api_provider_proxy_chat.mjs` for `POST /provider-proxy/chat`.

Both tests must use local mock servers, assert completed status, assert no prompt or secret value in the returned JSON, and assert unsupported/budget failures are represented as policy statuses instead of crashes.

- [x] **Step 3: Register scripts**

Add `tests/tests_provider_proxy_chat.mjs`, `tests/tests_cli_provider_proxy_chat.mjs`, and `tests/tests_api_provider_proxy_chat.mjs` to `test`, `test:providers`, `test:cli`, and `test:api`.

- [x] **Step 4: Run failing tests**

Run:

```bash
node tests/tests_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
```

Expected: FAIL because `executeProviderProxyChat`, CLI `provider-chat`, and API `POST /provider-proxy/chat` do not exist yet.

### Task 2: Implement Chat Execution

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `packages/provider-proxy/README.md`

- [x] **Step 1: Implement package helper**

Export `executeProviderProxyChat({ candidates, env, limit_state, rotation_intent, requested_model, messages, max_completion_tokens, request_budget, temperature, signal })`.

Return:
- `format: "divinity.provider_proxy_chat_result.v1"`
- `status: "completed" | "blocked" | "limited" | "failed"`
- `route` from `planProviderProxyRoute`
- `provider_id`, `model`, `transport`, `upstream_status`, `usage`, `message`, and `finish_reason` when available
- `error` for blocked, limited, and failed outcomes

Rules:
- Call `planProviderProxyRoute()` first and return blocked when route planning is blocked.
- Only `chat_completions` transport can execute in this slice.
- Use `POST ${base_url}/chat/completions` with JSON body `{ model, messages, max_completion_tokens, temperature }`.
- Use `Authorization: Bearer <credential>` only when the selected runtime requires configured credentials.
- Do not include prompt messages, request bodies, or credential values in returned result metadata.
- Block credentialed provider `base_url` overrides during execution so operator-owned secrets cannot be redirected to caller-supplied URLs.
- If upstream returns `429`, return `status: "limited"` and never retry another provider automatically.

- [x] **Step 2: Implement CLI**

Add `provider-chat` with:
- `--provider` / `--provider-id`
- `--base-url`
- `--message`
- `--model`
- `--max-completion-tokens`
- `--max-prompt-chars`

The command prints `{ ok: result.status === "completed", command: "provider-chat", result }` and keeps blocked/limited statuses JSON-visible.

- [x] **Step 3: Implement API route**

Add `POST /provider-proxy/chat` accepting:

```json
{
  "candidates": [{ "provider_id": "custom_openai_compatible", "base_url": "http://127.0.0.1:12345" }],
  "messages": [{ "role": "user", "content": "hello" }],
  "model": "mock-model",
  "max_completion_tokens": 32,
  "request_budget": { "max_prompt_chars": 5000, "max_completion_tokens": 512 }
}
```

Return `{ result }` with HTTP `200` for completed, `429` for limited, `400` for blocked, and `502` for failed.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node tests/tests_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
```

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`

- [x] **Step 1: Document chat execution boundary**

Document that only OpenAI-compatible `chat_completions` execution is implemented, tests use local mock servers, live credentials remain operator-owned environment values, unsupported transports fail closed, and the implementation uses `max_completion_tokens` rather than deprecated `max_tokens`.

- [x] **Step 2: Run verification**

Run:

```bash
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

- [ ] Commit as `feat: add provider proxy chat execution`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused post-merge verification.

## Self-Review

- Spec coverage: This advances the production-readiness objective by adding the first safe provider invocation path behind route policy, while preserving the no-shared-key/no-bypass boundary.
- Scope boundary: Streaming, Anthropic Messages, OpenAI Responses, hosted secrets, managed rate-limit stores, and automatic retry/failover after live `429` are intentionally future slices.
- Deprecated API scan: The request shape uses `max_completion_tokens`; tests should fail if `max_tokens` is introduced in the new proxy execution path.
