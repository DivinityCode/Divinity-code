# Provider Catalog Overlays Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let operators add reviewed free-tier or local LLM providers through a controlled catalog overlay without hardcoding provider endpoints in source or accepting shared public keys.

**Architecture:** Extend `packages/provider-runtime` so the built-in provider catalog can be merged with a JSON overlay from `DIVINITY_PROVIDER_CATALOG_PATH`. The loader validates every provider entry, rejects public shared-key and bypass-oriented sources, redacts credentials, and keeps provider execution behind the existing provider proxy route policy and limit ledger.

**Tech Stack:** Node.js ESM, JSON provider manifests, existing provider runtime/proxy packages, CLI/API provider discovery, repository tests under `tests/`.

---

## Current Shape

- `packages/provider-runtime/providers.v1.json` holds built-in provider metadata for OpenRouter, Anthropic, OpenAI API, Gemini, Groq, Cerebras, Mistral, GitHub Models, and local custom endpoints.
- The provider proxy already blocks public shared-key candidate sources and explicit limit-bypass rotation intent.
- `docs/FREE_LLM_PROVIDER_RESEARCH.md` already marks public shared-key repos as a negative control, not an ingestion source.
- The missing piece is an operator-controlled overlay path so lower-cost testing providers do not require editing package source or copying public keys.

## File Structure

- Modify `packages/provider-runtime/src/index.mjs`: add overlay loading, catalog merge, source validation, and env-aware public/provider lookup helpers.
- Modify `tests/tests_provider_runtime.mjs`: cover overlay provider discovery, override behavior, malformed overlay rejection, and public shared-key source rejection.
- Modify `packages/provider-runtime/README.md`: document `DIVINITY_PROVIDER_CATALOG_PATH`, accepted sources, and rejected shared-key/bypass inputs.
- Modify `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_PLAN.md`, `apps/cli/README.md`, and `apps/api/README.md`: document safe overlay use and that rotation is failover only.

## Acceptance Criteria

- A JSON file pointed to by `DIVINITY_PROVIDER_CATALOG_PATH` can add a legitimate OpenAI-compatible provider without changing built-in code.
- Overlay entries can replace built-in provider ids only when they pass the same validation.
- Sources matching public/shared-key or bypass/evasion language are rejected at load time.
- Returned provider metadata includes no credential values.
- Existing CLI/API provider discovery can see overlay providers through environment configuration.
- Existing provider proxy route planning can route to an overlay provider with operator-owned credentials and still blocks limit-bypass intent.
- Tests do not call external providers and do not write repo-root state.

## Tasks

### Task 1: Runtime Red Tests

**Files:**
- Modify: `tests/tests_provider_runtime.mjs`

- [x] Add a temp overlay catalog with provider id `operator_free_tier_mock`, source `operator_config`, base URL `https://example.test/v1`, credential env var `OPERATOR_FREE_TIER_API_KEY`, and `chat_completions` transport.
- [x] Assert `publicLlmProviders({ env: { DIVINITY_PROVIDER_CATALOG_PATH: overlayPath } })` includes the overlay provider.
- [x] Assert a valid overlay can replace built-in provider id `groq` without duplicating that provider id.
- [x] Assert `resolveProviderRuntime({ provider_id: 'operator_free_tier_mock', env: { DIVINITY_PROVIDER_CATALOG_PATH: overlayPath, OPERATOR_FREE_TIER_API_KEY: 'secret' } })` resolves the provider and does not include `secret` in serialized output.
- [x] Add a bad overlay with source `public_shared_key_pool`; assert `loadProviderCatalog({ overlayPath: badPath })` throws `/public shared keys/`.
- [x] Run:

```bash
node tests/tests_provider_runtime.mjs
```

Expected: FAIL because env-aware overlay loading does not exist yet.

### Task 2: Implement Catalog Overlays

**Files:**
- Modify: `packages/provider-runtime/src/index.mjs`

- [x] Add `DEFAULT_PROVIDER_CATALOG_URL` and `BUILT_IN_LLM_PROVIDERS`.
- [x] Extend `loadProviderCatalog({ catalogUrl, overlayPath, env })` to read the built-in catalog and optionally merge `DIVINITY_PROVIDER_CATALOG_PATH`.
- [x] Validate overlay shape as `divinity.llm_provider_catalog.v1` with a `providers` array.
- [x] Reject provider sources matching `/public.*shared.*key|shared.*public.*key|shared_key|bypass|evade|circumvent/i`.
- [x] Deduplicate by `provider_id`, with overlay entries replacing built-in entries after validation.
- [x] Update `publicLlmProviders`, `providerById`, `resolveProviderRuntime`, and `providerCredentialReadiness` to accept `{ env }` and load the active catalog.
- [x] Preserve default behavior when no overlay path is configured.

### Task 3: Proxy Integration Test

**Files:**
- Modify: `tests/tests_provider_proxy.mjs`

- [x] Add a route-planning test with `DIVINITY_PROVIDER_CATALOG_PATH` and `OPERATOR_FREE_TIER_API_KEY` that selects `operator_free_tier_mock`.
- [x] Assert the selected route omits the credential value and keeps `policy.rotation_mode === "authorized_failover"`.
- [x] Run:

```bash
node tests/tests_provider_proxy.mjs
```

Expected: PASS after Task 2 because proxy route planning already passes `env` into provider runtime resolution.

### Task 4: Docs

**Files:**
- Modify: `packages/provider-runtime/README.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`

- [x] Document `DIVINITY_PROVIDER_CATALOG_PATH` with a minimal overlay example.
- [x] State that provider lists are research inputs only and that shared public API keys are rejected.
- [x] State that provider rotation is authorized failover across operator-owned credentials, not a way to bypass provider limits or signup requirements.

### Task 5: Verification And Publish

- [x] Run focused syntax checks:

```bash
node --check packages/provider-runtime/src/index.mjs
node --check packages/provider-proxy/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
```

- [x] Run focused tests:

```bash
node tests/tests_provider_runtime.mjs
node tests/tests_provider_proxy.mjs
node tests/tests_cli_provider_toolsets.mjs
node tests/tests_api_provider_toolsets.mjs
```

- [x] Run broader provider verification:

```bash
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

- [ ] Commit as `feat: add provider catalog overlays`, push, and open a PR.

## Self-Review

- Spec coverage: This supports legitimate testing/offload providers behind the existing proxy while refusing public shared-key ingestion and limit bypass.
- Scope boundary: It does not scrape GitHub READMEs, auto-import unverified provider lists, collect shared keys, or bypass provider signup, quota, or geography rules.
- Placeholder scan: No placeholder tasks remain.
