# HashiCorp Vault Secret Store Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a HashiCorp Vault managed provider secret-store backend while preserving Divinity's redacted provider-secret adapter contract.

**Architecture:** Add `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hashicorp_vault`, backed by an absolute deployment broker command and an explicit JSON map from Divinity `secret://` refs to Vault secret paths. Reuse the existing JSON-over-stdin/stdout command protocol, expose only backend id/kind plus public `secret://` refs, and keep Vault paths plus resolved credential values out of public metadata, readiness responses, route metadata, and audit records.

**Tech Stack:** Node.js ESM, `execFileSync` command adapters, existing `packages/provider-secrets`, existing provider proxy API wiring, Markdown docs, package scripts.

---

## File Map

- Modify `packages/provider-secrets/src/index.mjs`: add Vault env constants, parse Vault secret path maps, run the Vault broker command, expose `createHashicorpVaultProviderSecretStoreAdapter()`, and wire it into `createConfiguredProviderSecretStoreAdapter()`.
- Modify `tests/tests_provider_secret_refs.mjs`: add a Vault managed-backend scenario after the Azure scenario and prove redaction plus resolver behavior.
- Existing fixture `tests/fixtures/provider-secret-store-command.mjs`: reuse unchanged because it already accepts generic `provider`, `secret_id`, and JSON stdin/stdout payloads.
- Modify docs:
  - `packages/provider-secrets/README.md`
  - `apps/api/README.md`
  - `docs/ARCHITECTURE.md`
  - `docs/FREE_LLM_PROVIDER_RESEARCH.md`
  - `docs/PRODUCT_PLAN.md`
  - `docs/REPOSITORY_RESEARCH.md`

## Task 1: Failing Vault Backend Test

- [x] **Step 1: Add a focused Vault scenario**

Add this block to `tests/tests_provider_secret_refs.mjs` immediately after the Azure Key Vault scenario and before the missing local-store-key assertions:

```js
  const vaultManagedStorePath = path.join(tmpRoot, 'vault-managed-store.json');
  const vaultManagedSecretPath = 'kv/data/divinity/providers/openrouter';
  const vaultManagedEnv = {
    DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
    DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'hashicorp_vault',
    DIVINITY_HASHICORP_VAULT_COMMAND: process.execPath,
    DIVINITY_HASHICORP_VAULT_COMMAND_ARGS: JSON.stringify([
      path.resolve('tests/fixtures/provider-secret-store-command.mjs')
    ]),
    DIVINITY_HASHICORP_VAULT_SECRET_PATHS: JSON.stringify({
      [secretRef]: vaultManagedSecretPath
    }),
    DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: vaultManagedStorePath
  };
  const vaultManagedRecord = storeProviderSecret({
    env: vaultManagedEnv,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'vault-managed-secret-value',
    actor: 'operator@example.com',
    reason: 'Authorized HashiCorp Vault onboarding',
    updated_at: '2026-05-26T14:00:00.000Z'
  });
  assert.equal(vaultManagedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(vaultManagedRecord.store_backend_id, 'hashicorp_vault');
  assert.equal(vaultManagedRecord.store_backend_kind, 'managed_secret_store');
  assert.equal(vaultManagedRecord.algorithm, 'managed-by-hashicorp-vault');
  assert.equal(JSON.stringify(vaultManagedRecord).includes('vault-managed-secret-value'), false);
  assert.equal(JSON.stringify(vaultManagedRecord).includes(vaultManagedSecretPath), false);

  const vaultManagedReadiness = providerSecretReadiness({
    env: vaultManagedEnv
  });
  assert.equal(vaultManagedReadiness.store_configured, true);
  assert.equal(vaultManagedReadiness.store_backend_id, 'hashicorp_vault');
  assert.equal(vaultManagedReadiness.store_backend_kind, 'managed_secret_store');
  assert.equal(vaultManagedReadiness.providers[0].credential_configured, true);
  assert.equal(vaultManagedReadiness.providers[0].credential_source, 'store');
  assert.equal(JSON.stringify(vaultManagedReadiness).includes('vault-managed-secret-value'), false);
  assert.equal(JSON.stringify(vaultManagedReadiness).includes(vaultManagedSecretPath), false);

  const vaultManagedResolver = createProviderCredentialResolver({
    env: vaultManagedEnv
  });
  assert.deepEqual(vaultManagedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(vaultManagedResolver.resolveCredential(runtime), 'vault-managed-secret-value');
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...vaultManagedEnv,
        DIVINITY_HASHICORP_VAULT_COMMAND: 'vault'
      }
    }).configuredSecretRefs(),
    /absolute executable path/
  );
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...vaultManagedEnv,
        DIVINITY_HASHICORP_VAULT_SECRET_PATHS: '{}'
      }
    }).configuredSecretRefs(),
    /secret path mapping/
  );
```

- [x] **Step 2: Verify red**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: FAIL with `unsupported provider secret store backend: hashicorp_vault`.

## Task 2: Implement Vault Backend

- [x] **Step 1: Add Vault constants and parsers**

In `packages/provider-secrets/src/index.mjs`, add exported env constants beside the Azure constants:

```js
export const HASHICORP_VAULT_COMMAND_ENV = 'DIVINITY_HASHICORP_VAULT_COMMAND';
export const HASHICORP_VAULT_COMMAND_ARGS_ENV = 'DIVINITY_HASHICORP_VAULT_COMMAND_ARGS';
export const HASHICORP_VAULT_TIMEOUT_MS_ENV = 'DIVINITY_HASHICORP_VAULT_TIMEOUT_MS';
export const HASHICORP_VAULT_SECRET_PATHS_ENV = 'DIVINITY_HASHICORP_VAULT_SECRET_PATHS';
```

Add parser helpers equivalent to the Azure helpers, but using `secret path` wording and the Vault env names:

```js
function vaultCommandFrom({ env = process.env } = {}) {
  return cleanString(env[HASHICORP_VAULT_COMMAND_ENV]);
}

function vaultCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[HASHICORP_VAULT_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${HASHICORP_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${HASHICORP_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function vaultCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[HASHICORP_VAULT_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${HASHICORP_VAULT_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function vaultSecretPathMapFrom({ env = process.env } = {}) {
  const rawMap = cleanString(env[HASHICORP_VAULT_SECRET_PATHS_ENV]);
  if (!rawMap) throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping is required`);
  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping must be a JSON object`);
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping must be a non-empty JSON object`);
  }
  const normalized = {};
  for (const [secretRef, secretPath] of Object.entries(parsed)) {
    const cleanSecretRef = cleanString(secretRef);
    const cleanSecretPath = cleanString(secretPath);
    if (!SECRET_REF_PATTERN.test(cleanSecretRef) || !cleanSecretPath) {
      throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping entries must use secret:// refs and non-empty Vault paths`);
    }
    normalized[cleanSecretRef] = cleanSecretPath;
  }
  return normalized;
}
```

- [x] **Step 2: Add command runner and adapter**

Add `runVaultSecretStoreCommand()` and `createHashicorpVaultProviderSecretStoreAdapter()` after the Azure adapter. The adapter must:

- return `backend_id: 'hashicorp_vault'`;
- return `backend_kind: 'managed_secret_store'`;
- call the configured absolute broker command with request `provider: 'hashicorp_vault'`;
- pass the secret path internally as `secret_id` so the existing fixture remains reusable;
- filter `configured_refs()` to the public refs in `DIVINITY_HASHICORP_VAULT_SECRET_PATHS`;
- return public records with `algorithm: 'managed-by-hashicorp-vault'`;
- never return the Vault path or resolved secret value in public metadata.

- [x] **Step 3: Wire configured backend**

In `createConfiguredProviderSecretStoreAdapter()`, add:

```js
  if (backend === 'hashicorp_vault') {
    return createHashicorpVaultProviderSecretStoreAdapter({ env });
  }
```

- [x] **Step 4: Verify green**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: PASS with `{"ok":true,"test":"provider-secret-refs"}`.

## Task 3: Documentation

- [x] **Step 1: Update provider-secret docs**

Document `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=hashicorp_vault` in `packages/provider-secrets/README.md` and `apps/api/README.md`, including these env vars:

- `DIVINITY_HASHICORP_VAULT_COMMAND`
- `DIVINITY_HASHICORP_VAULT_COMMAND_ARGS`
- `DIVINITY_HASHICORP_VAULT_SECRET_PATHS`

State that Vault paths and credential values are never exposed in public readiness, write, route, or audit metadata.

- [x] **Step 2: Update product and architecture docs**

Update `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, and `docs/PRODUCT_PLAN.md` so the bootstrap status includes the Vault backend beside AWS, GCP, and Azure.

- [x] **Step 3: Update research ledger**

Append an implementation decision to `docs/REPOSITORY_RESEARCH.md`:

```md
65. **HashiCorp Vault secret store adapter:** added `hashicorp_vault` provider secret-store backend support using the same approved absolute broker-command contract plus explicit `secret://` ref to Vault secret path mapping, while preserving redacted write/readiness/route/audit metadata and keeping Vault paths out of public responses.
```

## Task 4: Verification, Commit, PR

- [x] **Step 1: Syntax and focused checks**

Run:

```bash
node --check packages/provider-secrets/src/index.mjs
node --check tests/tests_provider_secret_refs.mjs
node --check tests/fixtures/provider-secret-store-command.mjs
pnpm run test:providers
```

Expected: all commands exit 0.

- [x] **Step 2: Docs and broad checks**

Run:

```bash
pnpm run test:public-docs
pnpm run test:deprecations
pnpm run validate:contracts
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
```

Expected: all commands exit 0 and the conflict-marker scan finds no matches.

- [ ] **Step 3: Commit and publish**

Run:

```bash
git status --short
git add packages/provider-secrets/src/index.mjs tests/tests_provider_secret_refs.mjs packages/provider-secrets/README.md apps/api/README.md docs/ARCHITECTURE.md docs/FREE_LLM_PROVIDER_RESEARCH.md docs/PRODUCT_PLAN.md docs/REPOSITORY_RESEARCH.md docs/superpowers/plans/2026-05-26-hashicorp-vault-secret-store-adapter.md
git commit -m "feat: add hashicorp vault secret store adapter"
git push -u origin codex/hashicorp-vault-secret-store-adapter
```

Then open a ready PR against `main`, wait for GitHub checks, merge only if checks are green, sync local `main`, and rerun:

```bash
pnpm run test:providers
```

Expected: PR merged, local `main` clean except `.codex/`, provider checks still green.

## Self-Review

- Spec coverage: The plan implements the Product Plan's managed deployment secret-store hardening slice with another production-grade backend while preserving the redacted adapter contract.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
- Type consistency: Backend id is `hashicorp_vault`; public algorithm is `managed-by-hashicorp-vault`; env names use `DIVINITY_HASHICORP_VAULT_*`; the secret path map is intentionally exposed only through private command payloads as `secret_id`.
