# Provider Secret Store Bootstrap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a conservative operator-managed provider secret store bootstrap so API provider proxy credentials can come from encrypted local store records instead of only environment variables.

**Architecture:** Extend `packages/provider-secrets` with an AES-256-GCM file-backed store controlled by `DIVINITY_PROVIDER_SECRET_STORE_PATH` and `DIVINITY_PROVIDER_SECRET_STORE_KEY`. The existing secret-ref manifest remains the provider-to-secret-ref allowlist, while the store holds encrypted values keyed by secret ref and the API exposes an identity-aware write endpoint that records only redacted audit metadata.

**Tech Stack:** Node.js ES modules, built-in `crypto` and `fs`, existing API auth/audit flow, existing provider proxy resolver hooks, assertion-based tests.

---

### Task 1: Provider Secret Store Package

**Files:**
- Modify: `packages/provider-secrets/src/index.mjs`
- Modify: `tests/tests_provider_secret_refs.mjs`

- [x] **Step 1: Write failing package tests**

Add tests that:
- call `storeProviderSecret()` with `provider_id`, `secret_ref`, `credential_env_var`, `secret_value`, `actor`, and `reason`;
- assert the returned store record is redacted and includes `updated_by`/`reason`;
- assert the store file does not contain plaintext;
- assert `providerSecretReadiness()` reports `store_configured: true` and `credential_source: "store"` when only the store has the value;
- assert `createProviderCredentialResolver()` resolves a store-backed credential without the provider env var;
- assert writes without actor/reason or without store key/path fail closed.

- [x] **Step 2: Run package test to verify RED**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: FAIL because `storeProviderSecret()` and store-backed resolver behavior do not exist.

- [x] **Step 3: Implement encrypted store helpers**

Add `PROVIDER_SECRET_STORE_FORMAT`, `PROVIDER_SECRET_STORE_PATH_ENV`, `PROVIDER_SECRET_STORE_KEY_ENV`, `storeProviderSecret()`, `loadProviderSecretStore()`, and dynamic store lookup inside `createProviderCredentialResolver()`. Store records use AES-256-GCM with a key derived from `DIVINITY_PROVIDER_SECRET_STORE_KEY`, write atomically, and return only redacted public metadata.

- [x] **Step 4: Run package test to verify GREEN**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: PASS.

### Task 2: API Store Write And Resolver Tests

**Files:**
- Modify: `apps/api/src/server.mjs`
- Modify: `tests/tests_api_provider_proxy.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`
- Modify: `packages/contracts/schemas/audit.v1.json`

- [x] **Step 1: Write failing API tests**

In `tests/tests_api_provider_proxy.mjs`, configure a temp store path/key, avoid setting the provider env var, call `POST /provider-secrets/store`, and assert:
- status `201`;
- the returned secret record is redacted and has actor/reason metadata;
- the encrypted store file does not contain the plaintext secret;
- `GET /provider-secrets/readiness` reports `credential_source: "store"`;
- `POST /provider-proxy/route` becomes ready through the store-backed resolver;
- `GET /audit` includes a redacted `provider_secret_write` record and no plaintext secret.

In `tests/tests_api_provider_proxy_chat.mjs`, seed the store-backed chat and stream provider secrets before API startup and assert existing mock upstream calls still receive authorization headers without provider env vars.

- [x] **Step 2: Run API tests to verify RED**

Run:
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
Expected: FAIL because the API store endpoint and store-backed resolver are missing.

- [x] **Step 3: Implement API store endpoint and audit**

Add `POST /provider-secrets/store`, call `storeProviderSecret()`, record a redacted `provider_secret_write` audit record, and add `provider_secret_write` to `packages/contracts/schemas/audit.v1.json`.

- [x] **Step 4: Run API tests to verify GREEN**

Run:
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
Expected: PASS.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/provider-secrets/README.md`

- [x] **Step 1: Update docs**

Document `DIVINITY_PROVIDER_SECRET_STORE_PATH`, `DIVINITY_PROVIDER_SECRET_STORE_KEY`, `POST /provider-secrets/store`, redacted audit behavior, and that environment variables remain the local fallback.

- [x] **Step 2: Run focused verification**

Run:
`node --check packages/provider-secrets/src/index.mjs`
`node --check apps/api/src/server.mjs`
`node --check tests/tests_provider_secret_refs.mjs`
`node --check tests/tests_api_provider_proxy.mjs`
`node --check tests/tests_api_provider_proxy_chat.mjs`
`node tests/tests_provider_secret_refs.mjs`
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
`pnpm run validate:contracts`
`pnpm run test:providers`
`pnpm run test:api`
`pnpm run test:deprecations`

- [x] **Step 3: Run broad hygiene**

Run `pnpm test`, `pnpm run test:smoke`, `git diff --check`, conflict-marker scan, root test/script pollution checks, runtime state pollution checks, and the known `npm --version` check.

- [ ] **Step 4: Publish**

Commit as `feat: add provider secret store bootstrap`, push `codex/provider-secret-store-bootstrap`, open a ready PR against `main`, wait for GitHub Actions, merge only if checks are green, sync `main`, delete the branch, and rerun `pnpm run test:providers`.
