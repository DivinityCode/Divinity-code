# AWS Secret Store Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first provider-specific managed secret-store backend for production deployments while preserving the existing redacted provider-secret adapter contract.

**Architecture:** Add `DIVINITY_PROVIDER_SECRET_STORE_BACKEND=aws_secrets_manager`, backed by an absolute command path and an explicit JSON map from Divinity `secret://` refs to deployment-managed AWS Secrets Manager secret ids. The adapter keeps the command protocol JSON-over-stdin/stdout and no shell interpolation, but reports backend id/kind as AWS-specific public metadata; tests use a fixture broker under `tests/fixtures`.

**Tech Stack:** Node.js ESM, provider secret adapter package, API provider proxy tests, documentation gates.

---

### Task 1: AWS Backend Contract

**Files:**
- Modify: `tests/fixtures/provider-secret-store-command.mjs`
- Modify: `tests/tests_provider_secret_refs.mjs`
- Modify: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Add failing AWS backend assertions**

In `tests/tests_provider_secret_refs.mjs`, add an `aws_secrets_manager` scenario after the `external_command` case:

```js
const awsManagedStorePath = path.join(tmpRoot, 'aws-managed-store.json');
const awsManagedSecretId = 'arn:aws:secretsmanager:eu-west-1:111122223333:secret:divinity/openrouter';
const awsManagedEnv = {
  DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
  DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'aws_secrets_manager',
  DIVINITY_AWS_SECRETS_MANAGER_COMMAND: process.execPath,
  DIVINITY_AWS_SECRETS_MANAGER_COMMAND_ARGS: JSON.stringify([
    path.resolve('tests/fixtures/provider-secret-store-command.mjs')
  ]),
  DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS: JSON.stringify({
    [secretRef]: awsManagedSecretId
  }),
  DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: awsManagedStorePath
};
```

Assert `storeProviderSecret()`, `providerSecretReadiness()`, and `createProviderCredentialResolver()`:
- use `store_backend_id: "aws_secrets_manager"`;
- use `store_backend_kind: "managed_secret_store"`;
- use `algorithm: "managed-by-aws-secrets-manager"`;
- never include `aws-managed-secret-value` or `awsManagedSecretId` in public records/readiness;
- still resolve `aws-managed-secret-value` internally.

Add two config-failure assertions:

```js
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...awsManagedEnv,
      DIVINITY_AWS_SECRETS_MANAGER_COMMAND: 'aws'
    }
  }).configuredSecretRefs(),
  /absolute executable path/
);
assert.throws(
  () => createConfiguredProviderSecretStoreAdapter({
    env: {
      ...awsManagedEnv,
      DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS: '{}'
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

Expected: FAIL with `unsupported provider secret store backend: aws_secrets_manager`.

- [x] **Step 3: Implement AWS backend**

In `packages/provider-secrets/src/index.mjs`:
- add env constants:
  - `DIVINITY_AWS_SECRETS_MANAGER_COMMAND`
  - `DIVINITY_AWS_SECRETS_MANAGER_COMMAND_ARGS`
  - `DIVINITY_AWS_SECRETS_MANAGER_TIMEOUT_MS`
  - `DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS`
- parse command args as a JSON string array;
- parse secret id map as a non-empty JSON object whose keys are `secret://` refs and whose values are non-empty strings;
- require the AWS command path to be absolute;
- invoke the command with JSON stdin and no shell;
- send the managed command payload `{ action, provider: "aws_secrets_manager", secret_ref, secret_id, ... }`;
- return only redacted public records with `algorithm: "managed-by-aws-secrets-manager"`;
- wire `createConfiguredProviderSecretStoreAdapter()` to return the new adapter for backend `aws_secrets_manager`.

- [x] **Step 4: Verify green**

Run:

```bash
node tests/tests_provider_secret_refs.mjs
```

Expected: PASS and print `{"ok":true,"test":"provider-secret-refs"}`.

### Task 2: API Fixture Coverage

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`

- [x] **Step 1: Switch API managed fixture to AWS backend**

Change the provider proxy route test fixture to:

```js
process.env.DIVINITY_PROVIDER_SECRET_STORE_BACKEND = 'aws_secrets_manager';
process.env.DIVINITY_AWS_SECRETS_MANAGER_COMMAND = process.execPath;
process.env.DIVINITY_AWS_SECRETS_MANAGER_COMMAND_ARGS = JSON.stringify([
  path.resolve('tests/fixtures/provider-secret-store-command.mjs')
]);
process.env.DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS = JSON.stringify({
  [apiResolverSecretRef]: 'arn:aws:secretsmanager:eu-west-1:111122223333:secret:divinity/api-secret-ref-mock'
});
process.env.DIVINITY_TEST_MANAGED_SECRET_STORE_PATH = managedSecretStorePath;
```

Update assertions to expect:
- `store_backend_id: "aws_secrets_manager"`;
- `store_backend_kind: "managed_secret_store"`;
- no secret value or AWS secret id in response/audit JSON.

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
- `aws_secrets_manager` is the first provider-specific managed backend;
- it requires an absolute broker command path;
- command args are JSON array data, not shell text;
- `DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS` maps public `secret://` refs to deployment-managed AWS secret ids;
- public responses, readiness, and audit metadata expose backend id/kind only and never AWS secret ids or resolved values.

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
rg -n '^(<{7}|={7}|>{7})'
```

- [x] **Step 3: Commit and publish**

Commit message: `feat: add aws secret store adapter`

Push branch `codex/aws-secret-store-adapter`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:providers`.
