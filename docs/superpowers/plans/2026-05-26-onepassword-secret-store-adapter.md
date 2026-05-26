# 1Password Secret Store Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production managed provider secret-store backend for 1Password-backed deployments while preserving Divinity's redacted provider-secret adapter contract.

**Architecture:** Extend `packages/provider-secrets` with `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=onepassword_secrets_automation`, backed by an approved absolute broker command and a JSON map from public `secret://` refs to deployment-managed 1Password secret ids. The adapter reuses the existing JSON-over-stdin/stdout command protocol, exposes only backend id/kind and public refs in metadata, and keeps deployment secret ids plus resolved credentials out of readiness, route, store, and audit metadata.

**Tech Stack:** Node.js ESM, existing provider secret-store adapter boundary, capabilities contract JSON schema, tests under `tests/`, Markdown docs.

---

## File Map

- Modify `packages/provider-secrets/src/index.mjs`: add 1Password env constants, public backend metadata, map parsing, command execution, adapter creation, and configured-backend routing.
- Modify `tests/tests_provider_secret_refs.mjs`: add failing tests for public backend discovery, store/readiness/resolver behavior, redaction, absolute command validation, and required secret id maps.
- Modify `tests/tests_capabilities.mjs`, `tests/tests_cli_capabilities.mjs`, `tests/tests_cli_doctor.mjs`: assert capability and doctor surfaces include `onepassword_secrets_automation`.
- Modify `packages/contracts/schemas/capabilities.v1.json` and `packages/contracts/examples/capabilities.valid.json`: include the new backend id in the public contract.
- Modify docs:
  - `packages/provider-secrets/README.md`
  - `apps/api/README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/FREE_LLM_PROVIDER_RESEARCH.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`
- Create this implementation plan under `docs/superpowers/plans/`.

## Task 1: Failing 1Password Adapter Tests

- [x] **Step 1: Add provider-secret tests**

In `tests/tests_provider_secret_refs.mjs`, update expected backend order to include:

```js
'onepassword_secrets_automation',
```

immediately after `hashicorp_vault`, then add a scenario after the HashiCorp Vault case:

```js
const onePasswordManagedStorePath = path.join(tmpRoot, 'onepassword-managed-store.json');
const onePasswordSecretId = 'op://Divinity/Providers/OpenRouter/API Key';
const onePasswordManagedEnv = {
  DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
  DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'onepassword_secrets_automation',
  DIVINITY_ONEPASSWORD_COMMAND: process.execPath,
  DIVINITY_ONEPASSWORD_COMMAND_ARGS: JSON.stringify([
    path.resolve('tests/fixtures/provider-secret-store-command.mjs')
  ]),
  DIVINITY_ONEPASSWORD_SECRET_IDS: JSON.stringify({
    [secretRef]: onePasswordSecretId
  }),
  DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: onePasswordManagedStorePath
};
const onePasswordManagedRecord = storeProviderSecret({
  env: onePasswordManagedEnv,
  provider_id: 'hosted_secret_mock',
  secret_ref: secretRef,
  credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
  secret_value: 'onepassword-managed-secret-value',
  actor: 'operator@example.com',
  reason: 'Authorized 1Password Secrets Automation onboarding',
  updated_at: '2026-05-26T15:00:00.000Z'
});
assert.equal(onePasswordManagedRecord.format, 'divinity.provider_secret_store_record.v1');
assert.equal(onePasswordManagedRecord.store_backend_id, 'onepassword_secrets_automation');
assert.equal(onePasswordManagedRecord.store_backend_kind, 'managed_secret_store');
assert.equal(onePasswordManagedRecord.algorithm, 'managed-by-onepassword-secrets-automation');
assert.equal(JSON.stringify(onePasswordManagedRecord).includes('onepassword-managed-secret-value'), false);
assert.equal(JSON.stringify(onePasswordManagedRecord).includes(onePasswordSecretId), false);

const onePasswordManagedReadiness = providerSecretReadiness({ env: onePasswordManagedEnv });
assert.equal(onePasswordManagedReadiness.store_configured, true);
assert.equal(onePasswordManagedReadiness.store_backend_id, 'onepassword_secrets_automation');
assert.equal(onePasswordManagedReadiness.store_backend_kind, 'managed_secret_store');
assert.equal(onePasswordManagedReadiness.providers[0].credential_configured, true);
assert.equal(onePasswordManagedReadiness.providers[0].credential_source, 'store');
assert.equal(JSON.stringify(onePasswordManagedReadiness).includes('onepassword-managed-secret-value'), false);
assert.equal(JSON.stringify(onePasswordManagedReadiness).includes(onePasswordSecretId), false);

const onePasswordManagedResolver = createProviderCredentialResolver({ env: onePasswordManagedEnv });
assert.deepEqual(onePasswordManagedResolver.configuredSecretRefs(runtime), [secretRef]);
assert.equal(onePasswordManagedResolver.resolveCredential(runtime), 'onepassword-managed-secret-value');
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...onePasswordManagedEnv,
      DIVINITY_ONEPASSWORD_COMMAND: 'op'
    }
  }).configuredSecretRefs(),
  /absolute executable path/
);
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...onePasswordManagedEnv,
      DIVINITY_ONEPASSWORD_SECRET_IDS: '{}'
    }
  }).configuredSecretRefs(),
  /secret id mapping/
);
```

- [x] **Step 2: Add capability and doctor assertions**

In `tests/tests_capabilities.mjs`, include `onepassword_secrets_automation` in the expected backend id list after `hashicorp_vault`, and assert:

```js
assert.equal(catalog.provider_secret_store_backends.find(backend => backend.backend_id === 'onepassword_secrets_automation').broker_command_required, true);
```

In `tests/tests_cli_capabilities.mjs`, assert:

```js
assert.ok(result.catalog.provider_secret_store_backends.some(backend => backend.backend_id === 'onepassword_secrets_automation'));
```

In `tests/tests_cli_doctor.mjs`, assert the provider secret-store backend summary mentions the new backend:

```js
assert.match(runtimeChecksById.get('provider_secret_store_backends').summary, /onepassword_secrets_automation/);
```

- [x] **Step 3: Add contract expectations**

In `packages/contracts/schemas/capabilities.v1.json`, add `onepassword_secrets_automation` to the `provider_secret_store_backends.items.properties.backend_id.enum` array.

In `packages/contracts/examples/capabilities.valid.json`, add a minimal 1Password backend entry:

```json
{
  "format": "divinity.provider_secret_store_backend.v1",
  "backend_id": "onepassword_secrets_automation",
  "backend_kind": "managed_secret_store",
  "display_name": "1Password Secrets Automation",
  "description": "1Password broker-command adapter with public secret refs mapped to deployment secret ids.",
  "production_ready": true,
  "broker_command_required": true,
  "configuration_env_vars": [
    "DIVINITY_ONEPASSWORD_COMMAND",
    "DIVINITY_ONEPASSWORD_COMMAND_ARGS",
    "DIVINITY_ONEPASSWORD_TIMEOUT_MS",
    "DIVINITY_ONEPASSWORD_SECRET_IDS"
  ],
  "redacts_secret_values": true,
  "redacts_deployment_secret_ids": true,
  "test_only": false
}
```

- [x] **Step 4: Verify red**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
node tests/tests_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/tests_cli_doctor.mjs
pnpm run validate:contracts
```

Expected: fail because the new backend id, adapter, and schema enum are not implemented yet.

## Task 2: Implement 1Password Adapter

- [x] **Step 1: Add constants and backend metadata**

In `packages/provider-secrets/src/index.mjs`, export env names:

```js
export const ONEPASSWORD_COMMAND_ENV = 'DIVINITY_ONEPASSWORD_COMMAND';
export const ONEPASSWORD_COMMAND_ARGS_ENV = 'DIVINITY_ONEPASSWORD_COMMAND_ARGS';
export const ONEPASSWORD_TIMEOUT_MS_ENV = 'DIVINITY_ONEPASSWORD_TIMEOUT_MS';
export const ONEPASSWORD_SECRET_IDS_ENV = 'DIVINITY_ONEPASSWORD_SECRET_IDS';
```

Add a public backend metadata entry after `hashicorp_vault` with backend id `onepassword_secrets_automation`, kind `managed_secret_store`, display name `1Password Secrets Automation`, the four env vars above, `production_ready: true`, `broker_command_required: true`, and redaction booleans set to `true`.

- [x] **Step 2: Add map parsing helpers**

Add helpers mirroring the other managed backends:

```js
function onePasswordCommandFrom({ env = process.env } = {}) {
  return cleanString(env[ONEPASSWORD_COMMAND_ENV]);
}

function onePasswordCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[ONEPASSWORD_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${ONEPASSWORD_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${ONEPASSWORD_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}
```

Also add `onePasswordCommandTimeoutFrom()` with the same 100-30000 ms bound and `onePasswordSecretIdMapFrom()` requiring a non-empty JSON object whose keys are valid `secret://` refs and whose values are non-empty strings.

- [x] **Step 3: Add command runner and adapter**

Add `runOnePasswordSecretStoreCommand()` that:

- requires `DIVINITY_ONEPASSWORD_COMMAND`;
- requires an absolute executable path;
- sends `{ action, provider: 'onepassword_secrets_automation', ...payload }`;
- uses JSON-array args and timeout helpers;
- invokes `execFileSync()` directly with no shell interpolation;
- returns parsed JSON only when `ok === true`;
- throws command-specific errors otherwise.

Add `createOnePasswordProviderSecretStoreAdapter({ env = process.env } = {})` with `backend_id: 'onepassword_secrets_automation'`, `backend_kind: 'managed_secret_store'`, `storeConfigured()`, `configuredSecretRefs()`, `resolveSecret()`, and `storeSecret()` mirroring the cloud/Vault adapters. Public store records must use:

```js
algorithm: 'managed-by-onepassword-secrets-automation'
```

- [x] **Step 4: Route configured backend**

Update `createConfiguredProviderSecretStoreAdapter()`:

```js
if (backend === 'onepassword_secrets_automation') {
  return createOnePasswordProviderSecretStoreAdapter({ env });
}
```

- [x] **Step 5: Verify green**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
node tests/tests_provider_secret_refs.mjs
node tests/tests_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/tests_cli_doctor.mjs
pnpm run validate:contracts
```

Expected: all pass.

## Task 3: Documentation Updates

- [x] Update `packages/provider-secrets/README.md` and `apps/api/README.md` to document `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=onepassword_secrets_automation`, the four `DIVINITY_ONEPASSWORD_*` env vars, absolute broker command requirement, JSON stdin/stdout, and redaction guarantees.
- [x] Update `docs/ARCHITECTURE.md` with the new backend and the guarantee that 1Password secret ids stay out of public metadata/audit records.
- [x] Update `docs/FREE_LLM_PROVIDER_RESEARCH.md` to list the 1Password adapter alongside AWS, GCP, Azure, and Vault as a legitimate operator-owned secret-store option.
- [x] Update `docs/PRODUCT_PLAN.md` with a Phase 3 bootstrap status line.
- [x] Add item 74 to `docs/REPOSITORY_RESEARCH.md` describing the 1Password secret-store adapter slice.

## Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/provider-secrets/src/index.mjs
node tests/tests_provider_secret_refs.mjs
node tests/tests_capabilities.mjs
node tests/tests_cli_capabilities.mjs
node tests/tests_api_capabilities.mjs
node tests/tests_cli_doctor.mjs
pnpm run test:providers
pnpm run validate:contracts
```

- [x] Run broad checks:

```bash
pnpm run test:api
pnpm run test:cli
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json
```

- [ ] Commit as `feat: add onepassword secret store adapter`.
- [ ] Push branch `codex/onepassword-secret-store-adapter`.
- [ ] Open a ready PR against `main`.
- [ ] Wait for GitHub checks, merge only when green, sync local `main`, and rerun `pnpm run test:providers`.
