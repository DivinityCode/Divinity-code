# Task Success Criteria Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add first-class task success criteria so CLI and API runs can carry explicit acceptance signals in addition to the objective.

**Architecture:** Treat `success_criteria` as optional Task contract data with an array of non-empty strings. The CLI parses repeated flags into task payloads; the API preserves submitted criteria through stored run state and downstream run context without changing existing routes.

**Tech Stack:** Node.js ESM, built-in `assert`, JSON Schema draft 2020-12, AJV contract validation.

---

### Task 1: RED Tests For CLI And API Criteria

**Files:**
- Create: `tests/tests_cli_success_criteria.mjs`
- Create: `tests/tests_api_success_criteria.mjs`
- Modify: `package.json`

- [x] **Step 1: Write the failing CLI test**

Create `tests/tests_cli_success_criteria.mjs`:

```js
import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-criteria-test-'));

try {
  runCli(tmpDir, 'init');
  const result = runCli(
    tmpDir,
    'run',
    '--criteria',
    'All contract examples validate',
    '--success-criteria=Smoke test leaves no repo config behind',
    'Stabilize',
    'bootstrap',
    'checks'
  );

  assert.equal(result.ok, true);
  assert.equal(result.command, 'run');
  assert.equal(result.task.objective, 'Stabilize bootstrap checks');
  assert.deepEqual(result.task.success_criteria, [
    'All contract examples validate',
    'Smoke test leaves no repo config behind'
  ]);

  console.log(JSON.stringify({ ok: true, test: 'cli-success-criteria' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
```

- [x] **Step 2: Write the failing API test**

Create `tests/tests_api_success_criteria.mjs`:

```js
import assert from 'assert/strict';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('../apps/api/src/server.mjs');

async function requestJson(url, options = {}) {
  const response = await fetch(url, {
    headers: { 'content-type': 'application/json', ...options.headers },
    ...options
  });
  return { response, body: await response.json() };
}

const task = {
  task_id: 'task_success_criteria',
  objective: 'Read the repository README',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  success_criteria: [
    'Return a concise summary',
    'Do not mutate repository files'
  ],
  created_at: '2026-05-25T00:00:00Z'
};

try {
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const { response, body: run } = await requestJson(`${baseUrl}/tasks`, {
    method: 'POST',
    body: JSON.stringify(task)
  });

  assert.equal(response.status, 201);
  assert.deepEqual(run.task.success_criteria, task.success_criteria);

  const { body: storedRun } = await requestJson(`${baseUrl}/runs/${run.run_id}`);
  assert.deepEqual(storedRun.task.success_criteria, task.success_criteria);

  console.log(JSON.stringify({ ok: true, test: 'api-success-criteria' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
}
```

- [x] **Step 3: Register the tests**

Modify `package.json` so:

```json
"test:cli": "node tests/tests_cli_init.mjs && node tests/tests_cli_preflight.mjs && node tests/tests_cli_recipes.mjs && node tests/tests_cli_capabilities.mjs && node tests/tests_cli_connector_references.mjs && node tests/tests_cli_success_criteria.mjs && node tests/tests_cli_agent_activity.mjs && node tests/tests_cli_doctor.mjs && node tests/tests_cli_bug.mjs",
"test:api": "node tests/tests_api_preflight.mjs && node tests/tests_api_auth.mjs && node tests/tests_api_approval.mjs && node tests/tests_api_runs_list.mjs && node tests/tests_api_run_store.mjs && node tests/tests_api_workspaces.mjs && node tests/tests_api_event_stream.mjs && node tests/tests_api_steps.mjs && node tests/tests_api_execution.mjs && node tests/tests_api_execution_locks.mjs && node tests/tests_api_verification.mjs && node tests/tests_api_heartbeats.mjs && node tests/tests_api_observability.mjs && node tests/tests_api_capabilities.mjs && node tests/tests_api_connectors.mjs && node tests/tests_api_success_criteria.mjs && node tests/tests_api_agent_activity.mjs",
"test:criteria": "node tests/tests_cli_success_criteria.mjs && node tests/tests_api_success_criteria.mjs"
```

Also insert both test files into the top-level `test` script next to the related CLI/API groups.

- [x] **Step 4: Run tests to verify RED**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_cli_success_criteria.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_api_success_criteria.mjs
```

Expected: CLI test fails because the flag text is folded into `objective` and `task.success_criteria` is missing. API test may pass before implementation because unknown task fields are currently preserved; if so, keep it as a regression test for API persistence.

### Task 2: Implement Task Success Criteria

**Files:**
- Modify: `apps/cli/src/index.mjs`
- Modify: `packages/contracts/schemas/task.v1.json`
- Modify: `packages/contracts/examples/task.valid.json`
- Modify: `packages/contracts/examples/task.invalid.json`

- [x] **Step 1: Parse repeated criteria flags**

Update `parseRunArgs(values)` so it tracks `successCriteria` alongside connector references:

```js
function parseRunArgs(values) {
  const objectiveParts = [];
  const connectorReferences = [];
  const successCriteria = [];

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    if (value === '--connector') {
      connectorReferences.push(parseConnectorReferenceFlag(values[index + 1]));
      index += 1;
    } else if (value.startsWith('--connector=')) {
      connectorReferences.push(parseConnectorReferenceFlag(value.slice('--connector='.length)));
    } else if (value === '--criteria' || value === '--success-criteria') {
      successCriteria.push(String(values[index + 1] || '').trim());
      index += 1;
    } else if (value.startsWith('--criteria=')) {
      successCriteria.push(value.slice('--criteria='.length).trim());
    } else if (value.startsWith('--success-criteria=')) {
      successCriteria.push(value.slice('--success-criteria='.length).trim());
    } else {
      objectiveParts.push(value);
    }
  }

  return {
    objective: objectiveParts.join(' ').trim() || 'No objective provided',
    connector_references: connectorReferences,
    success_criteria: successCriteria.filter(Boolean)
  };
}
```

- [x] **Step 2: Include criteria in CLI task payloads**

In `run()`, add:

```js
success_criteria: parsedArgs.success_criteria,
```

to the task payload near `objective`.

- [x] **Step 3: Extend the Task schema**

Add optional `success_criteria` under Task schema properties:

```json
"success_criteria": {
  "type": "array",
  "items": { "type": "string", "minLength": 1 }
}
```

- [x] **Step 4: Update contract examples**

Update `packages/contracts/examples/task.valid.json` to include:

```json
"success_criteria": ["Auth tests pass", "Public API remains compatible"]
```

Update `packages/contracts/examples/task.invalid.json` to include all required fields but use:

```json
"success_criteria": [""]
```

Expected: invalid example fails because empty success criteria are not allowed.

- [x] **Step 5: Run focused GREEN checks**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_cli_success_criteria.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/tests_api_success_criteria.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node tests/scripts_validate_contracts.mjs
```

Expected: all pass.

### Task 3: Documentation And Research Trace

**Files:**
- Modify: `README.md`
- Modify: `apps/cli/README.md`
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`
- Modify: `packages/contracts/CHANGELOG.md`

- [x] **Step 1: Document the CLI flag**

Add a CLI behavior note:

```markdown
- `run --criteria "All tests pass" --success-criteria "Docs updated" "Implement policy trace"` attaches explicit task success criteria to the emitted Task payload and downstream run context.
```

- [x] **Step 2: Update architecture language**

Change the Task domain object to mention success criteria and add a Builder CLI note that criteria travel with the shared Task contract.

- [x] **Step 3: Update backlog and research**

Add a current implementation note that CLI/API task creation preserves success criteria. In repository research, add this adopted slice under Build Slices Adopted From Research because it responds to goal/subgoal signals in Codex, Hermes, and Paperclip.

- [x] **Step 4: Update contract changelog**

Add:

```markdown
## v1.29.0
- Added optional Task `success_criteria` arrays for explicit run acceptance signals.
```

### Task 4: Verification And Publication

**Files:**
- No new files beyond implementation changes.

- [x] **Step 1: Run syntax and JSON checks**

Run:

```bash
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check apps/cli/src/index.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check apps/api/src/server.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check tests/scripts_validate_contracts.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node --check tests/scripts_smoke_api.mjs
/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282/node -e "const fs=require('fs'); for (const file of ['package.json', ...fs.readdirSync('packages/contracts/examples').map(f => 'packages/contracts/examples/' + f), ...fs.readdirSync('packages/contracts/schemas').map(f => 'packages/contracts/schemas/' + f)]) JSON.parse(fs.readFileSync(file, 'utf8')); console.log('json ok')"
```

Expected: every command exits 0.

- [x] **Step 2: Run focused package checks**

Run:

```bash
NODE_DIR=/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282
PNPM=/home/danie/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs
PATH="$NODE_DIR:$PATH" "$NODE_DIR/node" "$PNPM" test:criteria
PATH="$NODE_DIR:$PATH" "$NODE_DIR/node" "$PNPM" validate:contracts
```

Expected: both scripts exit 0.

- [x] **Step 3: Run full project test**

Run:

```bash
NODE_DIR=/home/danie/.vscode-server/bin/f6cfa2ea2403534de03f069bdf160d06451ed282
PNPM=/home/danie/.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs
PATH="$NODE_DIR:$PATH" "$NODE_DIR/node" "$PNPM" test
```

Expected: full suite exits 0.

- [x] **Step 4: Run hygiene checks**

Run:

```bash
rg -n '^(<{7}|={7}|>{7})'
git diff --check
test -z "$(find . -maxdepth 1 -type f \( -name 'tests_*.mjs' -o -name 'scripts_*.mjs' \) -print)"
```

Expected: no conflict markers, no whitespace errors, no root test/script entrypoints.

- [ ] **Step 5: Commit and open draft PR**

Run:

```bash
git status --short
git add apps/cli/src/index.mjs package.json packages/contracts/schemas/task.v1.json packages/contracts/examples/task.valid.json packages/contracts/examples/task.invalid.json tests/tests_cli_success_criteria.mjs tests/tests_api_success_criteria.mjs README.md apps/cli/README.md docs/ARCHITECTURE.md docs/MVP_BACKLOG.md docs/REPOSITORY_RESEARCH.md packages/contracts/CHANGELOG.md docs/superpowers/plans/2026-05-25-success-criteria.md
git commit -m "feat: add task success criteria"
git push -u origin codex/add-success-criteria
```

Expected: commit and push succeed. Open a draft PR against `main` with a summary of schema, CLI/API, docs, and validation output.
