# Provider And Tool Runtime Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-grade, contract-visible LLM provider and toolset discovery so Divinity can move beyond MVP runtime adapter labels toward public-ready provider/tool configuration.

**Architecture:** Keep this slice metadata-first and side-effect-free. Add pure provider and toolset catalog packages, expose them through capabilities, CLI, API, doctor diagnostics, and schemas, then document how the design follows Hermes Agent's provider/runtime/toolset separation without making live LLM calls or storing secrets.

**Tech Stack:** Node ESM, JSON Schema draft 2020-12, existing CLI/API/capabilities packages, AJV contract validation, repository tests under `tests/`.

---

### Task 1: Provider Runtime Catalog

**Files:**
- Create: `packages/provider-runtime/src/index.mjs`
- Create: `tests/tests_provider_runtime.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing provider runtime test**

Create `tests/tests_provider_runtime.mjs` with assertions for:
- public providers include `openrouter`, `anthropic`, `openai_api`, `google_gemini`, and `custom_openai_compatible`.
- each provider has `provider_id`, `transport`, `auth_modes`, `credential_env_vars`, and `supports_custom_base_url`.
- `resolveProviderRuntime({ provider_id: 'anthropic', env: { ANTHROPIC_API_KEY: 'test' } })` returns `transport: 'anthropic_messages'` and configured auth without returning the secret.
- `resolveProviderRuntime({ provider_id: 'custom_openai_compatible', base_url: 'http://127.0.0.1:11434/v1' })` returns `transport: 'chat_completions'`, `base_url`, and `credential_configured: true` using the no-key local path.
- unknown providers throw `/unknown LLM provider/`.

Run:
`node tests/tests_provider_runtime.mjs`

Expected: FAIL because `packages/provider-runtime/src/index.mjs` does not exist.

- [x] **Step 2: Implement the provider runtime catalog**

Create `packages/provider-runtime/src/index.mjs` with:
- `LLM_PROVIDERS` metadata.
- `publicLlmProviders()`.
- `providerById(providerId)`.
- `resolveProviderRuntime({ provider_id, model, base_url, env })`.
- `providerCredentialReadiness({ env })`.

Use Hermes-derived transport names: `chat_completions`, `anthropic_messages`, and `codex_responses`.

- [x] **Step 3: Wire focused scripts**

Add `node tests/tests_provider_runtime.mjs` to the top-level `test` script and create `test:providers`.

- [x] **Step 4: Verify provider runtime**

Run:
`node --check packages/provider-runtime/src/index.mjs`
`node --check tests/tests_provider_runtime.mjs`
`node tests/tests_provider_runtime.mjs`

Expected: PASS.

### Task 2: Toolset Catalog

**Files:**
- Create: `packages/toolsets/src/index.mjs`
- Create: `tests/tests_toolsets.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing toolset test**

Create `tests/tests_toolsets.mjs` with assertions for:
- public toolsets include `web`, `file`, `terminal`, `code_execution`, `browser`, `memory`, `delegation`, `connectors`, and `approvals`.
- each toolset has `toolset_id`, `description`, `tools`, `default_enabled`, `risk_level`, and `policy_permissions`.
- `resolveToolsets({ enabled_toolsets: ['web', 'file'], disabled_toolsets: ['file'] })` returns only web tools.
- unknown toolsets throw `/unknown toolset/`.

Run:
`node tests/tests_toolsets.mjs`

Expected: FAIL because `packages/toolsets/src/index.mjs` does not exist.

- [x] **Step 2: Implement the toolset catalog**

Create `packages/toolsets/src/index.mjs` with:
- `TOOLSETS` metadata.
- `publicToolsets()`.
- `toolsetById(toolsetId)`.
- `resolveToolsets({ enabled_toolsets, disabled_toolsets })`.

- [x] **Step 3: Wire focused scripts**

Add `node tests/tests_toolsets.mjs` to the top-level `test` script and create `test:toolsets`.

- [x] **Step 4: Verify toolsets**

Run:
`node --check packages/toolsets/src/index.mjs`
`node --check tests/tests_toolsets.mjs`
`node tests/tests_toolsets.mjs`

Expected: PASS.

### Task 3: Public Capability, CLI, And API Surfaces

**Files:**
- Modify: `packages/capabilities/src/index.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `tests/tests_capabilities.mjs`
- Modify: `tests/tests_cli_capabilities.mjs`
- Modify: `tests/tests_api_capabilities.mjs`
- Create: `tests/tests_cli_provider_toolsets.mjs`
- Create: `tests/tests_api_provider_toolsets.mjs`

- [x] **Step 1: Extend tests first**

Add assertions that capabilities include non-empty `llm_providers` and `toolsets`.

Create CLI/API tests proving:
- `divinity providers` returns `command: 'providers'` and the LLM provider list.
- `divinity toolsets` returns `command: 'toolsets'` and the toolset list.
- `GET /providers` and `GET /toolsets` return the same contract-shaped lists.

Run:
`node tests/tests_capabilities.mjs`
`node tests/tests_cli_provider_toolsets.mjs`
`node tests/tests_api_provider_toolsets.mjs`

Expected: FAIL until surfaces are implemented.

- [x] **Step 2: Implement surfaces**

Import provider/toolset packages into capabilities, CLI, and API.

Add CLI commands:
- `providers`
- `toolsets`

Add API routes:
- `GET /providers`
- `GET /toolsets`

- [x] **Step 3: Verify surfaces**

Run:
`node tests/tests_capabilities.mjs`
`node tests/tests_cli_capabilities.mjs`
`node tests/tests_api_capabilities.mjs`
`node tests/tests_cli_provider_toolsets.mjs`
`node tests/tests_api_provider_toolsets.mjs`

Expected: PASS.

### Task 4: Contracts And Doctor Readiness

**Files:**
- Modify: `packages/contracts/schemas/capabilities.v1.json`
- Modify: `packages/contracts/examples/capabilities.valid.json`
- Modify: `packages/contracts/examples/capabilities.invalid.json`
- Modify: `apps/cli/src/index.mjs`
- Modify: `tests/tests_cli_doctor.mjs`
- Modify: `tests/scripts_validate_contracts.mjs`

- [x] **Step 1: Extend contract and doctor tests**

Update capability schema/example expectations for required `llm_providers` and `toolsets`.

Update `tests/tests_cli_doctor.mjs` to require:
- `provider_catalog`
- `toolset_catalog`
- optional `llm_provider_credentials`

Run:
`node tests/scripts_validate_contracts.mjs`
`node tests/tests_cli_doctor.mjs`

Expected: FAIL until schema and doctor output are updated.

- [x] **Step 2: Implement schema and doctor readiness**

Add schema definitions for provider and toolset arrays.

Extend `doctorPayload()` to emit side-effect-free provider/tool catalog checks and credential-readiness summaries without printing or storing secret values.

- [x] **Step 3: Verify contracts and doctor**

Run:
`node tests/scripts_validate_contracts.mjs`
`node tests/tests_cli_doctor.mjs`

Expected: PASS.

### Task 5: Research And Production Docs

**Files:**
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DOMAIN_MODEL.md`
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `packages/contracts/CHANGELOG.md`

- [x] **Step 1: Update research with Hermes provider/tool evidence**

Document that Hermes separates:
- provider identity overlays and auth modes (`hermes_cli/providers.py`)
- runtime credential and transport resolution (`hermes_cli/runtime_provider.py`)
- transport implementations keyed by `api_mode` (`agent/transports/*`)
- toolset discovery/configuration (`toolsets.py`, `model_tools.py`, `hermes_cli/tools_config.py`)

- [x] **Step 2: Update production roadmap**

Add Phase 3 public-readiness items for provider credentials, toolset governance, onboarding docs, release packaging, and real provider invocation.

- [x] **Step 3: Update local docs**

Document new CLI commands, API routes, capabilities fields, and current non-goal: this slice does not call providers.

### Task 6: Final Verification And Publish

**Files:**
- All modified files.

- [x] **Step 1: Run focused checks**

Run:
`node --check packages/provider-runtime/src/index.mjs`
`node --check packages/toolsets/src/index.mjs`
`node --check apps/cli/src/index.mjs`
`node --check apps/api/src/server.mjs`
`node tests/tests_provider_runtime.mjs`
`node tests/tests_toolsets.mjs`
`node tests/tests_cli_provider_toolsets.mjs`
`node tests/tests_api_provider_toolsets.mjs`
`node tests/tests_capabilities.mjs`
`node tests/tests_cli_doctor.mjs`
`node tests/scripts_validate_contracts.mjs`

- [x] **Step 2: Run project checks**

Run cached-pnpm equivalents of:
`pnpm run validate:contracts`
`pnpm run test:providers`
`pnpm run test:toolsets`
`pnpm run test:capabilities`
`pnpm run test:cli`
`pnpm run test:api`
`pnpm test`
`git diff --check`
`rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'`
root hygiene check for stray root `tests_*.mjs` / `scripts_*.mjs` and `.divinity.json`.

- [ ] **Step 3: Publish**

Commit as `feat: add provider and toolset catalogs`, push `codex/provider-tool-runtime-foundation`, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun post-merge verification.

## Self-Review

- Spec coverage: This plan covers the first production-readiness gap from the new objective: Hermes-style LLM provider and tool discovery, exposed through contracts and public surfaces.
- Scope boundary: This slice intentionally does not execute live LLM calls, persist secrets, add billing, or build hosted identity.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Provider identifiers use `provider_id`; tool identifiers use `toolset_id`; transport names use Hermes-derived `chat_completions`, `anthropic_messages`, and `codex_responses`.
