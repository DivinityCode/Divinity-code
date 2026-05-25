# Provider Proxy Routing Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add safe provider proxy route planning that selects only authorized configured providers and blocks public shared-key or quota-bypass routing.

**Architecture:** This slice does not proxy live LLM traffic. It introduces a pure routing policy package plus CLI/API route-plan surfaces so future proxy execution can reuse the same compliance checks: configured credentials, trusted catalog provider ids, per-provider limit state, and rotation intent.

**Tech Stack:** Node ESM, existing provider-runtime package, CLI/API JSON surfaces, repository tests under `tests/`.

---

### Task 1: Failing Proxy Policy Tests

**Files:**
- Create: `packages/provider-proxy/src/index.mjs`
- Create: `packages/provider-proxy/README.md`
- Create: `tests/tests_provider_proxy.mjs`
- Create: `tests/tests_cli_provider_proxy.mjs`
- Create: `tests/tests_api_provider_proxy.mjs`
- Modify: `package.json`

- [x] **Step 1: Write package test**

Create `tests/tests_provider_proxy.mjs` asserting:
- `planProviderProxyRoute({ env: { OPENROUTER_API_KEY: "secret", GROQ_API_KEY: "secret" }, candidates: ["openrouter", "groq"] })` selects `openrouter`.
- returned JSON does not include secret values.
- when OpenRouter is exhausted in `limit_state`, route selection rotates to `groq` with reason `provider_limit_reached`.
- `rotation_intent: "bypass_limits"` returns blocked with a policy error.
- candidate source `public_shared_key` returns blocked.
- missing credentials returns blocked.

- [x] **Step 2: Write CLI/API tests**

Create:
- `tests/tests_cli_provider_proxy.mjs` for `divinity provider-route --candidate openrouter --candidate groq`.
- `tests/tests_api_provider_proxy.mjs` for `POST /provider-proxy/route`.

Assert both surfaces return `format: "divinity.provider_proxy_route.v1"` and no secret values.

- [x] **Step 3: Register scripts**

Add `tests/tests_provider_proxy.mjs`, `tests/tests_cli_provider_proxy.mjs`, and `tests/tests_api_provider_proxy.mjs` to `test`, `test:providers`, `test:cli`, and `test:api`.

- [x] **Step 4: Run failing tests**

Run:

```bash
node tests/tests_provider_proxy.mjs
node tests/tests_cli_provider_proxy.mjs
node tests/tests_api_provider_proxy.mjs
```

Expected: FAIL because the package and surfaces do not exist yet.

### Task 2: Implement Proxy Policy

**Files:**
- Create: `packages/provider-proxy/src/index.mjs`
- Create: `packages/provider-proxy/README.md`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] **Step 1: Implement package**

Export `planProviderProxyRoute({ candidates, env, limit_state, rotation_intent, requested_model })`.

The returned object must include:
- `format: "divinity.provider_proxy_route.v1"`
- `status: "ready"` or `"blocked"`
- `selected_provider_runtime` when ready
- `candidate_results` with provider ids, credential readiness, and limit state
- `policy` with `allow_public_shared_keys: false`, `allow_limit_bypass: false`, and `rotation_mode: "authorized_failover"`

- [x] **Step 2: Implement CLI**

Add `provider-route` command with:
- `--candidate <provider_id>` repeatable
- `--rotation-intent <reliability|cost|bypass_limits>`
- `--limit-reached <provider_id>` repeatable
- `--model <model>`

- [x] **Step 3: Implement API route**

Add `POST /provider-proxy/route` accepting the same JSON shape. It must return route-plan metadata only and never call a provider.

- [x] **Step 4: Verify focused tests pass**

Run:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node tests/tests_provider_proxy.mjs
node tests/tests_cli_provider_proxy.mjs
node tests/tests_api_provider_proxy.mjs
```

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`

- [x] **Step 1: Document proxy policy**

Document that route planning is ready, live proxying is still future work, and rotation is allowed only across authorized configured providers for reliability/cost policy.

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

- [x] Commit as `feat: add provider proxy routing policy`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused post-merge verification.

## Self-Review

- Spec coverage: This implements the safe subset of the proxy/rotation request: authorized provider route planning, no live calls, no shared public key use, no limit bypass.
- Scope boundary: Live LLM proxy execution, hosted secrets, signup bypass, and quota evasion remain explicitly out of scope.
- Placeholder scan: No placeholder tasks remain.
