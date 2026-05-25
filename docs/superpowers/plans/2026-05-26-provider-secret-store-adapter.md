# Provider Secret Store Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the provider secret-store implementation boundary with a pluggable adapter while preserving redacted API/readiness/audit behavior.

**Architecture:** Keep the existing AES-256-GCM file store as the default local adapter and add an explicit hosted-style adapter interface for runtime injection. The API creates one adapter at startup and passes that adapter into readiness, credential resolution, and write operations so future hosted deployments can swap storage without changing provider proxy behavior.

**Tech Stack:** Node.js ESM, existing provider secret package, API provider proxy routes, Node test scripts.

---

### Task 1: Package Adapter Boundary

**Files:**
- Modify: `tests/tests_provider_secret_refs.mjs`
- Modify: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Write the failing test**

In `tests/tests_provider_secret_refs.mjs`, import the new hosted adapter helper:

```js
import {
  createProviderCredentialResolver,
  createHostedProviderSecretStoreAdapter,
  loadProviderSecretRefs,
  providerSecretReadiness,
  storeProviderSecret
} from '../packages/provider-secrets/src/index.mjs';
```

Add a hosted adapter scenario after the existing store resolver checks:

```js
  const hostedAdapter = createHostedProviderSecretStoreAdapter({
    backend_id: 'hosted_operator_mock'
  });
  const hostedRecord = storeProviderSecret({
    env: {},
    secret_store_adapter: hostedAdapter,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'hosted-adapter-secret',
    actor: 'operator@example.com',
    reason: 'Authorized hosted provider onboarding',
    updated_at: '2026-05-26T09:00:00.000Z'
  });
  assert.equal(hostedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(hostedRecord.store_backend_id, 'hosted_operator_mock');
  assert.equal(hostedRecord.store_backend_kind, 'hosted_operator');
  assert.equal(JSON.stringify(hostedRecord).includes('hosted-adapter-secret'), false);

  const hostedReadiness = providerSecretReadiness({
    env: { DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath },
    secret_store_adapter: hostedAdapter
  });
  assert.equal(hostedReadiness.store_configured, true);
  assert.equal(hostedReadiness.store_backend_id, 'hosted_operator_mock');
  assert.equal(hostedReadiness.store_backend_kind, 'hosted_operator');
  assert.equal(hostedReadiness.providers[0].credential_source, 'store');

  const hostedResolver = createProviderCredentialResolver({
    env: { DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath },
    secret_store_adapter: hostedAdapter
  });
  assert.deepEqual(hostedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(hostedResolver.resolveCredential(runtime), 'hosted-adapter-secret');
```

Also update existing readiness assertions to expect the additive top-level `store_backend_id` and `store_backend_kind` fields.

- [x] **Step 2: Verify red**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: FAIL because `createHostedProviderSecretStoreAdapter` is not exported.

- [x] **Step 3: Implement the adapter boundary**

In `packages/provider-secrets/src/index.mjs`:
- add `createLocalProviderSecretStoreAdapter({ env })`;
- add `createHostedProviderSecretStoreAdapter({ backend_id })`;
- add `createConfiguredProviderSecretStoreAdapter({ env })`;
- update `storeProviderSecret()`, `providerSecretReadiness()`, and `createProviderCredentialResolver()` to accept `secret_store_adapter`;
- keep the existing local file backend behavior as the default;
- never return plaintext secrets from public store records, readiness, or configured refs.

- [x] **Step 4: Verify green**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: PASS and print `{"ok":true,"test":"provider-secret-refs"}`.

### Task 2: API Adapter Wiring

**Files:**
- Modify: `apps/api/src/server.mjs`
- Modify: `tests/tests_api_provider_proxy.mjs`

- [x] **Step 1: Write the failing API test**

In `tests/tests_api_provider_proxy.mjs`, set:

```js
process.env.DIVINITY_PROVIDER_SECRET_STORE_BACKEND = 'hosted_memory';
```

Then update assertions for `POST /provider-secrets/store`, `GET /provider-secrets/readiness`, and `GET /audit` to require:

```js
assert.equal(writeSecretBody.secret.store_backend_id, 'hosted_memory');
assert.equal(writeSecretBody.secret.store_backend_kind, 'hosted_operator');
assert.equal(readinessBody.readiness.store_backend_id, 'hosted_memory');
assert.equal(readinessBody.readiness.store_backend_kind, 'hosted_operator');
assert.ok(audit.records.some(record => (
  record.type === 'provider_secret_write'
    && record.payload.store_backend_id === 'hosted_memory'
    && record.payload.store_backend_kind === 'hosted_operator'
)));
```

- [x] **Step 2: Verify red**

Run: `node tests/tests_api_provider_proxy.mjs`

Expected: FAIL because the API does not create or report a store adapter backend.

- [x] **Step 3: Wire the API to one configured adapter**

In `apps/api/src/server.mjs`, import `createConfiguredProviderSecretStoreAdapter()`, create one `providerSecretStoreAdapter` at startup, pass it into `createProviderCredentialResolver()`, `providerSecretReadiness()`, and `storeProviderSecret()`, and add backend metadata to provider secret readiness/write audit payloads.

- [x] **Step 4: Verify green**

Run: `node tests/tests_api_provider_proxy.mjs`

Expected: PASS and print `{"ok":true,"test":"api-provider-proxy"}`.

### Task 3: Documentation and Product Status

**Files:**
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `packages/provider-secrets/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document:
- local AES-256-GCM file store is the default local bootstrap;
- hosted operator secret stores now have an adapter boundary;
- `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hosted_memory` is a test/runtime harness backend, not a production secret manager;
- readiness and audit records include backend id/kind metadata but never secret values.

- [x] **Step 2: Run doc-focused tests**

Run:

```bash
node tests/tests_deprecation_audit.mjs
node tests/tests_public_onboarding_docs.mjs
```

Expected: PASS.

### Task 4: Verification and Publish

**Files:**
- Verify all changed files.

- [x] **Step 1: Syntax checks**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_provider_secret_refs.mjs
node --check tests/tests_api_provider_proxy.mjs
```

- [x] **Step 2: Focused tests**

Run:

```bash
pnpm run test:providers
pnpm run test:api
pnpm run test:public-docs
pnpm run test:deprecations
```

- [x] **Step 3: Broad checks**

Run:

```bash
pnpm test
npm ci
npm audit --audit-level=high
pnpm run validate:contracts
pnpm run test:smoke
git diff --check
rg -n '^(<{7}|={7}|>{7})'
```

- [ ] **Step 4: Commit and publish**

Commit message: `feat: add provider secret store adapter`

Push branch `codex/provider-secret-store-adapter`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:providers`.
