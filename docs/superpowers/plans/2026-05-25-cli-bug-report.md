# CLI Bug Report Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a structured `divinity bug` command that produces a GitHub-ready bug report with local diagnostics and git context.

**Architecture:** Keep bug reporting CLI-only in this slice. Reuse the existing doctor checks for environment evidence, add a small git context helper, and return a contract-shaped `divinity.bug_report.v1` payload plus Markdown body. Add a JSON Schema and examples so the report stays stable for future API or dashboard use.

**Tech Stack:** Node ESM CLI, built-in `spawnSync`, AJV contract validation, existing CLI package-script test conventions.

---

### Task 1: RED Tests And Contract Examples

**Files:**
- Create: `tests/tests_cli_bug.mjs`
- Create: `packages/contracts/schemas/bug-report.v1.json`
- Create: `packages/contracts/examples/bug-report.valid.json`
- Create: `packages/contracts/examples/bug-report.invalid.json`
- Modify: `tests/scripts_validate_contracts.mjs`
- Modify: `package.json`

- [x] **Step 1: Add CLI bug test**

Assert that `divinity bug "Dashboard does not load"` returns:

```js
assert.equal(result.ok, true);
assert.equal(result.command, 'bug');
assert.equal(result.report.format, 'divinity.bug_report.v1');
assert.equal(result.report.summary, 'Dashboard does not load');
assert.match(result.report.title, /Dashboard does not load/);
assert.equal(result.report.git.branch, 'main');
assert.ok(Array.isArray(result.report.diagnostics.checks));
assert.ok(result.report.diagnostics.checks.some(check => check.check_id === 'node'));
assert.match(result.report.markdown, /## Summary/);
assert.match(result.report.markdown, /Dashboard does not load/);
```

- [x] **Step 2: Add contract examples and validation wiring**

Add `BugReport` schema/examples to `packages/contracts` and add valid/invalid checks to `tests/scripts_validate_contracts.mjs`.

- [x] **Step 3: Run RED**

Run:

```bash
node tests/tests_cli_bug.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: CLI test fails because `bug` is not a recognized command; contract validation fails until schema/example files exist and are wired.

### Task 2: Implementation

**Files:**
- Modify: `apps/cli/src/index.mjs`

- [x] **Step 1: Refactor doctor checks**

Extract the current `doctor()` check construction into:

```js
function buildDoctorChecks() {
  const npmCheck = optionalCommandCheck('npm', 'npm', ['--version']);
  const pnpmCheck = cachedPnpmCheck();
  const dockerCheck = optionalCommandCheck('docker', 'docker', ['--version']);
  return [
    { check_id: 'node', ok: true, required: true, summary: process.version },
    npmCheck,
    pnpmCheck,
    packageManagerCheck(npmCheck, pnpmCheck),
    dockerCheck,
    commandCheck('git', 'git', ['--version']),
    fileCheck('package_json', path.join(cwd, 'package.json')),
    directoryCheck('node_modules', path.join(cwd, 'node_modules')),
    dependencyCheck('ajv_dependencies', ['ajv', 'ajv-cli', 'ajv-formats']),
    fileCheck('api_server_source', path.join(cwd, 'apps/api/src/server.mjs'))
  ];
}
```

- [x] **Step 2: Add git context and Markdown helpers**

Capture `branch`, `head`, and `status_short` with non-throwing `git` commands. Render Markdown with summary, environment, git, and diagnostic sections.

- [x] **Step 3: Add `bug` command**

Parse remaining args as the summary, default to `Bug report`, and print:

```js
{
  ok: true,
  command: 'bug',
  report: {
    format: 'divinity.bug_report.v1',
    title,
    summary,
    created_at,
    cwd,
    environment,
    git,
    diagnostics,
    markdown
  }
}
```

- [x] **Step 4: Run GREEN**

Run:

```bash
node tests/tests_cli_bug.mjs
node tests/scripts_validate_contracts.mjs
```

Expected: both commands pass.

### Task 3: Documentation And Research Refresh

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/contracts/CHANGELOG.md`
- Modify: `docs/superpowers/plans/2026-05-25-cli-bug-report.md`

- [x] **Step 1: Update docs**

Document `bug` in CLI command lists and note that the research release table was refreshed on 2026-05-25 with the same latest observed releases. Add a build-slice entry for structured bug reporting.

- [x] **Step 2: Mark plan checkboxes complete**

Update this plan as each task completes.

### Task 4: Verification And Publication

**Files:**
- No production edits after this point unless verification gives actionable failures.

- [x] **Step 1: Focused checks**

Run:

```bash
node --check apps/cli/src/index.mjs
node --check tests/tests_cli_bug.mjs
node tests/tests_cli_bug.mjs
node tests/scripts_validate_contracts.mjs
pnpm run test:cli
```

- [x] **Step 2: Repository checks**

Run:

```bash
pnpm test
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
```

- [x] **Step 3: Publish**

Commit as `feat: add cli bug report command`, push `codex/add-cli-bug-report`, open a PR, and merge after GitHub Actions passes.

Completed on `main` in commit `b27fce2`.
