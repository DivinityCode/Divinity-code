# Azure Secret Store Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Azure Key Vault as another provider-specific managed secret-store backend while preserving the redacted provider-secret adapter contract.

**Architecture:** Add `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=azure_key_vault`, backed by an absolute deployment broker command and an explicit JSON map from Divinity `secret://` refs to Azure Key Vault secret identifiers. The adapter uses the existing JSON-over-stdin/stdout command protocol with no shell interpolation, reports Azure-specific backend metadata, and keeps public responses, readiness, route metadata, and audit records free of secret values and deployment secret ids.

**Tech Stack:** Node.js ESM, provider secret adapter package, API provider proxy tests, documentation gates.

---

### Task 1: Provider Package Contract

**Files:**
- Modify: `tests/tests_provider_secret_refs.mjs`
- Modify: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Add failing Azure backend assertions**

In `tests/tests_provider_secret_refs.mjs`, add an `azure_key_vault` scenario after the `gcp_secret_manager` case:

```js
const azureManagedStorePath = path.join(tmpRoot, 'azure-managed-store.json');
const azureManagedSecretId = 'https://divinity-test.vault.azure.net/secrets/openrouter-api-key';
const azureManagedEnv = {
  DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
  DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'azure_key_vault',
  DIVINITY_AZURE_KEY_VAULT_COMMAND: process.execPath,
  DIVINITY_AZURE_KEY_VAULT_COMMAND_ARGS: JSON.stringify([
    path.resolve('tests/fixtures/provider-secret-store-command.mjs')
  ]),
  DIVINITY_AZURE_KEY_VAULT_SECRET_IDS: JSON.stringify({
    [secretRef]: azureManagedSecretId
  }),
  DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: azureManagedStorePath
};
```

Assert that `storeProviderSecret()`, `providerSecretReadiness()`, and `createProviderCredentialResolver()`:
- use `store_backend_id: "azure_key_vault"`;
- use `store_backend_kind: "managed_secret_store"`;
- use `algorithm: "managed-by-azure-key-vault"`;
- never include `azure-managed-secret-value` or `azureManagedSecretId` in public records/readiness;
- still resolve `azure-managed-secret-value` internally.

Add config-failure assertions:

```js
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...azureManagedEnv,
      DIVINITY_AZURE_KEY_VAULT_COMMAND: 'az'
    }
  }).configuredSecretRefs(),
  /absolute executable path/
);
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...azureManagedEnv,
      DIVINITY_AZURE_KEY_VAULT_SECRET_IDS: '{}'
    }
  }).configuredSecretRefs(),
  /secret id mapping/
);
```

- [x] **Step 2: Verify red**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: FAIL with `unsupported provider secret store backend: azure_key_vault`.

- [x] **Step 3: Implement Azure backend**

In `packages/provider-secrets/src/index.mjs`:
- add env constants for `DIVINITY_AZURE_KEY_VAULT_COMMAND`, `DIVINITY_AZURE_KEY_VAULT_COMMAND_ARGS`, `DIVINITY_AZURE_KEY_VAULT_TIMEOUT_MS`, and `DIVINITY_AZURE_KEY_VAULT_SECRET_IDS`;
- parse command args as a JSON string array;
- parse secret id map as a non-empty JSON object with `secret://` keys and non-empty deployment secret id values;
- require the broker command path to be absolute;
- invoke the command with JSON stdin and no shell interpolation;
- send managed command payloads containing `provider: "azure_key_vault"` and the mapped `secret_id`;
- return redacted public records with `algorithm: "managed-by-azure-key-vault"`;
- wire `createConfiguredProviderSecretStoreAdapter()` to return the new adapter for backend `azure_key_vault`.

- [x] **Step 4: Verify green**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: PASS and print `{"ok":true,"test":"provider-secret-refs"}`.

### Task 2: API Fixture Coverage

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`

- [x] **Step 1: Switch API managed fixture to Azure backend**

Use:

```js
process.env.DIVINITY_PROVIDER_SECRET_STORE_BACKEND = 'azure_key_vault';
process.env.DIVINITY_AZURE_KEY_VAULT_COMMAND = process.execPath;
process.env.DIVINITY_AZURE_KEY_VAULT_COMMAND_ARGS = JSON.stringify([
  path.resolve('tests/fixtures/provider-secret-store-command.mjs')
]);
process.env.DIVINITY_AZURE_KEY_VAULT_SECRET_IDS = JSON.stringify({
  [apiResolverSecretRef]: 'https://divinity-test.vault.azure.net/secrets/api-secret-ref-mock'
});
```

Update assertions to expect:
- `store_backend_id: "azure_key_vault"`;
- `store_backend_kind: "managed_secret_store"`;
- no secret value or Azure secret id in response/audit JSON.

- [x] **Step 2: Verify API path**

Run:

```bash
node tests/tests_api_provider_proxy.mjs
```

Expected: PASS and print `{"ok":true,"test":"api-provider-proxy"}`.

### Task 3: Documentation

**Files:**
- Modify: `packages/provider-secrets/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document:
- `azure_key_vault` is another provider-specific managed backend;
- it requires an absolute approved broker command path;
- command args are JSON array data, not shell text;
- `DIVINITY_AZURE_KEY_VAULT_SECRET_IDS` maps public `secret://` refs to deployment-managed Azure Key Vault secret ids;
- public responses, readiness, route metadata, and audit metadata expose backend id/kind and public refs only, never Azure secret ids or resolved values.

- [x] **Step 2: Run doc gates**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
```

Expected: PASS.

### Task 4: Verification And Publish

- [x] **Step 1: Focused verification**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
node --check tests/fixtures/provider-secret-store-command.mjs
node --check tests/tests_provider_secret_refs.mjs
node --check tests/tests_api_provider_proxy.mjs
pnpm run test:providers
pnpm run test:api
```

- [x] **Step 2: Broad verification**

Run:

```bash
pnpm test
npm ci
npm audit --audit-level=high
pnpm run validate:contracts
pnpm run test:smoke
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json
```

- [x] **Step 3: Commit and publish**

Commit message: `feat: add azure secret store adapter`

Push branch `codex/azure-secret-store-adapter`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:providers`.
