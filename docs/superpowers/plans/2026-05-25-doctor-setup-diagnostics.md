# Doctor Setup Diagnostics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Make `divinity doctor` report actionable setup readiness when `npm` is missing but a usable pnpm/Corepack fallback and installed AJV dependencies are available.

**Architecture:** Keep `doctor` as a CLI-only structured JSON command. Extend the existing check model with optional package-manager command probes plus required aggregate checks for package-manager readiness, installed dependencies, and contract validator dependencies. Overall doctor status should only fail required checks, so an optional missing `npm` does not block local development when pnpm is available.

**Tech Stack:** Node ESM, `child_process.spawnSync`, filesystem checks, existing CLI tests.

---

### Task 1: RED Tests For Setup Diagnostics

**Files:**
- Modify: `tests/tests_cli_doctor.mjs`

- [x] **Step 1: Add failing doctor assertions**

Add assertions that `doctor` includes the following checks:

```js
for (const checkId of [
  'node',
  'npm',
  'pnpm',
  'package_manager',
  'package_json',
  'node_modules',
  'ajv_dependencies',
  'api_server_source'
]) {
  assert.ok(checksById.has(checkId), `missing diagnostic check: ${checkId}`);
}
```

Update the overall status assertion:

```js
assert.equal(result.ok, result.checks.every(check => !check.required || check.ok));
```

Add:

```js
assert.equal(checksById.get('npm').required, false);
assert.equal(checksById.get('pnpm').required, false);
assert.equal(checksById.get('package_manager').required, true);
assert.equal(checksById.get('node_modules').ok, true);
assert.equal(checksById.get('ajv_dependencies').ok, true);
assert.match(checksById.get('package_manager').summary, /(npm|pnpm)/);
assert.match(checksById.get('ajv_dependencies').summary, /ajv/);
```

- [x] **Step 2: Run RED**

Run:

```bash
node tests/tests_cli_doctor.mjs
```

Expected: FAIL with `missing diagnostic check: pnpm`.

### Task 2: Implement Doctor Checks

**Files:**
- Modify: `apps/cli/src/index.mjs`

- [x] **Step 1: Add optional command checks and required aggregate checks**

Change `commandCheck(...)` to accept `{ required = true }`. Add helpers:

```js
function optionalCommandCheck(check_id, executable, values = []) {
  return commandCheck(check_id, executable, values, { required: false });
}
```

Add cached pnpm detection for local Corepack installs:

```js
function cachedPnpmCheck() {
  const home = process.env.HOME || '';
  const candidate = path.join(home, '.cache/node/corepack/v1/pnpm/9.15.4/bin/pnpm.cjs');
  if (!fs.existsSync(candidate)) return optionalCommandCheck('pnpm', 'pnpm', ['--version']);
  const result = spawnSync(process.execPath, [candidate, '--version'], { encoding: 'utf8' });
  return {
    check_id: 'pnpm',
    ok: result.status === 0,
    required: false,
    summary: `${candidate} ${`${result.stdout || result.stderr || result.error?.message || ''}`.trim()}`
  };
}
```

Add required aggregate checks:

```js
function packageManagerCheck(npmCheck, pnpmCheck) {
  const available = [npmCheck, pnpmCheck].filter(check => check.ok);
  return {
    check_id: 'package_manager',
    ok: available.length > 0,
    required: true,
    summary: available.length ? available.map(check => check.check_id).join(', ') : 'no npm or pnpm executable available'
  };
}

function directoryCheck(check_id, directoryPath) {
  return {
    check_id,
    ok: fs.existsSync(directoryPath) && fs.statSync(directoryPath).isDirectory(),
    required: true,
    summary: directoryPath
  };
}

function dependencyCheck(check_id, packageNames) {
  const missing = packageNames.filter(name => !fs.existsSync(path.join(cwd, 'node_modules', name)));
  return {
    check_id,
    ok: missing.length === 0,
    required: true,
    summary: missing.length ? `missing: ${missing.join(', ')}` : `installed: ${packageNames.join(', ')}`
  };
}
```

Set overall doctor status with required-only semantics:

```js
ok: checks.every(check => !check.required || check.ok)
```

- [x] **Step 2: Run GREEN**

Run:

```bash
node tests/tests_cli_doctor.mjs
```

Expected: `{"ok":true,"test":"cli-doctor"}`.

### Task 3: Documentation

**Files:**
- Modify: `apps/cli/README.md`
- Modify: `README.md`
- Modify: `docs/MVP_BACKLOG.md`
- Modify: `docs/REPOSITORY_RESEARCH.md`

- [x] **Step 1: Update docs**

Document that `doctor` reports Node, optional npm, optional pnpm/Corepack fallback, aggregate package-manager readiness, installed dependencies, AJV validator dependencies, git, package manifest, and API source readiness. In the repository README, add the cached pnpm command pattern for environments where `npm` is unavailable.

- [x] **Step 2: Run focused checks**

Run:

```bash
node tests/tests_cli_doctor.mjs
node --check apps/cli/src/index.mjs
```

Expected: both commands exit 0.

### Task 4: Ship The Slice

**Files:**
- All modified files from tasks 1-3

- [x] **Step 1: Run broader verification**

Run:

```bash
node --check apps/cli/src/index.mjs
node --check tests/tests_cli_doctor.mjs
node -e "const fs=require('fs'); const cp=require('child_process'); const out=cp.execFileSync('rg',['--files','-g','*.json'],{encoding:'utf8'}).trim(); const files=out ? out.split(/\n/).filter(Boolean) : []; for (const f of files) JSON.parse(fs.readFileSync(f,'utf8')); console.log(JSON.stringify({ok:true,json_files:files.length}));"
git diff --check
rg -n '^(<{7}|={7}|>{7})' . --glob '!node_modules' --glob '!.git'
pnpm run test:cli
pnpm test
```

Expected: all commands exit 0; marker scan returns no matches.

- [x] **Step 2: Commit, push, PR, merge**

```bash
git add .
git commit -m "feat: expand doctor setup diagnostics"
git push -u origin codex/add-doctor-setup-diagnostics
```

Open a ready PR to `main`, wait for GitHub Actions, merge if green, sync `main`, delete the branch, and rerun post-merge verification.

Completed on `main` in commit `218aa03`.

## Self-Review

- Spec coverage: This plan turns the research takeaway “installer and environment diagnostics are MVP work” into concrete CLI behavior, docs, focused tests, and full publish flow.
- Placeholder scan: No placeholder tasks remain.
- Type consistency: Check IDs are consistently `node`, `npm`, `pnpm`, `package_manager`, `package_json`, `node_modules`, `ajv_dependencies`, `git`, and `api_server_source`.
