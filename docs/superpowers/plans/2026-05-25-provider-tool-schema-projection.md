# Provider Tool Schema Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Project selected Divinity tool schemas into provider request bodies so compatible LLM providers can request tool calls without executing tools automatically.

**Architecture:** Keep `packages/toolsets` as the canonical public catalog and extend `resolveToolsets()` with redacted, provider-neutral `tool_schemas`. `packages/provider-proxy` converts those schemas into transport-specific request shapes inside the existing shared request builder, so streaming and non-streaming chat execution stay aligned. Tool execution remains out of scope; returned tool calls still require operator approval.

**Tech Stack:** Node.js ESM, built-in `assert`, local HTTP mock servers, JSON Schema, existing `packages/toolsets`, `packages/provider-proxy`, and contract validation.

---

## Confirmed Provider Shapes

- OpenAI Responses function tools use `tools: [{ type: "function", name, description, parameters }]`; current OpenAI docs recommend function definitions with JSON Schema parameters and strict mode where possible.
- OpenAI-compatible Chat Completions function tools use `tools: [{ type: "function", function: { name, description, parameters } }]`.
- Anthropic Messages client tools use `tools: [{ name, description, input_schema }]`.
- Anthropic and OpenAI both count tool definitions against input tokens, so the projection must include only selected tools.

Sources checked on 2026-05-25:
- https://developers.openai.com/api/docs/guides/function-calling
- https://api.openai.com/v1/responses
- https://api.openai.com/v1/chat/completions
- https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools

## Files

- Modify: `README.md` to show the heavy-development warning.
- Modify: `packages/toolsets/src/index.mjs` to add provider-neutral tool schemas and include them in `resolveToolsets()`.
- Modify: `packages/provider-proxy/src/index.mjs` to project selected tool schemas into Chat Completions, Anthropic Messages, and OpenAI Responses request bodies.
- Modify: `packages/contracts/schemas/task.v1.json` to admit `toolset_resolution.tool_schemas` while keeping strict `additionalProperties: false`.
- Modify: `packages/contracts/schemas/capabilities.v1.json` if public toolset objects expose schema metadata.
- Modify: `packages/contracts/examples/task.valid.json` so schema validation covers `tool_schemas`.
- Modify: `tests/tests_toolsets.mjs`, `tests/tests_provider_proxy_chat.mjs`, and `tests/tests_provider_proxy_stream.mjs`.
- Modify: `packages/toolsets/README.md`, `packages/provider-proxy/README.md`, `apps/cli/README.md`, `apps/api/README.md`, `docs/ARCHITECTURE.md`, `docs/PRODUCT_PLAN.md`, and `docs/FREE_LLM_PROVIDER_RESEARCH.md`.

## Task 1: README Warning

- [x] **Step 1: Add visible warning**

Add this block immediately after the README intro:

```markdown
> ⚠️ **WARNING: Divinity Code is under heavy active development and is not yet ready for production use. It should only be used if you know what you're doing.**
```

- [x] **Step 2: Verify diff is scoped**

Run: `git diff -- README.md`

Expected: only the warning block is added.

## Task 2: Toolset Schema Metadata

- [x] **Step 1: Write failing resolver assertions**

Extend `tests/tests_toolsets.mjs` after the existing `resolved` assertions:

```js
assert.deepEqual(resolved.tool_schemas.map(tool => tool.name), ['web_extract', 'web_search']);
assert.deepEqual(
  resolved.tool_schemas.find(tool => tool.name === 'web_search'),
  {
    name: 'web_search',
    description: 'Search public web results for a concise query and return source metadata for operator review.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search query to run against public web results.' }
      },
      required: ['query'],
      additionalProperties: false
    },
    toolsets: ['web'],
    risk_level: 'low',
    policy_permissions: ['network:read']
  }
);
```

- [x] **Step 2: Run resolver test to verify RED**

Run: `node tests/tests_toolsets.mjs`

Expected: FAIL because `resolved.tool_schemas` is undefined.

- [x] **Step 3: Implement schemas**

Add a `TOOL_SCHEMAS` map in `packages/toolsets/src/index.mjs`, clone helper, and include `tool_schemas` in `resolveToolsets()` as selected tool schemas sorted by name. Each entry must include `name`, `description`, `input_schema`, `toolsets`, `risk_level`, and `policy_permissions`; no secrets, prompts, endpoints, or credentials.

- [x] **Step 4: Run resolver test to verify GREEN**

Run: `node tests/tests_toolsets.mjs`

Expected: PASS with `{"ok":true,"test":"toolsets"}`.

## Task 3: Provider Request Projection

- [x] **Step 1: Write failing non-streaming provider assertions**

In `tests/tests_provider_proxy_chat.mjs`, assert the selected web tool schemas are sent:

```js
assert.equal(body.tools[0].type, 'function');
assert.equal(body.tools[0].function.name, 'web_extract');
assert.equal(body.tools[1].function.name, 'web_search');
assert.equal(body.tools[1].function.parameters.properties.query.type, 'string');
```

For Anthropic:

```js
assert.equal(body.tools[0].name, 'web_extract');
assert.equal(body.tools[1].name, 'web_search');
assert.equal(body.tools[1].input_schema.properties.query.type, 'string');
```

For OpenAI Responses:

```js
assert.equal(body.tools[0].type, 'function');
assert.equal(body.tools[0].name, 'web_extract');
assert.equal(body.tools[1].name, 'web_search');
assert.equal(body.tools[1].parameters.properties.query.type, 'string');
```

Pass `enabled_toolsets: ['web']` to each matching `executeProviderProxyChat()` call.

- [x] **Step 2: Run provider chat test to verify RED**

Run: `node tests/tests_provider_proxy_chat.mjs`

Expected: FAIL because request bodies do not include `tools`.

- [x] **Step 3: Implement provider projections**

Add a projection helper in `packages/provider-proxy/src/index.mjs`:

```js
function providerToolDefinitions(runtime, toolsetResolution) {
  const schemas = Array.isArray(toolsetResolution?.tool_schemas) ? toolsetResolution.tool_schemas : [];
  if (runtime.transport === 'anthropic_messages') {
    return schemas.map(tool => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.input_schema
    }));
  }
  if (runtime.transport === 'codex_responses') {
    return schemas.map(tool => ({
      type: 'function',
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
      strict: true
    }));
  }
  return schemas.map(tool => ({
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema
    }
  }));
}
```

Pass `toolsetResolution` into `buildTransportRequest()` and set `body.tools` when the projection is non-empty.

- [x] **Step 4: Run provider chat test to verify GREEN**

Run: `node tests/tests_provider_proxy_chat.mjs`

Expected: PASS with `{"ok":true,"test":"provider-proxy-chat"}`.

## Task 4: Streaming Uses Same Projection

- [x] **Step 1: Write failing stream assertions**

In `tests/tests_provider_proxy_stream.mjs`, pass `enabled_toolsets: ['web']` to the first Chat Completions stream test and assert:

```js
assert.equal(body.tools[0].type, 'function');
assert.equal(body.tools[1].function.name, 'web_search');
assert.equal(body.stream, true);
```

- [x] **Step 2: Run stream test**

Run: `node tests/tests_provider_proxy_stream.mjs`

Expected before implementation: FAIL. Expected after Task 3 implementation: PASS because stream and non-stream share `buildTransportRequest()`.

## Task 5: Contracts And Docs

- [x] **Step 1: Update contract schema and example**

Add `tool_schemas` to `packages/contracts/schemas/task.v1.json` under `toolset_resolution`. Update `packages/contracts/examples/task.valid.json` with the `web_search` schema.

- [x] **Step 2: Update docs**

Document that provider-chat now sends selected tool schemas to upstream providers but never executes returned tool calls automatically. Include current provider shape references in `packages/provider-proxy/README.md`.

- [x] **Step 3: Validate contracts**

Run: `pnpm run validate:contracts`

Expected: PASS. If local npm remains unavailable, use the cached Corepack pnpm path documented in the root README.

## Task 6: Verification And Publish

- [x] **Step 1: Run syntax checks**

Run:

```bash
node --check packages/toolsets/src/index.mjs
node --check packages/provider-proxy/src/index.mjs
```

Expected: both pass with no output.

- [x] **Step 2: Run focused tests**

Run:

```bash
pnpm run test:toolsets
pnpm run test:providers
```

Expected: both pass.

- [x] **Step 3: Run broad checks**

Run:

```bash
pnpm run validate:contracts
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})'
```

Expected: validation and tests pass; diff check passes; conflict-marker scan returns no matches.

- [ ] **Step 4: Commit and open PR**

Commit message:

```bash
git commit -m "feat: project provider tool schemas"
```

Push to `origin` and open a PR against `DivinityCode/Divinity-code:main`.

## Self-Review

- Spec coverage: README warning, selected tool schema metadata, non-streaming and streaming provider projection, contracts, and docs all map to tasks.
- Placeholder scan: no placeholder steps remain; each task has concrete files, commands, and expected outcomes.
- Type consistency: the plan consistently uses `tool_schemas`, `input_schema`, `parameters`, `tools`, and `toolset_resolution`.
