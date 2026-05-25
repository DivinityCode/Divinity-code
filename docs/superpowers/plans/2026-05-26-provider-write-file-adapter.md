# Provider Write File Adapter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the first operator-gated provider tool execution adapter that can write repository files while preserving strict workspace containment, redacted records, and safe continuation context.

**Architecture:** Extend `packages/provider-tool-executions` with a `write_file` adapter selected only after an approved provider tool-call approval whose fresh operator-supplied argument keys exactly match the approval. The adapter writes full replacement content inside the configured workspace and returns only safe counts and redaction flags; API and CLI keep using the existing generic execution path.

**Tech Stack:** Node.js ESM, built-in `fs`/`path`, existing provider tool approval/execution contracts, existing CLI/API provider tool execution surfaces.

---

### Task 1: Package-Level Write Adapter

**Files:**
- Modify: `tests/tests_provider_tool_executions.mjs`
- Modify: `packages/provider-tool-executions/src/index.mjs`

- [ ] **Step 1: Write the failing test**

Add a `write_file` approval and execution assertion to `tests/tests_provider_tool_executions.mjs`:

```js
const secretWritePath = path.join('secret-write-scope', 'secret-write-target.md');
const secretWriteContents = 'secret provider write file contents';
mkdirSync(path.join(workspaceRoot, 'secret-write-scope'), { recursive: true });

const writeApproval = createProviderToolCallApproval({
  run_id: 'run_tool_execution',
  tool_call_id: 'call_write_file_1',
  provider_id: 'custom_openai_compatible',
  transport: 'chat_completions',
  name: 'write_file',
  argument_keys: ['path', 'content'],
  arguments_redacted: true,
  decision: 'approve',
  actor: 'operator@example.com',
  reason: 'Repository file write is approved.',
  decided_at: '2026-05-26T12:04:00Z',
  index: 8
});

const writeExecution = createProviderToolExecution({
  run_id: 'run_tool_execution',
  approval: writeApproval,
  argument_values: { path: secretWritePath, content: secretWriteContents },
  workspace_root: workspaceRoot,
  actor: 'operator@example.com',
  reason: 'Execute the approved redacted repository write.',
  operator_summary: 'Operator reviewed the write request: safe replacement content is approved.',
  started_at: '2026-05-26T12:04:01Z',
  completed_at: '2026-05-26T12:04:02Z',
  index: 8
});

assert.equal(writeExecution.status, 'completed');
assert.equal(writeExecution.adapter, 'write_file');
assert.deepEqual(writeExecution.argument_keys, ['content', 'path']);
assert.equal(writeExecution.output_redacted, true);
assert.deepEqual(writeExecution.output_metadata, {
  bytes_written: 35,
  line_count: 1,
  path_redacted: true,
  content_redacted: true
});
assert.equal(readFileSync(path.join(workspaceRoot, secretWritePath), 'utf8'), secretWriteContents);
assert.equal(JSON.stringify(writeExecution).includes(secretWritePath), false);
assert.equal(JSON.stringify(writeExecution).includes(secretWriteContents), false);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/tests_provider_tool_executions.mjs`

Expected: FAIL because `write_file` is still handled by the unsupported adapter.

- [ ] **Step 3: Write minimal implementation**

Add a `writeFileExecution()` helper in `packages/provider-tool-executions/src/index.mjs` that:

```js
const root = path.resolve(cleanString(workspace_root) || process.cwd());
const target = path.resolve(root, cleanString(argument_values.path));
const content = String(argument_values.content ?? '');
```

The helper must:
- reject empty paths, target equal to root, path traversal, and writes outside the workspace;
- create the parent directory with `fs.mkdirSync(path.dirname(target), { recursive: true })`;
- write content with `fs.writeFileSync(target, content, 'utf8')`;
- return `bytes_written`, `line_count`, `path_redacted: true`, and `content_redacted: true`;
- never include raw path or content in summaries, metadata, or errors.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/tests_provider_tool_executions.mjs`

Expected: PASS and print `{"ok":true,"test":"provider-tool-executions"}`.

### Task 2: API/CLI Coverage

**Files:**
- Modify: `tests/tests_api_provider_proxy_chat.mjs`
- Modify: `tests/tests_cli_provider_proxy_chat.mjs`

- [ ] **Step 1: Add API test coverage**

Extend the existing provider tool execution route test with an approved `write_file` call:

```js
const writeExecutionResponse = await requestJson(`${baseUrl}/runs/${approvalRun.run_id}/provider-tool-executions`, {
  method: 'POST',
  body: {
    approval_id: writeApprovalBody.approval.approval_id,
    argument_values: { path: 'generated/write-target.md', content: 'approved generated content' },
    workspace_root: apiWorkspaceRoot,
    reason: 'Execute approved write file request.'
  }
});
assert.equal(writeExecutionResponse.body.execution.adapter, 'write_file');
assert.equal(writeExecutionResponse.body.execution.output_metadata.content_redacted, true);
assert.equal(writeExecutionResponse.body.execution.output_metadata.path_redacted, true);
```

- [ ] **Step 2: Add CLI test coverage**

Extend the local `provider-tool-execute` coverage in `tests/tests_cli_provider_proxy_chat.mjs` with `--name write_file --argument path=... --argument content=...`.

- [ ] **Step 3: Run test to verify it fails before implementation or passes after Task 1**

Run:

```bash
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
```

Expected after Task 1: both pass with `write_file` adapter output metadata redacted.

### Task 3: Continuation Context Metadata

**Files:**
- Modify: `packages/provider-proxy/src/index.mjs`
- Modify: `tests/tests_provider_proxy_chat.mjs`

- [ ] **Step 1: Write failing continuation test**

Add a `write_file` execution record to the continuation fixture in `tests/tests_provider_proxy_chat.mjs` and assert the continuation includes the tool name and safe write counts while excluding raw paths and content.

- [ ] **Step 2: Run test to verify it fails**

Run: `node tests/tests_provider_proxy_chat.mjs`

Expected: FAIL because `bytes_written` and safe write metadata are not yet forwarded.

- [ ] **Step 3: Implement safe metadata allowlist**

Update `packages/provider-proxy/src/index.mjs` so redacted continuation metadata allows `bytes_written`, `line_count`, `path_redacted`, and `content_redacted` for `write_file` records.

- [ ] **Step 4: Run test to verify it passes**

Run: `node tests/tests_provider_proxy_chat.mjs`

Expected: PASS and no raw path or content appears in serialized results.

### Task 4: Docs and Contracts

**Files:**
- Modify: `packages/provider-tool-executions/README.md`
- Modify: `apps/cli/README.md`
- Modify: `apps/api/README.md`
- Modify: `packages/provider-proxy/README.md`
- Modify: `docs/FREE_LLM_PROVIDER_RESEARCH.md`
- Modify: `docs/PRODUCT_PLAN.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `packages/contracts/examples/provider-tool-execution.valid.json`

- [ ] **Step 1: Update public docs**

State that `write_file` is operator-gated, uses fresh argument values, writes only inside the workspace, and stores/forwards only byte/line counts plus redaction flags.

- [ ] **Step 2: Update the contract example**

Change the provider tool execution valid example to include a `write_file` record or add safe write metadata while still satisfying `provider-tool-execution.v1.json`.

- [ ] **Step 3: Run docs/contract verification**

Run:

```bash
node tests/scripts_validate_contracts.mjs
node tests/tests_deprecation_audit.mjs
```

Expected: PASS.

### Task 5: Final Verification and Publish

**Files:**
- Verify all changed files.

- [ ] **Step 1: Run syntax checks**

Run:

```bash
node --check packages/provider-tool-executions/src/index.mjs
node --check packages/provider-proxy/src/index.mjs
node --check apps/api/src/server.mjs
node --check apps/cli/src/index.mjs
```

- [ ] **Step 2: Run focused tests**

Run:

```bash
node tests/tests_provider_tool_executions.mjs
node tests/tests_provider_proxy_chat.mjs
node tests/tests_api_provider_proxy_chat.mjs
node tests/tests_cli_provider_proxy_chat.mjs
```

- [ ] **Step 3: Run broader provider and quality checks**

Run:

```bash
pnpm run validate:contracts
pnpm run test:providers
pnpm run test:api
pnpm run test:cli
pnpm run test:deprecations
git diff --check
rg -n '^(<{7}|={7}|>{7})'
```

Expected: all checks pass and conflict-marker scan returns no matches.

- [ ] **Step 4: Commit, push, and open PR**

Commit message: `feat: add provider write file adapter`

Open a draft PR against `main` summarizing the operator-gated write adapter, redaction guarantees, docs updates, and verification output.
