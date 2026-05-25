# Provider Limit Ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist provider rate-limit windows from upstream `429` responses and feed them back into provider route planning without bypassing limits.

**Architecture:** Add a small provider limit ledger inside `packages/provider-proxy` that stores provider ids and retry windows only, never prompts or credentials. `planProviderProxyRoute()` merges caller-supplied `limit_state` with active ledger entries; `executeProviderProxyChat()` records upstream `429` retry windows. API uses an in-process ledger by default and an optional file-backed ledger via `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`; CLI uses the same file-backed ledger only when that env var is set so normal commands do not create repo-root state.

**Tech Stack:** Node.js ESM, built-in `fs`, local mock HTTP servers, existing provider proxy package, CLI/API provider proxy surfaces.

---

## Current Shape

- `planProviderProxyRoute({ limit_state })` already skips limited providers when the caller provides manual state.
- `executeProviderProxyChat()` returns `status: "limited"` and `retry_after_seconds` on upstream `429`, but it does not persist that state for later route planning.
- API and CLI pass only request-body or command-line limit state today.
- The repo must stay clean: no default `.divinity` state files in the project root.

## File Structure

- Create `packages/provider-proxy/src/limit-ledger.mjs`: provider limit ledger creation, active-state calculation, and optional JSON file persistence.
- Modify `packages/provider-proxy/src/index.mjs`: export ledger helpers, merge ledger state into route planning, and record `429` retry windows.
- Modify `apps/api/src/server.mjs`: create one API-scoped provider limit ledger and pass it to route/chat calls.
- Modify `apps/cli/src/index.mjs`: pass a file-backed provider limit ledger only when `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH` is configured.
- Modify `tests/tests_provider_proxy.mjs`: cover ledger-driven route failover and expired entries.
- Modify `tests/tests_provider_proxy_chat.mjs`: cover recording a `429` into the ledger and skipping the provider on the next call.
- Modify `tests/tests_cli_provider_proxy.mjs`: cover CLI route planning from an env-configured ledger file.
- Modify `tests/tests_api_provider_proxy_chat.mjs`: cover API server memory ledger recording a `429` and skipping the limited provider on a later request.
- Modify docs in `apps/cli/README.md`, `apps/api/README.md`, `packages/provider-proxy/README.md`, `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, and `docs/PRODUCT_PLAN.md`.

## Acceptance Criteria

- A provider ledger entry contains only provider id, observed time, `limited_until`, and retry seconds; serialized ledger state does not include prompts, request bodies, API keys, or provider response bodies.
- Route planning treats active ledger entries the same as manual `limit_state` and skips limited providers.
- Expired ledger entries do not block routing.
- Upstream `429` chat responses record active ledger entries when a ledger is supplied.
- API `POST /provider-proxy/chat` records a `429` and later routes away from that provider during the same server process.
- CLI `provider-route` can read active ledger state from `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`.
- No default repo-root state file is created.
- Existing provider route/chat behavior still passes.

## Tasks

### Task 1: Package Red Tests

**Files:**
- Modify: `tests/tests_provider_proxy.mjs`
- Modify: `tests/tests_provider_proxy_chat.mjs`

- [x] Add route-planning assertions for a ledger active window:

```js
const now = new Date('2026-05-25T10:00:00.000Z');
const ledger = createProviderLimitLedger({ now: () => now });
ledger.recordLimit({
  provider_id: 'openrouter',
  retry_after_seconds: 60,
  observed_at: now.toISOString()
});

const ledgerRotated = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  },
  limit_ledger: ledger
});

assert.equal(ledgerRotated.status, 'ready');
assert.equal(ledgerRotated.selected_provider_runtime.provider_id, 'groq');
assert.equal(ledgerRotated.candidate_results[0].status, 'limited');
assert.equal(ledgerRotated.candidate_results[0].retry_after_seconds, 60);
assert.equal(JSON.stringify(ledgerRotated).includes('openrouter-secret'), false);
```

- [x] Add expired-ledger assertions:

```js
const expiredLedger = createProviderLimitLedger({
  initial_state: {
    providers: {
      openrouter: {
        provider_id: 'openrouter',
        observed_at: '2026-05-25T09:00:00.000Z',
        limited_until: '2026-05-25T09:01:00.000Z',
        retry_after_seconds: 60,
        source: 'upstream_429'
      }
    }
  },
  now: () => new Date('2026-05-25T10:00:00.000Z')
});

const expiredReady = planProviderProxyRoute({
  candidates: ['openrouter', 'groq'],
  env: {
    OPENROUTER_API_KEY: 'openrouter-secret',
    GROQ_API_KEY: 'groq-secret'
  },
  limit_ledger: expiredLedger
});

assert.equal(expiredReady.selected_provider_runtime.provider_id, 'openrouter');
```

- [x] Add chat assertions that record a `429` and then skip the limited provider:

```js
const ledger = createProviderLimitLedger({ now: () => new Date('2026-05-25T10:00:00.000Z') });
const limited = await executeProviderProxyChat({
  candidates: [{ provider_id: 'custom_openai_compatible', base_url: limitedServer.base_url }],
  env: { CUSTOM_LLM_API_KEY: apiSecret },
  requested_model: 'mock-model',
  messages: [{ role: 'user', content: secretPrompt }],
  max_completion_tokens: 32,
  limit_ledger: ledger
});
assert.equal(limited.status, 'limited');
assert.equal(limited.limit_ledger_record.provider_id, 'custom_openai_compatible');

const rerouted = await executeProviderProxyChat({
  candidates: [
    { provider_id: 'custom_openai_compatible', base_url: limitedServer.base_url },
    { provider_id: 'custom_anthropic_compatible', base_url: backupServer.base_url }
  ],
  env: { CUSTOM_LLM_API_KEY: apiSecret, CUSTOM_ANTHROPIC_API_KEY: apiSecret },
  requested_model: 'claude-mock',
  messages: [{ role: 'user', content: secretPrompt }],
  max_output_tokens: 32,
  limit_ledger: ledger
});
assert.equal(rerouted.status, 'completed');
assert.equal(rerouted.provider_id, 'custom_anthropic_compatible');
assert.equal(limitedServer.requests.length, 1);
```

- [x] Run:

```bash
node tests/tests_provider_proxy.mjs
node tests/tests_provider_proxy_chat.mjs
```

Expected: FAIL because `createProviderLimitLedger` and `limit_ledger` support do not exist yet.

### Task 2: CLI/API Red Tests

**Files:**
- Modify: `tests/tests_cli_provider_proxy.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`

- [x] Add CLI route test that writes a temporary ledger JSON file and invokes `provider-route` with `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`:

```js
await writeFile(ledgerPath, JSON.stringify({
  format: 'divinity.provider_limit_ledger.v1',
  providers: {
    openrouter: {
      provider_id: 'openrouter',
      observed_at: '2099-01-01T00:00:00.000Z',
      limited_until: '2099-01-01T00:01:00.000Z',
      retry_after_seconds: 60,
      source: 'upstream_429'
    }
  }
}));

const ledgerRoute = await runCli(['provider-route', '--candidate', 'openrouter', '--candidate', 'groq'], {
  OPENROUTER_API_KEY: 'openrouter-secret',
  GROQ_API_KEY: 'groq-secret',
  DIVINITY_PROVIDER_LIMIT_LEDGER_PATH: ledgerPath
});

assert.equal(ledgerRoute.route.selected_provider_runtime.provider_id, 'groq');
assert.equal(ledgerRoute.route.candidate_results[0].status, 'limited');
```

- [x] Add API chat test that performs one mock `429` call, then a second request with the same API server process and two candidates; assert the second request uses the backup provider and does not call the first server again.

- [x] Run:

```bash
node tests/tests_cli_provider_proxy.mjs
node tests/tests_api_provider_proxy_chat.mjs
```

Expected: FAIL because CLI/API do not pass a provider limit ledger yet.

### Task 3: Implement Provider Limit Ledger

**Files:**
- Create: `packages/provider-proxy/src/limit-ledger.mjs`
- Modify: `packages/provider-proxy/src/index.mjs`

- [x] Add `createProviderLimitLedger({ initial_state, file_path, now })`.
- [x] Add `activeLimitState()` to return `{ [providerId]: { limit_reached: true, retry_after_seconds, limited_until, source: "managed_ledger" } }` for unexpired entries only.
- [x] Add `recordLimit({ provider_id, retry_after_seconds, observed_at })` to persist `limited_until` from `observed_at + retry_after_seconds`.
- [x] Add `createConfiguredProviderLimitLedger(env, { memoryFallback })`; return `null` when no env path exists and `memoryFallback` is false.
- [x] Export the ledger helpers from `packages/provider-proxy/src/index.mjs`.
- [x] Merge `limit_ledger.activeLimitState()` into `planProviderProxyRoute()` with caller `limit_state`, preferring the longest remaining retry window.
- [x] Record upstream `429` retry windows in `executeProviderProxyChat()` when `limit_ledger` is supplied and include a redacted `limit_ledger_record` in the result.

### Task 4: Wire CLI/API

**Files:**
- Modify: `apps/api/src/server.mjs`
- Modify: `apps/cli/src/index.mjs`

- [x] API: create one `providerLimitLedger` with memory fallback and optional `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`, then pass it to `/provider-proxy/route` and `/provider-proxy/chat`.
- [x] CLI: create a configured ledger only when `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH` is set, then pass it to `provider-route` and `provider-chat`.

### Task 5: Docs

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `packages/provider-proxy/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] Document `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`, in-process API fallback, no prompt/secret storage, and no default repo-root state file.
- [x] Update product plan status so managed provider limit windows move from future to bootstrap status; leave streaming, hosted secrets, and approved live tool execution loops as future slices.

### Task 6: Verification And Publish

- [x] Run focused syntax:

```bash
node --check packages/provider-proxy/src/limit-ledger.mjs
node --check packages/provider-proxy/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
node --check tests/tests_provider_proxy.mjs
node --check tests/tests_provider_proxy_chat.mjs
node --check tests/tests_cli_provider_proxy.mjs
node --check tests/tests_api_provider_proxy_chat.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_proxy.mjs
node tests/tests_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy.mjs
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
test ! -e .divinity-provider-limits.json
```

- [x] Run broader project test:

```bash
pnpm test
```

- [x] Commit as `feat: add provider limit ledger`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete in a docs-only follow-up PR.

## Self-Review

- Spec coverage: This plan covers the next managed rate-limit storage slice, routing integration, 429 recording, API/CLI surfaces, no-secret storage, no root state pollution, docs, and verification.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan consistently uses `limit_ledger`, `DIVINITY_PROVIDER_LIMIT_LEDGER_PATH`, `divinity.provider_limit_ledger.v1`, `activeLimitState()`, and `limit_ledger_record`.
