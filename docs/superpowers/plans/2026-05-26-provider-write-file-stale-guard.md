# Provider Write File Stale Guard Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden provider `write_file` tool execution with an optional `expected_sha256` precondition so approved writes cannot silently overwrite stale files.

**Architecture:** Keep the existing redacted provider tool execution record format and add a local pre-write hash check only when the operator-approved arguments include `expected_sha256`. The tool schema advertises the optional precondition, execution metadata records booleans instead of hashes or paths, and docs describe the guard as operator-controlled stale-write protection.

**Tech Stack:** Node.js ESM, provider tool execution package, toolset JSON Schema metadata, existing CLI/API provider tests, Markdown docs.

---

## File Map

- Modify `tests/tests_provider_tool_executions.mjs`: add red tests for `write_file` success with matching `expected_sha256`, failed stale write on mismatch, invalid precondition hash, and unchanged file content.
- Modify `tests/tests_toolsets.mjs`: assert the `write_file` schema exposes optional `expected_sha256`.
- Modify `packages/provider-tool-executions/src/index.mjs`: add SHA-256 hashing and enforce the optional precondition before writing.
- Modify `packages/toolsets/src/index.mjs`: add optional `expected_sha256` to `write_file` tool schema.
- Modify `packages/provider-tool-executions/README.md`: document the stale-write guard and redaction behavior.
- Modify `docs/ARCHITECTURE.md`: update provider tool execution architecture text.
- Modify `docs/PRODUCT_PLAN.md`: update Phase 3 toolset governance bootstrap status.
- Modify this plan file as tasks are completed.

## Task 1: Failing Provider Tool Execution Tests

- [x] **Step 1: Add stale-write tests**

In `tests/tests_provider_tool_executions.mjs`, import `createHash` from `crypto`, add a helper:

```js
function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}
```

Then add tests after the current successful `write_file` execution. The tests should:

- Create an existing file with `original guarded content`.
- Approve `write_file` with argument keys `['path', 'content', 'expected_sha256']`.
- Execute with the matching SHA-256 of the existing content and assert the write completes.
- Execute again with a stale SHA-256 and assert status `failed`, error mentions `expected_sha256`, metadata redacts content/path/hash, and file contents remain unchanged.
- Execute with an invalid `expected_sha256` value and assert status `failed` without writing.

- [x] **Step 2: Add tool schema test**

In `tests/tests_toolsets.mjs`, assert:

```js
assert.equal(writeFileSchema.input_schema.properties.expected_sha256.type, 'string');
assert.equal(writeFileSchema.input_schema.properties.expected_sha256.pattern, '^[a-f0-9]{64}$');
assert.deepEqual(writeFileSchema.input_schema.required, ['path', 'content']);
```

- [x] **Step 3: Verify red**

Run:

```bash
node tests/tests_provider_tool_executions.mjs
node tests/tests_toolsets.mjs
```

Expected: both fail because `expected_sha256` is not implemented or exposed yet.

## Task 2: Implement Optional SHA-256 Precondition

- [x] **Step 1: Add hashing helper**

In `packages/provider-tool-executions/src/index.mjs`, import `createHash` from `crypto` and add:

```js
function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function cleanExpectedSha256(value) {
  return cleanString(value);
}
```

- [x] **Step 2: Enforce precondition before write**

Inside `writeFileExecution()`, before `fs.mkdirSync()` or `fs.writeFileSync()`:

```js
const expectedSha256 = cleanExpectedSha256(argument_values.expected_sha256);
if (expectedSha256 && !/^[a-f0-9]{64}$/.test(expectedSha256)) {
  return executionEnvelope({
    run_id,
    approval,
    argument_keys,
    status: 'failed',
    adapter: 'write_file',
    actor,
    reason,
    started_at,
    completed_at,
    output_summary: 'write_file failed; content redacted',
    output_metadata: {
      path_redacted: true,
      content_redacted: true,
      expected_sha256_checked: true,
      expected_sha256_matched: false,
      expected_sha256_redacted: true
    },
    operator_summary,
    error: 'write_file expected_sha256 must be a lowercase 64-character sha256 hex digest',
    index
  });
}
if (expectedSha256) {
  let existingContent;
  try {
    existingContent = fs.readFileSync(target);
  } catch {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: {
        path_redacted: true,
        content_redacted: true,
        expected_sha256_checked: true,
        expected_sha256_matched: false,
        expected_sha256_redacted: true
      },
      operator_summary,
      error: 'write_file expected_sha256 target was unavailable',
      index
    });
  }
  if (sha256Bytes(existingContent) !== expectedSha256) {
    return executionEnvelope({
      run_id,
      approval,
      argument_keys,
      status: 'failed',
      adapter: 'write_file',
      actor,
      reason,
      started_at,
      completed_at,
      output_summary: 'write_file failed; content redacted',
      output_metadata: {
        path_redacted: true,
        content_redacted: true,
        expected_sha256_checked: true,
        expected_sha256_matched: false,
        expected_sha256_redacted: true
      },
      operator_summary,
      error: 'write_file expected_sha256 did not match current file content',
      index
    });
  }
}
```

For guarded completed writes, include:

```js
expected_sha256_checked: Boolean(expectedSha256),
expected_sha256_matched: Boolean(expectedSha256),
expected_sha256_redacted: Boolean(expectedSha256)
```

- [x] **Step 3: Expose optional schema property**

In `packages/toolsets/src/index.mjs`, add `expected_sha256` to `write_file.input_schema.properties`:

```js
expected_sha256: {
  type: 'string',
  pattern: '^[a-f0-9]{64}$',
  description: 'Optional sha256 digest of the current file content; when supplied, the write fails if the file changed after approval.'
}
```

Do not add it to `required`.

- [x] **Step 4: Verify green**

Run:

```bash
node tests/tests_provider_tool_executions.mjs
node tests/tests_toolsets.mjs
```

Expected: both pass.

## Task 3: Documentation Updates

- [x] **Step 1: Update package README**

In `packages/provider-tool-executions/README.md`, update the `write_file` bullet to mention the optional `expected_sha256` stale-write guard and that hashes are not copied into execution records.

- [x] **Step 2: Update architecture**

In `docs/ARCHITECTURE.md`, update the provider tool execution paragraph to mention `write_file` can require an approved `expected_sha256` match before writing, preserving path/content/hash redaction.

- [x] **Step 3: Update product plan**

In `docs/PRODUCT_PLAN.md`, update the Phase 3 toolset governance bootstrap status to include the `expected_sha256` stale-write guard.

## Task 4: Verification And Publish

- [x] **Step 1: Run focused checks**

```bash
node --check packages/provider-tool-executions/src/index.mjs
node --check packages/toolsets/src/index.mjs
node tests/tests_provider_tool_executions.mjs
node tests/tests_toolsets.mjs
pnpm run test:providers
pnpm run test:toolsets
```

- [x] **Step 2: Run release/public readiness checks**

```bash
pnpm run validate:contracts
pnpm run test:public-docs
pnpm run test:deprecations
pnpm run test:github-workflows
pnpm run test:smoke
pnpm test
git diff --check
if rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules'; then exit 1; else test "$?" -eq 1; fi
root_files=$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print); test -z "$root_files" && test ! -e .divinity.json && test ! -e .divinity-provider-limits.json && test ! -e .divinity-provider-usage.json
```

- [ ] **Step 3: Commit and publish**

Commit as:

```bash
git commit -m "feat: guard provider write-file execution"
```

Push branch `codex/provider-write-file-stale-guard`, open a ready PR against `main`, wait for GitHub `Contracts Validation` and `Release Readiness` checks, merge only when green, sync local `main`, and rerun:

```bash
pnpm run test:providers
```
