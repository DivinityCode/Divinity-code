# Provider Secret Readiness Audit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an operator-facing, redacted provider secret readiness surface and audit records for API provider proxy operations that use configured secret references.

**Architecture:** Extend `packages/provider-secrets` with a pure readiness builder that reports manifest/configuration status without secret values. Wire `apps/api` to expose `GET /provider-secrets/readiness` and to record redacted `provider_secret_readiness` and `provider_secret_ref` audit records when readiness is inspected or provider route/chat/stream operations use secret refs.

**Tech Stack:** Node.js ES modules, existing HTTP API server, existing audit package and contract schemas, assertion-based tests.

---

### Task 1: Provider Secret Readiness Package

**Files:**
- Modify: `packages/provider-secrets/src/index.mjs`
- Modify: `tests/tests_provider_secret_refs.mjs`

- [x] **Step 1: Write the failing readiness package test**

Add assertions to `tests/tests_provider_secret_refs.mjs` for `providerSecretReadiness({ env })`:
- returns `format: "divinity.provider_secret_readiness.v1"`;
- reports `manifest_configured: true` when `DIVINITY_PROVIDER_SECRET_REFS_PATH` is set;
- reports provider id, secret ref, credential env var, and `credential_configured`;
- never includes the real secret value;
- reports empty readiness when no manifest path is configured.

- [x] **Step 2: Run the package test to verify RED**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: FAIL because `providerSecretReadiness` is not exported.

- [x] **Step 3: Implement readiness**

Add `PROVIDER_SECRET_READINESS_FORMAT` and `providerSecretReadiness()` to `packages/provider-secrets/src/index.mjs`. Reuse existing manifest validation, avoid returning the configured manifest path, and keep credential values out of the returned object.

- [x] **Step 4: Run the package test to verify GREEN**

Run: `node tests/tests_provider_secret_refs.mjs`
Expected: PASS.

### Task 2: API Readiness And Audit Tests

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`
- Modify: `tests/tests_api_provider_proxy_chat.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `packages/contracts/schemas/audit.v1.json`

- [x] **Step 1: Write failing API tests**

In `tests/tests_api_provider_proxy.mjs`, call `GET /provider-secrets/readiness` and assert:
- status `200`;
- readiness lists the temp secret ref and marks it configured;
- response JSON does not include the secret value;
- `GET /audit` contains a `provider_secret_readiness` record with no secret value.

Also assert that a `POST /provider-proxy/route` using the secret ref writes a `provider_secret_ref` audit record with operation `route`, provider id, selected secret refs, no configured env var values, and no secret value.

In `tests/tests_api_provider_proxy_chat.mjs`, assert the existing secret-ref chat and stream calls each write `provider_secret_ref` audit records with operations `chat` and `stream`, respectively, and no secret value.

- [x] **Step 2: Run the API tests to verify RED**

Run:
`node tests/tests_api_provider_proxy.mjs`
`node tests/tests_api_provider_proxy_chat.mjs`
Expected: FAIL because API route/audit support is missing and audit schema does not list the new record types.

- [x] **Step 3: Implement API readiness and redacted audit**

Import `providerSecretReadiness()` into `apps/api/src/server.mjs`, add `GET /provider-secrets/readiness`, and add a helper that records `provider_secret_ref` when a route/result has selected `configured_secret_refs`. Use `run_id: "control_plane"` for control-plane provider-secret audit records until run-scoped provider proxy execution exists. Update `packages/contracts/schemas/audit.v1.json` enum with `provider_secret_readiness` and `provider_secret_ref`.

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

Document `GET /provider-secrets/readiness`, the two audit record types, that audit payloads include only provider ids, secret refs, operation names, and credential env var names, and that real credential values remain outside responses/audit files.

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

Run full `pnpm test`, `pnpm run test:smoke`, `git diff --check`, conflict-marker scan, root test/script pollution checks, and runtime file pollution checks. Confirm local `npm --version` status separately.

- [ ] **Step 4: Publish**

Commit as `feat: add provider secret readiness audit`, push `codex/provider-secret-readiness-audit`, open a ready PR against `main`, wait for GitHub Actions, merge only if checks are green, sync `main`, delete the branch, and rerun `pnpm run test:providers`.
