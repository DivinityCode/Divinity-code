# Managed Secret Command Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a production-usable managed secret-store adapter binding that lets deployments connect an approved secret manager through a no-shell command protocol.

**Architecture:** Add an `external_command` provider secret-store backend that invokes one configured executable with JSON over stdin/stdout using `execFileSync`, never shell interpolation. The adapter keeps public API/readiness/audit shapes redacted while allowing internal credential resolution from the external manager; tests use a temp-file fixture command under `tests/fixtures`.

**Tech Stack:** Node.js ESM, provider secret adapter package, API provider proxy tests, documentation gates.

---

### Task 1: Command Adapter Package Contract

**Files:**
- Create: `tests/fixtures/provider-secret-store-command.mjs`
- Modify: `tests/tests_provider_secret_refs.mjs`
- Modify: `packages/provider-secrets/src/index.mjs`

- [x] **Step 1: Write the failing test fixture and assertions**

Create `tests/fixtures/provider-secret-store-command.mjs`, a test-only command that reads a JSON request from stdin, stores provider secrets in `DIVINITY_TEST_MANAGED_SECRET_STORE_PATH`, and responds with JSON for `store`, `configured_refs`, and `resolve`.

In `tests/tests_provider_secret_refs.mjs`, add a configured `external_command` scenario:

```js
const managedCommandStorePath = path.join(tmpRoot, 'managed-command-store.json');
const managedCommandEnv = {
  DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
  DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'external_command',
  DIVINITY_PROVIDER_SECRET_STORE_COMMAND: process.execPath,
  DIVINITY_PROVIDER_SECRET_STORE_COMMAND_ARGS: JSON.stringify([
    path.resolve('tests/fixtures/provider-secret-store-command.mjs')
  ]),
  DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: managedCommandStorePath
};
```

Assert `storeProviderSecret()`, `providerSecretReadiness()`, and `createProviderCredentialResolver()` use `store_backend_id: "external_command"`, `store_backend_kind: "managed_command"`, return only redacted public metadata, and still resolve the secret internally.

- [x] **Step 2: Verify red**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: FAIL because `external_command` is not supported yet.

- [x] **Step 3: Implement command adapter**

In `packages/provider-secrets/src/index.mjs`:
- import `execFileSync` from `child_process`;
- add command env constants;
- parse command args from a JSON string array;
- require the command path to be absolute;
- call the command with JSON input and no shell;
- support `store`, `configured_refs`, and `resolve`;
- return public store records with `algorithm: "managed-by-external-command"`, `store_backend_id: "external_command"`, and `store_backend_kind: "managed_command"`.

- [x] **Step 4: Verify green**

Run: `node tests/tests_provider_secret_refs.mjs`

Expected: PASS and print `{"ok":true,"test":"provider-secret-refs"}`.

### Task 2: API Managed Command Wiring

**Files:**
- Modify: `tests/tests_api_provider_proxy.mjs`

- [x] **Step 1: Update API fixture**

Switch the API provider proxy secret-store fixture from `hosted_memory` to:

```js
process.env.DIVINITY_PROVIDER_SECRET_STORE_BACKEND = 'external_command';
process.env.DIVINITY_PROVIDER_SECRET_STORE_COMMAND = process.execPath;
process.env.DIVINITY_PROVIDER_SECRET_STORE_COMMAND_ARGS = JSON.stringify([
  path.resolve('tests/fixtures/provider-secret-store-command.mjs')
]);
process.env.DIVINITY_TEST_MANAGED_SECRET_STORE_PATH = managedSecretStorePath;
```

Update assertions to expect `store_backend_id: "external_command"` and `store_backend_kind: "managed_command"`.

- [x] **Step 2: Verify API path**

Run: `node tests/tests_api_provider_proxy.mjs`

Expected: PASS and print `{"ok":true,"test":"api-provider-proxy"}`.

### Task 3: Documentation

**Files:**
- Modify: `packages/provider-secrets/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document:
- `external_command` is the managed deployment binding;
- the command path must be absolute and args are JSON array data, not shell text;
- the command receives JSON over stdin and returns JSON over stdout;
- public API/readiness/audit metadata remains redacted and does not expose resolved secret values.

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
node --check tests/fixtures/provider-secret-store-command.mjs
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

- [x] **Step 4: Commit and publish**

Commit message: `feat: add managed secret command adapter`

Push branch `codex/managed-secret-command-adapter`, open a PR against `main`, wait for GitHub Actions, merge only if checks are green, sync local `main`, and rerun `pnpm run test:providers`.
