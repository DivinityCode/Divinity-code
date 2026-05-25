# API Provider Secret Refs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire provider proxy API route, chat, and stream execution to a redacted provider secret-reference manifest so hosted runtime credentials can be resolved inside the API process without returning secret values.

**Architecture:** Add `packages/provider-secrets` as a small manifest parser and credential resolver factory. The API imports one resolver at startup and passes it to `planProviderProxyRoute()`, `executeProviderProxyChat()`, and `executeProviderProxyChatStream()`. Provider catalog entries and actual provider keys remain separate: the manifest stores provider ids, secret refs, and environment variable names only.

**Tech Stack:** Node.js ES modules, built-in `fs`, existing provider-runtime/provider-proxy helpers, plain assertion-based repository tests.

---

### Task 1: Provider Secret Resolver Tests

**Files:**
- Create: `tests/tests_provider_secret_refs.mjs`
- Create: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Write the failing package test**

Create `tests/tests_provider_secret_refs.mjs` with assertions that a `divinity.provider_secret_refs.v1` manifest maps `provider_id` to `configured_secret_refs`, resolves the real secret only from the configured environment variable, omits secret values from public refs, and rejects raw credential fields or bypass/shared-key wording.

- [x] **Step 2: Run the package test to verify RED**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: FAIL because `packages/provider-secrets/src/index.mjs` does not exist.

- [x] **Step 3: Implement the minimal resolver**

Create `packages/provider-secrets/src/index.mjs` exporting `loadProviderSecretRefs()` and `createProviderCredentialResolver()`. The resolver should read `DIVINITY_PROVIDER_SECRET_REFS_PATH`, validate exact manifest format, reject raw secret-like fields, reject public shared-key or limit-bypass wording, and expose only `configuredSecretRefs(runtime)` plus `resolveCredential(runtime)`.

- [x] **Step 4: Run the package test to verify GREEN**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: PASS and JSON output `{ "ok": true, "test": "provider-secret-refs" }`.

### Task 2: API Resolver Wiring Tests

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] **Step 1: Write failing API route and chat tests**

Update the route test to configure a temp provider catalog overlay whose provider has no configured catalog env var, plus a temp secret refs manifest whose env var is configured. Assert `POST /provider-proxy/route` becomes ready through `configured_secret_refs`, leaves `configured_env_vars` empty, and never returns the env secret value.

Update the chat test to add non-streaming and streaming providers that are credential-ready only through the manifest. Assert the mock upstream receives the authorization header, while API JSON/SSE output includes only the secret ref and omits the secret value.

- [x] **Step 2: Run the API tests to verify RED**

Run:
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
Expected: FAIL because the API has not passed a credential resolver into provider-proxy helpers.

- [x] **Step 3: Wire API helpers**

Import `createProviderCredentialResolver()` in `apps/api/src/server.mjs`, create one resolver with `process.env`, and pass it as `credential_resolver` to provider route, chat, and stream helper calls.

- [x] **Step 4: Run API tests to verify GREEN**

Run:
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
Expected: PASS.

### Task 3: Docs, Scripts, and Verification

**Files:**
- Modify: `package.json`
- Modify: `README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/provider-proxy/README.md`
- Create: `packages/provider-secrets/README.md`

- [x] **Step 1: Add the new test to scripts**

Add `node tests/tests_provider_secret_refs.mjs` to `test` and `test:providers`.

- [x] **Step 2: Update public docs**

Document the new `DIVINITY_PROVIDER_SECRET_REFS_PATH` manifest, that it stores refs/env var names only, that real values stay in environment/secret storage, and that public shared-key or limit-bypass sources remain blocked.

- [x] **Step 3: Run focused and broad verification**

Run syntax checks for edited `.mjs` files, focused provider/API tests, `pnpm run validate:contracts`, `pnpm run test:providers`, `pnpm run test:api`, `pnpm run test:smoke`, full `pnpm test`, `pnpm run test:deprecations`, `git diff --check`, conflict-marker scan, root test/script pollution checks, and runtime file pollution checks.

- [ ] **Step 4: Publish**

Commit as `feat: wire api provider secret refs`, push `codex/api-provider-secret-refs`, open a ready PR against `main`, wait for CI, and merge only if checks are green.
