# Provider Secret Store Backend Discovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make supported provider secret-store backends discoverable through capabilities and `doctor` so operators can inspect production credential-storage options without reading source code.

**Architecture:** Add public backend metadata in `packages/provider-secrets`, include it in `divinity.capabilities.v1`, and surface a runtime-safe doctor check that reports available production backends and keeps the test-only backend clearly non-production. The metadata must expose backend ids, kind, configuration environment variable names, broker-command requirements, and redaction guarantees, but never expose secret values, secret ids, Vault paths, local store paths, or local absolute paths.

**Tech Stack:** Node.js ESM, existing capabilities catalog, JSON Schema contracts, CLI doctor diagnostics, Markdown docs, package scripts.

---

## File Map

- Modify `packages/provider-secrets/src/index.mjs`: add `publicProviderSecretStoreBackends()`.
- Modify `packages/capabilities/src/index.mjs`: include `provider_secret_store_backends` in the capabilities catalog.
- Modify `packages/contracts/schemas/capabilities.v1.json`: add contract shape for provider secret-store backend metadata.
- Modify `packages/contracts/examples/capabilities.valid.json`: include representative valid backend metadata.
- Modify tests:
  - `tests/tests_provider_secret_refs.mjs`
  - `tests/tests_capabilities.mjs`
  - `tests/tests_cli_capabilities.mjs`
  - `tests/tests_api_capabilities.mjs`
  - `tests/tests_cli_doctor.mjs`
- Modify docs:
  - `packages/provider-secrets/README.md`
  - `packages/capabilities/README.md`
  - `apps/cli/README.md`
  - `apps/api/README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Discovery Tests

- [x] **Step 1: Add package-level metadata tests**

In `tests/tests_provider_secret_refs.mjs`, import `publicProviderSecretStoreBackends` and add assertions near the top after manifest loading:

```js
  const secretStoreBackends = publicProviderSecretStoreBackends();
  assert.deepEqual(secretStoreBackends.map(backend => backend.backend_id), [
    'local_file',
    'external_command',
    'aws_secrets_manager',
    'gcp_secret_manager',
    'azure_key_vault',
    'hashicorp_vault',
    'hosted_memory'
  ]);
  assert.ok(secretStoreBackends.every(backend => backend.format === 'divinity.provider_secret_store_backend.v1'));
  assert.ok(secretStoreBackends.every(backend => backend.redacts_secret_values === true));
  assert.ok(secretStoreBackends.every(backend => backend.redacts_deployment_secret_ids === true));
  assert.equal(secretStoreBackends.find(backend => backend.backend_id === 'hosted_memory').production_ready, false);
  assert.equal(secretStoreBackends.find(backend => backend.backend_id === 'hashicorp_vault').broker_command_required, true);
  assert.ok(secretStoreBackends.find(backend => backend.backend_id === 'hashicorp_vault').configuration_env_vars.includes('DIVINITY_HASHICORP_VAULT_SECRET_PATHS'));
  assert.equal(JSON.stringify(secretStoreBackends).includes('kv/data/divinity'), false);
  assert.equal(JSON.stringify(secretStoreBackends).includes(process.cwd()), false);
```

- [x] **Step 2: Add capabilities tests**

In `tests/tests_capabilities.mjs`, add:

```js
assert.deepEqual(catalog.provider_secret_store_backends.map(backend => backend.backend_id), [
  'local_file',
  'external_command',
  'aws_secrets_manager',
  'gcp_secret_manager',
  'azure_key_vault',
  'hashicorp_vault',
  'hosted_memory'
]);
assert.ok(catalog.provider_secret_store_backends.every(backend => backend.format === 'divinity.provider_secret_store_backend.v1'));
assert.equal(catalog.provider_secret_store_backends.find(backend => backend.backend_id === 'hosted_memory').production_ready, false);
assert.equal(catalog.provider_secret_store_backends.find(backend => backend.backend_id === 'external_command').broker_command_required, true);
```

In `tests/tests_cli_capabilities.mjs`, assert the CLI catalog includes `hashicorp_vault`:

```js
assert.ok(result.catalog.provider_secret_store_backends.some(backend => backend.backend_id === 'hashicorp_vault'));
```

In `tests/tests_api_capabilities.mjs`, assert the API catalog includes `external_command`:

```js
assert.ok(catalog.provider_secret_store_backends.some(backend => backend.backend_id === 'external_command'));
```

- [x] **Step 3: Add doctor diagnostics test**

In `tests/tests_cli_doctor.mjs`, add `provider_secret_store_backends` to both runtime and source required check lists. Add assertions:

```js
assert.equal(runtimeChecksById.get('provider_secret_store_backends').required, true);
assert.match(runtimeChecksById.get('provider_secret_store_backends').summary, /hashicorp_vault/);
assert.match(runtimeChecksById.get('provider_secret_store_backends').summary, /production backends/);
```

- [x] **Step 4: Add contract example and schema expectations**

Update `packages/contracts/examples/capabilities.valid.json` with a `provider_secret_store_backends` array containing at least `local_file` and `external_command`. Update the schema first in a way that the current example will fail until implementation is added.

- [x] **Step 5: Verify red**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: FAIL because `publicProviderSecretStoreBackends` is not exported.

Run:

```bash
node tests/tests_capabilities.mjs
```

Expected: FAIL because `provider_secret_store_backends` is missing.

Run:

```bash
node tests/tests_cli_doctor.mjs
```

Expected: FAIL because the doctor check is missing.

## Task 2: Implement Discovery Metadata

- [x] **Step 1: Add public backend metadata**

In `packages/provider-secrets/src/index.mjs`, add:

```js
const PROVIDER_SECRET_STORE_BACKENDS = [
  {
    backend_id: 'local_file',
    backend_kind: 'local_file',
    display_name: 'Local encrypted file store',
    description: 'AES-256-GCM encrypted local bootstrap store for evaluation and local API runtimes.',
    production_ready: false,
    broker_command_required: false,
    configuration_env_vars: [
      PROVIDER_SECRET_STORE_PATH_ENV,
      PROVIDER_SECRET_STORE_KEY_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'external_command',
    backend_kind: 'managed_command',
    display_name: 'External managed secret command',
    description: 'Deployment-managed command adapter using JSON stdin/stdout with no shell interpolation.',
    production_ready: true,
    broker_command_required: true,
    configuration_env_vars: [
      PROVIDER_SECRET_STORE_COMMAND_ENV,
      PROVIDER_SECRET_STORE_COMMAND_ARGS_ENV,
      PROVIDER_SECRET_STORE_COMMAND_TIMEOUT_MS_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'aws_secrets_manager',
    backend_kind: 'managed_secret_store',
    display_name: 'AWS Secrets Manager',
    description: 'AWS Secrets Manager broker-command adapter with public secret refs mapped to deployment secret ids.',
    production_ready: true,
    broker_command_required: true,
    configuration_env_vars: [
      AWS_SECRETS_MANAGER_COMMAND_ENV,
      AWS_SECRETS_MANAGER_COMMAND_ARGS_ENV,
      AWS_SECRETS_MANAGER_TIMEOUT_MS_ENV,
      AWS_SECRETS_MANAGER_SECRET_IDS_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'gcp_secret_manager',
    backend_kind: 'managed_secret_store',
    display_name: 'Google Cloud Secret Manager',
    description: 'Google Cloud Secret Manager broker-command adapter with public secret refs mapped to deployment secret ids.',
    production_ready: true,
    broker_command_required: true,
    configuration_env_vars: [
      GCP_SECRET_MANAGER_COMMAND_ENV,
      GCP_SECRET_MANAGER_COMMAND_ARGS_ENV,
      GCP_SECRET_MANAGER_TIMEOUT_MS_ENV,
      GCP_SECRET_MANAGER_SECRET_IDS_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'azure_key_vault',
    backend_kind: 'managed_secret_store',
    display_name: 'Azure Key Vault',
    description: 'Azure Key Vault broker-command adapter with public secret refs mapped to deployment secret ids.',
    production_ready: true,
    broker_command_required: true,
    configuration_env_vars: [
      AZURE_KEY_VAULT_COMMAND_ENV,
      AZURE_KEY_VAULT_COMMAND_ARGS_ENV,
      AZURE_KEY_VAULT_TIMEOUT_MS_ENV,
      AZURE_KEY_VAULT_SECRET_IDS_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'hashicorp_vault',
    backend_kind: 'managed_secret_store',
    display_name: 'HashiCorp Vault',
    description: 'HashiCorp Vault broker-command adapter with public secret refs mapped to deployment Vault paths.',
    production_ready: true,
    broker_command_required: true,
    configuration_env_vars: [
      HASHICORP_VAULT_COMMAND_ENV,
      HASHICORP_VAULT_COMMAND_ARGS_ENV,
      HASHICORP_VAULT_TIMEOUT_MS_ENV,
      HASHICORP_VAULT_SECRET_PATHS_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: false
  },
  {
    backend_id: 'hosted_memory',
    backend_kind: 'hosted_operator',
    display_name: 'Hosted memory test adapter',
    description: 'Test-only in-memory hosted-style adapter gated by DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND.',
    production_ready: false,
    broker_command_required: false,
    configuration_env_vars: [
      PROVIDER_SECRET_STORE_TEST_BACKEND_ENV
    ],
    redacts_secret_values: true,
    redacts_deployment_secret_ids: true,
    test_only: true
  }
];

export function publicProviderSecretStoreBackends() {
  return PROVIDER_SECRET_STORE_BACKENDS.map(backend => ({
    format: 'divinity.provider_secret_store_backend.v1',
    backend_id: backend.backend_id,
    backend_kind: backend.backend_kind,
    display_name: backend.display_name,
    description: backend.description,
    production_ready: backend.production_ready,
    broker_command_required: backend.broker_command_required,
    configuration_env_vars: [...backend.configuration_env_vars],
    redacts_secret_values: backend.redacts_secret_values,
    redacts_deployment_secret_ids: backend.redacts_deployment_secret_ids,
    test_only: backend.test_only
  }));
}
```

- [x] **Step 2: Wire capabilities catalog**

In `packages/capabilities/src/index.mjs`, import `publicProviderSecretStoreBackends` and add `provider_secret_store_backends: publicProviderSecretStoreBackends()` to `createCapabilitiesCatalog()`.

- [x] **Step 3: Wire doctor check**

In `apps/cli/src/index.mjs`, import `publicProviderSecretStoreBackends`, add:

```js
function providerSecretStoreBackendsCheck() {
  const backends = publicProviderSecretStoreBackends();
  const productionBackends = backends.filter(backend => backend.production_ready && !backend.test_only);
  return {
    check_id: 'provider_secret_store_backends',
    ok: productionBackends.length > 0,
    required: true,
    summary: `${productionBackends.length} production backends: ${productionBackends.map(backend => backend.backend_id).join(', ')}`
  };
}
```

Add the check after `providerCatalogCheck()` in `buildRuntimeDoctorChecks()`.

- [x] **Step 4: Update capabilities schema**

Add `provider_secret_store_backends` to the top-level `required` array in `packages/contracts/schemas/capabilities.v1.json`, and add a property schema requiring:

- `format`
- `backend_id`
- `backend_kind`
- `display_name`
- `description`
- `production_ready`
- `broker_command_required`
- `configuration_env_vars`
- `redacts_secret_values`
- `redacts_deployment_secret_ids`
- `test_only`

Allowed backend ids: `local_file`, `external_command`, `aws_secrets_manager`, `gcp_secret_manager`, `azure_key_vault`, `hashicorp_vault`, `hosted_memory`.

- [x] **Step 5: Verify green**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
node tests/tests_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/tests_api_capabilities.mjs
node tests/tests_cli_doctor.mjs
pnpm run validate:contracts
```

Expected: all pass.

## Task 3: Documentation

- [x] **Step 1: Update package and capability docs**

Update `packages/provider-secrets/README.md` and `packages/capabilities/README.md` to state that capabilities expose `provider_secret_store_backends` as public metadata without secret values, secret ids, Vault paths, local store paths, or absolute local paths.

- [x] **Step 2: Update CLI/API docs**

Update `apps/cli/README.md` and `apps/api/README.md` so `capabilities` and `doctor` mention provider secret-store backend discovery.

- [x] **Step 3: Update product and architecture docs**

Update `docs/ARCHITECTURE.md` and `docs/PRODUCT_PLAN.md` to mark provider secret-store backend discovery as a bootstrap status.

- [x] **Step 4: Update research ledger**

Append to `docs/REPOSITORY_RESEARCH.md`:

```md
67. **Provider secret-store backend discovery:** exposed redacted provider secret-store backend metadata through capabilities and `doctor`, listing local, command, managed cloud, Vault, and test-only backends without secret values, deployment secret ids, Vault paths, local store paths, or absolute local paths.
```

## Task 4: Verification, Commit, PR

- [x] **Step 1: Focused checks**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
node --check packages/capabilities/src/index.mjs
node --check apps/cli/src/index.mjs
node tests/tests_provider_secret_refs.mjs
node tests/tests_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/tests_api_capabilities.mjs
node tests/tests_cli_doctor.mjs
pnpm run validate:contracts
```

Expected: all commands exit 0.

- [x] **Step 2: Broad gates**

Run:

```bash
pnpm run test:capabilities
pnpm run test:bug
pnpm run test:public-docs
pnpm run test:deprecations
pnpm run test:providers
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json && git check-ignore -q dist/release-artifacts.json
```

Expected: all commands exit 0.

- [ ] **Step 3: Commit and publish**

Run:

```bash
git status --short
git add packages/provider-secrets/src/index.mjs packages/capabilities/src/index.mjs apps/cli/src/index.mjs packages/contracts/schemas/capabilities.v1.json packages/contracts/examples/capabilities.valid.json tests/tests_provider_secret_refs.mjs tests/tests_capabilities.mjs tests/tests_cli_capabilities.mjs tests/tests_api_capabilities.mjs tests/tests_cli_doctor.mjs packages/provider-secrets/README.md packages/capabilities/README.md apps/cli/README.md apps/api/README.md docs/ARCHITECTURE.md docs/PRODUCT_PLAN.md docs/REPOSITORY_RESEARCH.md docs/superpowers/plans/2026-05-26-provider-secret-store-backend-discovery.md
git commit -m "feat: expose provider secret store backends"
git push -u origin codex/provider-secret-store-backend-discovery
```

Then open a ready PR against `main`, wait for GitHub checks, merge only if green, sync local `main`, and rerun:

```bash
pnpm run test:capabilities
pnpm run test:bug
```

Expected: PR merged, local `main` clean except `.codex/`, focused checks still green.

## Self-Review

- Spec coverage: The plan advances the provider/runtime configuration surface by making existing secret-store backends discoverable to CLI/API clients and doctor diagnostics.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
- Type consistency: The top-level capabilities field is `provider_secret_store_backends`, and each entry uses `divinity.provider_secret_store_backend.v1`.
