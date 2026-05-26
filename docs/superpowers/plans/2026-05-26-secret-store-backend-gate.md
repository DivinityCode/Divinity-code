# Secret Store Backend Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent the test-only `hosted_memory` provider secret-store backend from being selected by production runtime configuration.

**Architecture:** Keep the hosted adapter factory available for explicit dependency injection, but make `createConfiguredProviderSecretStoreAdapter()` fail closed when `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hosted_memory` is set without a separate test-only opt-in. Tests that use the backend must set `DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND=1`, and docs must describe the backend as a harness-only path.

**Tech Stack:** Node.js ESM, provider secret adapter package, API provider proxy tests, documentation gates.

---

### Task 1: Provider Secret Backend Policy

**Files:**
- Modify: `tests/tests_provider_secret_refs.mjs`
- Modify: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Write the failing test**

In `tests/tests_provider_secret_refs.mjs`, import `createConfiguredProviderSecretStoreAdapter()` and add assertions after the hosted adapter injection scenario:

```js
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: { DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'hosted_memory' }
    }),
    /test-only provider secret store backend/
  );

  const configuredHostedAdapter = createConfiguredProviderSecretStoreAdapter({
    env: {
      DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'hosted_memory',
      DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND: '1'
    }
  });
  assert.equal(configuredHostedAdapter.backend_id, 'hosted_memory');
  assert.equal(configuredHostedAdapter.backend_kind, 'hosted_operator');
```

- [x] **Step 2: Verify red**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: FAIL because `hosted_memory` is currently selectable without the explicit opt-in.

- [x] **Step 3: Implement the gate**

In `packages/provider-secrets/src/index.mjs`, export `PROVIDER_SECRET_STORE_TEST_BACKEND_ENV = 'DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND'`. Add a helper that treats only `1`, `true`, or `yes` as enabled. Update `createConfiguredProviderSecretStoreAdapter()` so:
- `local_file` remains the default;
- `hosted_memory` requires the explicit test-backend env var;
- the error message states that the backend is test-only and managed hosted adapters must be injected.

- [x] **Step 4: Verify green**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: PASS and print `{"ok":true,"test":"provider-secret-refs"}`.

### Task 2: API Harness Opt-In

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`

- [x] **Step 1: Write/update the API test fixture**

Set the opt-in before importing the API server:

```js
process.env.DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND = '1';
```

- [x] **Step 2: Verify API path**

Run: `node tests/tests_api_provider_proxy.mjs`

Expected: PASS and print `{"ok":true,"test":"api-provider-proxy"}`.

### Task 3: Documentation

**Files:**
- Modify: `packages/provider-secrets/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document:
- `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hosted_memory` is blocked unless `DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND=1` is set;
- the opt-in is for tests and local harnesses only;
- production managed secret stores must be injected as approved hosted adapters.

- [x] **Step 2: Run doc gates**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
```

Expected: PASS.

### Task 4: Verification and Publish

**Files:**
- Verify all changed files.

- [x] **Step 1: Syntax checks**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
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

Commit message: `chore: gate test secret store backend`

Push branch `codex/secret-store-backend-gate`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:providers`.
