# Provider Secret Resolver Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a hosted-secret resolver boundary for provider credentials so production hosts can inject operator-owned secrets without storing or returning secret values.

**Architecture:** Keep environment variables as the local development path. Extend provider proxy route planning and chat execution to accept an injected credential resolver object that can report configured secret references and resolve a credential value at execution time. Public route/chat metadata may expose secret reference ids and readiness booleans, but never secret values.

**Tech Stack:** Node.js ESM, existing provider runtime and provider proxy packages, local mock provider tests, Markdown docs.

---

## Current Shape

- Provider runtime resolves credential readiness from environment variables.
- Provider proxy route planning blocks credential-required providers when no environment variable is configured.
- Provider chat execution reads the first configured environment variable and passes it in provider transport headers.
- Docs call hosted secret stores a future handler.

## File Structure

- Modify `tests/tests_provider_proxy.mjs` for route-planning coverage with an injected hosted secret resolver.
- Modify `tests/tests_provider_proxy_chat.mjs` for chat execution coverage with an injected hosted secret resolver.
- Modify `packages/provider-proxy/src/index.mjs` to add resolver-aware route readiness and credential resolution.
- Modify `packages/provider-proxy/README.md`, `docs/ARCHITECTURE.md`, `docs/FREE_LLM_PROVIDER_RESEARCH.md`, `docs/PRODUCT_PLAN.md`, and `docs/REPOSITORY_RESEARCH.md`.

## Acceptance Criteria

- `planProviderProxyRoute()` accepts `credential_resolver`.
- A resolver can mark a credential-required provider as configured without environment variables.
- Route metadata includes `configured_secret_refs` only, not secret values.
- `executeProviderProxyChat()` and `executeProviderProxyChatStream()` use the same resolver boundary when env credentials are absent.
- Provider request headers receive the resolved credential value, but returned route/result JSON does not include it.
- Public shared-key sources, bypass intent, credentialed endpoint override blocking, usage budgets, and provider/tool compatibility behavior remain unchanged.
- CLI/API behavior remains environment-variable based until a hosted runtime injects a resolver; no new repo-stored secret file is introduced.

## Tasks

### Task 1: Red Tests

- [x] Add a route test in `tests/tests_provider_proxy.mjs` that calls `planProviderProxyRoute()` with no provider env vars and a `credential_resolver` object exposing:
  - `configuredSecretRefs(runtime)` returning `["secret://divinity/providers/openrouter/api-key"]`;
  - `resolveCredential(runtime)` returning `"hosted-openrouter-secret"`.
- [x] Assert the route is `ready`, `configured_env_vars` is empty, `configured_secret_refs` contains the secret ref, and serialized route output omits `"hosted-openrouter-secret"`.
- [x] Add a chat test in `tests/tests_provider_proxy_chat.mjs` that calls `executeProviderProxyChat()` with no env credential and the same resolver.
- [x] Assert the mock provider receives `Authorization: Bearer hosted-openrouter-secret`, and serialized result output omits the secret value.
- [x] Run `node tests/tests_provider_proxy.mjs` and `node tests/tests_provider_proxy_chat.mjs`.
- [x] Expected result: FAIL because the proxy ignores `credential_resolver`.

### Task 2: Resolver-Aware Proxy

- [x] Add helper functions in `packages/provider-proxy/src/index.mjs`:
  - `configuredSecretRefs(runtime, credentialResolver)`;
  - `runtimeWithCredentialReadiness(runtime, credentialResolver)`;
  - `resolveCredential(runtime, env, credentialResolver)`.
- [x] Preserve existing environment-variable behavior as the first credential source.
- [x] Treat resolver-provided secret refs as readiness metadata only when environment variables are absent.
- [x] Resolve a credential value from `credentialResolver.resolveCredential(runtime)` only during chat/stream execution.
- [x] Include `configured_secret_refs` in route candidate metadata and selected runtime auth metadata.
- [x] Run `node tests/tests_provider_proxy.mjs` and `node tests/tests_provider_proxy_chat.mjs`.
- [x] Expected result: PASS.

### Task 3: Docs

- [x] Update provider proxy docs to describe injected hosted secret resolvers and the current CLI/API boundary.
- [x] Update architecture/free-provider/product docs so hosted secret integration moves from future-only to bootstrap package-boundary status while managed hosted identity and billing remain future.
- [x] Add repository research item for the secret resolver boundary.
- [x] Run `pnpm run test:providers` and `pnpm run test:deprecations`.
- [x] Expected result: PASS.

### Task 4: Verification And Publish

- [x] Run focused checks:

```bash
node --check packages/provider-proxy/src/index.mjs
node --check tests/tests_provider_proxy.mjs
node --check tests/tests_provider_proxy_chat.mjs
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:smoke
```

- [x] Run broader checks:

```bash
pnpm test
pnpm run test:deprecations
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
```

- [ ] Commit as `feat: add provider secret resolver boundary`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun `pnpm run test:providers`.

## Self-Review

- Spec coverage: The slice advances hosted-secret readiness without introducing repo-stored secrets or weakening provider route policy.
- Safety coverage: Secret values are only available inside injected runtime callbacks and provider transport headers; route/result metadata exposes only reference ids and readiness booleans.
- Placeholder scan: No TODO, TBD, or unspecified implementation steps remain.
