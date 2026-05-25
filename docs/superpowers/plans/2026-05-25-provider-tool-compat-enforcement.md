# Provider Tool Compatibility Enforcement Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block provider proxy chat execution before network I/O when the selected LLM provider is incompatible with the selected toolsets.

**Architecture:** Keep `packages/toolsets` as the compatibility authority by reusing `resolveToolsets()` inside `packages/provider-proxy`. CLI and API provider-chat inputs pass optional toolset selections into `executeProviderProxyChat()`, and chat results include the computed `toolset_resolution` so dashboards and operators can see exactly why a call was allowed or blocked.

**Tech Stack:** Node.js ESM, built-in `assert`, local HTTP mock servers, existing `packages/provider-runtime`, `packages/toolsets`, and `packages/provider-proxy`.

---

## File Structure

- Modify `packages/provider-proxy/src/index.mjs`: import `resolveToolsets()`, normalize optional toolset selections, add pre-network missing-capability enforcement, and attach `toolset_resolution` to provider chat results.
- Modify `apps/cli/src/index.mjs`: parse `provider-chat --toolset`, `--enable-toolset`, and `--disable-toolset` flags and pass them through to `executeProviderProxyChat()`.
- Modify `apps/api/src/server.mjs`: pass `toolsets`, `enabled_toolsets`, and `disabled_toolsets` from `POST /provider-proxy/chat` bodies into `executeProviderProxyChat()`.
- Modify tests in `tests/tests_provider_proxy_chat.mjs`, `tests/tests_cli_provider_proxy_chat.mjs`, and `tests/tests_api_provider_proxy_chat.mjs`: assert missing provider `tool_calls` capability blocks before network and includes operator-control metadata.
- Modify docs in `apps/cli/README.md`, `apps/api/README.md`, `docs/ARCHITECTURE.md`, and `docs/PRODUCT_PLAN.md`.

## Acceptance Criteria

- `executeProviderProxyChat({ candidates: ['cerebras'], env: { CEREBRAS_API_KEY: 'x' }, enabled_toolsets: ['web'], messages: [...] })` returns `status: "blocked"` without opening an upstream request.
- The blocked result contains `toolset_resolution.provider_capability_checks[0].status === "missing"` and an operator control with `control_id: "provider_capability_review"`.
- CLI `provider-chat --provider cerebras --toolset web --message ...` returns `ok: false` with the same blocked result metadata and no prompt or secret values.
- API `POST /provider-proxy/chat` with Cerebras plus `toolsets.enabled=["web"]` returns HTTP 400 with the same blocked result metadata and no prompt or secret values.
- Existing successful provider-chat paths continue to pass and include `toolset_resolution` without leaking prompts or secrets.

## Tasks

### Task 1: Package-Level Enforcement Test

**Files:**
- Modify: `tests/tests_provider_proxy_chat.mjs`

- [x] Add a failing test after the credentialed endpoint override checks:

```js
const incompatibleToolServer = await createMockChatServer(async ({ res }) => {
  res.statusCode = 500;
  res.end(JSON.stringify({ error: 'should not be called' }));
});

try {
  const blocked = await executeProviderProxyChat({
    candidates: ['cerebras'],
    env: { CEREBRAS_API_KEY: 'cerebras-secret' },
    requested_model: 'gpt-oss-120b',
    messages: [{ role: 'user', content: secretPrompt }],
    enabled_toolsets: ['web']
  });

  assert.equal(blocked.status, 'blocked');
  assert.match(blocked.error, /provider missing required tool capability/);
  assert.equal(blocked.toolset_resolution.provider_capability_checks[0].status, 'missing');
  assert.equal(blocked.toolset_resolution.operator_controls[0].control_id, 'provider_capability_review');
  assert.equal(incompatibleToolServer.requests.length, 0);
  assert.equal(JSON.stringify(blocked).includes(secretPrompt), false);
  assert.equal(JSON.stringify(blocked).includes('cerebras-secret'), false);
} finally {
  await incompatibleToolServer.close();
}
```

- [x] Run: `node tests/tests_provider_proxy_chat.mjs`.
Expected: FAIL because `executeProviderProxyChat()` does not yet accept or enforce selected toolsets.

### Task 2: CLI/API Enforcement Tests

**Files:**
- Modify: `tests/tests_cli_provider_proxy_chat.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`

- [x] Add a CLI assertion:

```js
const incompatible = await runCli([
  'provider-chat',
  '--provider', 'cerebras',
  '--toolset', 'web',
  '--message', secretPrompt
], {
  CEREBRAS_API_KEY: 'cerebras-secret'
});

assert.equal(incompatible.ok, false);
assert.equal(incompatible.result.status, 'blocked');
assert.match(incompatible.result.error, /provider missing required tool capability/);
assert.equal(incompatible.result.toolset_resolution.provider_capability_checks[0].status, 'missing');
assert.equal(incompatible.result.toolset_resolution.operator_controls[0].control_id, 'provider_capability_review');
assert.equal(JSON.stringify(incompatible).includes(secretPrompt), false);
assert.equal(JSON.stringify(incompatible).includes('cerebras-secret'), false);
```

- [x] Add an API assertion:

```js
const { response: incompatibleResponse, body: incompatibleBody } = await requestJson(`${baseUrl}/provider-proxy/chat`, {
  method: 'POST',
  body: JSON.stringify({
    candidates: ['cerebras'],
    toolsets: { enabled: ['web'] },
    messages: [{ role: 'user', content: secretPrompt }]
  }),
  headers: { 'x-test': 'provider-tool-compat' }
});

assert.equal(incompatibleResponse.status, 400);
assert.equal(incompatibleBody.result.status, 'blocked');
assert.match(incompatibleBody.result.error, /provider missing required tool capability/);
assert.equal(incompatibleBody.result.toolset_resolution.provider_capability_checks[0].status, 'missing');
assert.equal(incompatibleBody.result.toolset_resolution.operator_controls[0].control_id, 'provider_capability_review');
assert.equal(JSON.stringify(incompatibleBody).includes(secretPrompt), false);
```

- [x] Run: `node tests/tests_cli_provider_proxy_chat.mjs` and `node tests/tests_api_provider_proxy_chat.mjs`.
Expected: FAIL because CLI/API do not pass toolset selections into provider chat execution yet.

### Task 3: Implement Provider Proxy Enforcement

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`

- [x] Import the resolver:

```js
import { resolveToolsets } from '../../toolsets/src/index.mjs';
```

- [x] Add a helper that accepts either `toolsets: { enabled, disabled }` or direct `enabled_toolsets`/`disabled_toolsets` options and returns normalized resolver input.

- [x] After route selection and credentialed endpoint override checks, compute:

```js
const toolsetResolution = resolveToolsets({
  enabled_toolsets: selection.enabled_toolsets,
  disabled_toolsets: selection.disabled_toolsets,
  provider_runtime: runtime
});
```

- [x] If any `provider_capability_checks` entry has `status: "missing"`, return a blocked chat result before budget checks or HTTP requests. The error string must include `provider missing required tool capability`.

- [x] Include `toolset_resolution` on blocked, limited, failed, and completed result payloads.

### Task 4: Wire CLI And API Inputs

**Files:**
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] Add CLI flags:
  - `--toolset <id>` and `--enable-toolset <id>` append to `toolsets.enabled`.
  - `--disable-toolset <id>` appends to `toolsets.disabled`.

- [x] Pass the optional `toolsets` object through to `executeProviderProxyChat()`.

- [x] Pass API body fields `toolsets`, `enabled_toolsets`, and `disabled_toolsets` through to `executeProviderProxyChat()`.

### Task 5: Docs And Product Plan

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] Document that provider-chat checks selected toolsets before upstream calls and blocks missing provider `tool_calls` capability with operator-control metadata.

- [x] Update `docs/PRODUCT_PLAN.md` so Toolset Governance records execution-time provider/tool compatibility enforcement as bootstrap status, leaving dashboard operator controls as the next slice.

### Task 6: Verification And Publish

**Files:**
- Modify: this plan file after publish completes.

- [x] Run focused syntax checks:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
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
pnpm run test:toolsets
pnpm run validate:contracts
```

- [x] Run hygiene checks:

```bash
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

- [ ] Commit as `feat: enforce provider tool compatibility`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete in a docs-only follow-up PR.

## Self-Review

- Spec coverage: The plan covers execution-time provider/tool compatibility enforcement, CLI/API surfaces, docs, and verification.
- Placeholder scan: No TBD/TODO/fill-in placeholders remain.
- Type consistency: The plan consistently uses `toolsets.enabled`, `toolsets.disabled`, `enabled_toolsets`, `disabled_toolsets`, and `toolset_resolution`.
