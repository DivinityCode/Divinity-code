# Provider And Tool Runtime Config Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Carry side-effect-free LLM provider runtime and toolset resolution metadata from config into CLI/API task and run payloads.

**Architecture:** Keep provider/tool runtime configuration as public metadata only. CLI `init` writes provider and toolset preferences to `.divinity.json`, CLI/API run assembly resolves those preferences into `provider_runtime` and `toolset_resolution`, and schemas document the new contract fields without storing secret values or calling live LLM providers.

**Tech Stack:** Node ESM, JSON Schema draft 2020-12, existing CLI/API task assembly, provider-runtime and toolsets packages, AJV validation, repository tests under `tests/`.

---

### Task 1: Failing Runtime Config Tests

**Files:**
- Modify: `tests/tests_cli_init.mjs`
- Modify: `tests/tests_cli_success_criteria.mjs`
- Create: `tests/tests_api_provider_runtime_config.mjs`
- Modify: `package.json`

- [x] **Step 1: Extend CLI init expectations**

Update `tests/tests_cli_init.mjs` to expect default `.divinity.json` config:

```json
{
  "policy_id": "safe_exec",
  "budget": { "soft_limit_usd": 2, "hard_limit_usd": 5 },
  "scope": { "org_id": "default-org", "project_id": "default-project" },
  "llm_provider": { "provider_id": "openrouter", "model": "openai/gpt-4o-mini" },
  "toolsets": { "enabled": ["web", "file", "code_execution", "memory", "delegation", "connectors", "approvals"], "disabled": [] }
}
```

Add a flag case for:

```bash
node apps/cli/src/index.mjs init --provider anthropic --model claude-sonnet-4.5 --enable-toolsets web,file --disable-toolsets file
```

Expected config contains Anthropic provider and `toolsets.enabled=["web","file"]`, `toolsets.disabled=["file"]`.

- [x] **Step 2: Extend CLI run expectations**

Update `tests/tests_cli_success_criteria.mjs` to assert:

```js
assert.equal(result.task.llm_provider.provider_id, 'openrouter');
assert.equal(result.task.provider_runtime.provider_id, 'openrouter');
assert.equal(result.task.provider_runtime.auth.credential_configured, false);
assert.equal(JSON.stringify(result.task.provider_runtime).includes('OPENROUTER_API_KEY_VALUE'), false);
assert.ok(result.task.toolset_resolution.tools.includes('read_file'));
assert.equal(result.task.toolset_resolution.toolsets.some(toolset => toolset.toolset_id === 'terminal'), false);
```

Pass `OPENROUTER_API_KEY_VALUE` only through env when needed so the test proves runtime metadata does not leak secrets.

- [x] **Step 3: Add API provider runtime config test**

Create `tests/tests_api_provider_runtime_config.mjs` that posts a task with:

```json
{
  "llm_provider": {
    "provider_id": "custom_openai_compatible",
    "base_url": "http://127.0.0.1:11434/v1",
    "model": "llama3.1"
  },
  "toolsets": {
    "enabled": ["web", "file"],
    "disabled": ["file"]
  }
}
```

Assert the created run and stored run include:
- `run.task.provider_runtime.provider_id === "custom_openai_compatible"`.
- `run.task.provider_runtime.auth.mode === "none"`.
- `run.task.provider_runtime.auth.credential_configured === true`.
- `run.task.toolset_resolution.tools` equals `["web_extract", "web_search"]`.

- [x] **Step 4: Register focused script coverage**

Add `node tests/tests_api_provider_runtime_config.mjs` to `test`, `test:api`, and `test:providers`.

- [x] **Step 5: Run failing tests**

Run:

```bash
node tests/tests_cli_init.mjs
node tests/tests_cli_success_criteria.mjs
node tests/tests_api_provider_runtime_config.mjs
```

Expected: FAIL because config and run payloads do not yet carry `llm_provider`, `provider_runtime`, or `toolset_resolution`.

### Task 2: Runtime Config Implementation

**Files:**
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`

- [x] **Step 1: Import runtime resolver in CLI and API**

Add `resolveProviderRuntime` to both surfaces from `packages/provider-runtime/src/index.mjs`.

- [x] **Step 2: Extend CLI config parsing**

Update `DEFAULT_CONFIG`, `parseInitArgs`, `askForConfig`, and `buildConfig` so:
- defaults select `openrouter` and `openai/gpt-4o-mini`.
- flags accept `--provider`, `--model`, `--base-url`, `--enable-toolsets`, and `--disable-toolsets`.
- wizard mode keeps provider prompts on stderr and JSON on stdout.
- invalid providers or toolsets fail through existing resolver errors.

- [x] **Step 3: Add runtime resolution helper**

Add a helper used by CLI and API assembly:

```js
function taskWithRuntimeConfig(task, config = {}) {
  const llmProvider = task.llm_provider || config.llm_provider || DEFAULT_CONFIG.llm_provider;
  const toolsets = task.toolsets || config.toolsets || DEFAULT_CONFIG.toolsets;
  return {
    ...task,
    llm_provider: llmProvider,
    toolsets,
    provider_runtime: resolveProviderRuntime({
      provider_id: llmProvider.provider_id,
      model: llmProvider.model,
      base_url: llmProvider.base_url
    }),
    toolset_resolution: resolveToolsets({
      enabled_toolsets: toolsets.enabled,
      disabled_toolsets: toolsets.disabled
    })
  };
}
```

Adapt exact defaults and function placement to the local file structure.

- [x] **Step 4: Wire CLI run payload**

Apply the runtime config helper when building the CLI `run` task payload. The printed task must include `llm_provider`, `toolsets`, `provider_runtime`, and `toolset_resolution`.

- [x] **Step 5: Wire API preflight and task creation**

Apply the same runtime config helper after `taskWithScope()` in `/preflight` and `/tasks`. Bad provider/toolset input must return `400` for `/tasks` and `/preflight` instead of crashing the server.

- [x] **Step 6: Verify focused tests pass**

Run:

```bash
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node tests/tests_cli_init.mjs
node tests/tests_cli_success_criteria.mjs
node tests/tests_api_provider_runtime_config.mjs
```

Expected: PASS.

### Task 3: Contracts And Documentation

**Files:**
- Modify: `packages/contracts/schemas/task.v1.json`
- Modify: `packages/contracts/examples/task.valid.json`
- Modify: `packages/contracts/examples/task.invalid.json`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/DOMAIN_MODEL.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`

- [x] **Step 1: Extend Task schema**

Add optional `llm_provider`, `toolsets`, `provider_runtime`, and `toolset_resolution` fields to `task.v1.json`. Keep `additionalProperties: false`, and make `provider_runtime.auth` expose credential env var names and configured env var names only, not secret values.

- [x] **Step 2: Update examples**

Update `task.valid.json` with OpenRouter provider and default toolset resolution. Ensure `task.invalid.json` remains invalid under the schema.

- [x] **Step 3: Update docs**

Document:
- CLI `init` provider/toolset flags and default config.
- CLI/API runs now carry provider runtime and toolset resolution metadata.
- API `/preflight` and `/tasks` resolve runtime metadata without live provider calls.
- Product Plan Phase 3 bootstrap status moves provider/tool runtime config from future to present, while live provider invocation remains next.
- Hermes research implication: Divinity now mirrors provider identity -> runtime resolution -> toolset resolution separation in task/run contracts.

- [x] **Step 4: Verify contracts**

Run:

```bash
node tests/scripts_validate_contracts.mjs
```

Expected: PASS.

### Task 4: Final Verification And Publish

**Files:**
- All modified files.

- [x] **Step 1: Run focused checks**

Run:

```bash
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_api_provider_runtime_config.mjs
node tests/tests_cli_init.mjs
node tests/tests_cli_success_criteria.mjs
node tests/tests_api_provider_runtime_config.mjs
node tests/scripts_validate_contracts.mjs
```

- [x] **Step 2: Run package checks**

Run cached-pnpm equivalents of:

```bash
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:toolsets
pnpm run test:cli
pnpm run test:api
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

- [ ] **Step 3: Publish**

Commit as `feat: carry provider runtime config on runs`, push `codex/provider-tool-runtime-config`, open a ready PR against `main`, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun focused post-merge verification.

## Self-Review

- Spec coverage: This plan advances the active objective by moving from provider/tool catalog discovery into production-facing config and task/run metadata while keeping live provider calls out of scope.
- Scope boundary: This slice does not execute LLM calls, persist API keys, add hosted identity, or change execution adapters.
- Placeholder scan: No placeholder tasks remain.
