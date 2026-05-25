# Toolset Governance Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect toolset resolution to provider capability checks, policy permissions, and operator control metadata on task/run payloads.

**Architecture:** Keep `packages/toolsets` as the single resolver for selected toolsets. Extend `resolveToolsets()` to compute policy permission unions, risk summaries, provider capability checks, and operator controls, then pass provider runtime metadata into the resolver from CLI/API task assembly. Update the task contract so the richer `divinity.toolset_resolution.v1` payload remains schema-valid and visible to public clients.

**Tech Stack:** Node ESM, existing JSON contracts/examples, existing CLI/API JSON surfaces, repository tests under `tests/`.

---

### Task 1: Failing Governance Tests

**Files:**
- Modify: `tests/tests_toolsets.mjs`
- Modify: `tests/tests_cli_success_criteria.mjs`
- Modify: `tests/tests_api_provider_runtime_config.mjs`
- Modify: `packages/contracts/examples/task.valid.json`

- [x] **Step 1: Package resolver expectations**

Extend `tests/tests_toolsets.mjs` to assert:
- `resolveToolsets()` returns `policy_permissions`, `risk_summary`, `provider_capability_checks`, and `operator_controls`.
- `policy_permissions` is the sorted union of selected toolset permissions.
- A provider with `capabilities: ["chat"]` and selected `web` toolset returns a missing `tool_calls` provider capability check.
- A provider with `capabilities: ["chat", "tool_calls"]` returns a supported `tool_calls` capability check.
- High-risk toolsets create an `approval_required` operator control.

- [x] **Step 2: CLI/API task assembly expectations**

Extend CLI/API tests to assert that run task payloads include:
- `toolset_resolution.policy_permissions`.
- `toolset_resolution.provider_capability_checks`.
- `toolset_resolution.risk_summary`.
- `toolset_resolution.operator_controls`.

- [x] **Step 3: Contract example expectation**

Update `packages/contracts/examples/task.valid.json` so the richer toolset resolution shape is validated by `tests/scripts_validate_contracts.mjs`.

### Task 2: Implement Governance Metadata

**Files:**
- Modify: `packages/toolsets/src/index.mjs`
- Modify: `apps/cli/src/index.mjs`
- Modify: `apps/api/src/server.mjs`
- Modify: `packages/contracts/schemas/task.v1.json`

- [x] **Step 1: Compute policy and risk metadata**

Extend `resolveToolsets()` to return:
- `policy_permissions`: sorted unique permissions from selected toolsets.
- `risk_summary`: `{ highest_risk_level, high_risk_toolsets, medium_risk_toolsets, low_risk_toolsets }`.

- [x] **Step 2: Compute provider capability checks**

Add provider capability checks for selected model-callable toolsets:
- Required capability: `tool_calls`.
- Check status: `supported` when `provider_runtime.capabilities` includes `tool_calls`, otherwise `missing`.
- Include `provider_id`, `capability`, `status`, and `required_by_toolsets`.

- [x] **Step 3: Compute operator controls**

Return operator controls:
- `approval_required` with `status: "recommended"` when any high-risk toolset is selected.
- `provider_capability_review` with `status: "required"` when any provider capability check is missing.

- [x] **Step 4: Wire provider runtime into CLI/API**

Pass `providerRuntime` into `resolveToolsets()` from both CLI and API `taskWithRuntimeConfig()`.

- [x] **Step 5: Extend task schema**

Update `packages/contracts/schemas/task.v1.json` to allow the new `toolset_resolution` fields with strict object shapes and no unbounded additional properties.

### Task 3: Docs And Verification

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_CODE_EXAMPLES.md`

- [x] **Step 1: Document governance**

Document that toolset resolution now exposes policy permission unions, risk summaries, provider capability checks, and operator controls on task/run payloads.

- [x] **Step 2: Run verification**

Run:

```bash
node --check packages/toolsets/src/index.mjs
node --check apps/cli/src/index.mjs
node --check apps/api/src/server.mjs
node --check tests/tests_toolsets.mjs
node --check tests/tests_cli_success_criteria.mjs
node --check tests/tests_api_provider_runtime_config.mjs
node tests/tests_toolsets.mjs
node tests/tests_cli_success_criteria.mjs
node tests/tests_api_provider_runtime_config.mjs
pnpm run validate:contracts
pnpm run test:toolsets
pnpm run test:cli
pnpm run test:api
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'
find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print
test ! -e .divinity.json
```

### Task 4: Publish

- [ ] Commit as `feat: add toolset governance metadata`, push, open a ready PR, wait for GitHub Actions, merge if green, sync `main`, delete the branch, rerun focused post-merge verification, and mark this publish step complete.

## Self-Review

- Spec coverage: This advances the Phase 3 toolset governance slice by connecting toolsets to provider capability checks, policy permissions, and operator controls.
- Safety boundary: This adds metadata only; it does not grant new tool execution permission or bypass policy gates.
- Contract coverage: Task schema and valid examples must cover the new fields before publish.
