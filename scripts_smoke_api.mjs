import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

process.env.DIVINITY_API_AUTOSTART = '0';
const { server } = await import('./apps/api/src/server.mjs');

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-smoke-'));

try {
  const initResult = runCli(tmpDir, 'init');
  const configPath = path.join(tmpDir, '.divinity.json');
  assert(initResult.ok === true, 'CLI init did not return ok=true');
  assert(initResult.command === 'init', 'CLI init command name mismatch');
  assert(initResult.config_path === configPath, 'CLI init config path mismatch');
  assert(initResult.starter_recipes?.length >= 4, 'CLI init starter recipe count mismatch');
  assert(existsSync(configPath), 'CLI init did not create config in temp dir');

  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  assert(config.policy_id === 'safe_exec', 'CLI init policy_id mismatch');
  assert(config.budget?.soft_limit_usd === 2, 'CLI init soft budget mismatch');
  assert(config.budget?.hard_limit_usd === 5, 'CLI init hard budget mismatch');
  assert(config.scope?.org_id === 'default-org', 'CLI init org scope mismatch');
  assert(config.scope?.project_id === 'default-project', 'CLI init project scope mismatch');

  const runResult = runCli(tmpDir, 'run', 'smoke task');
  assert(runResult.ok === true, 'CLI run did not return ok=true');
  assert(runResult.command === 'run', 'CLI run command name mismatch');
  assert(/^run_/.test(runResult.run_id), 'CLI run_id mismatch');
  assert(runResult.status === 'queued', 'CLI run status mismatch');
  assert(runResult.preflight?.decision === 'allow', 'CLI run preflight decision mismatch');
  assert(runResult.task?.objective === 'smoke task', 'CLI run objective mismatch');
  assert(runResult.task?.repo === tmpDir, 'CLI run repo should be the temp dir');
  assert(runResult.task?.scope?.org_id === 'default-org', 'CLI run org scope mismatch');
  assert(runResult.task?.scope?.project_id === 'default-project', 'CLI run project scope mismatch');

  const recipesResult = runCli(tmpDir, 'recipes');
  assert(recipesResult.ok === true, 'CLI recipes did not return ok=true');
  assert(recipesResult.recipes?.length >= 4, 'CLI recipes count mismatch');

  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  const baseUrl = `http://127.0.0.1:${port}`;

  const healthRes = await fetch(`${baseUrl}/health`);
  assert(healthRes.status === 200, 'API health returned non-200 status');
  const health = await healthRes.json();
  assert(health.ok === true, 'API health did not return ok=true');

  const preflightRes = await fetch(`${baseUrl}/preflight`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      task_id: 'task_smoke',
      objective: 'Run a migration shell command',
      repo: 'github.com/org/repo',
      policy_id: 'safe_exec',
      budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
      created_at: '2026-05-24T00:00:00Z'
    })
  });
  assert(preflightRes.status === 200, 'API preflight returned non-200 status');
  const preflight = await preflightRes.json();
  assert(preflight.decision === 'requires_approval', 'API preflight decision mismatch');

  const createRes = await fetch(`${baseUrl}/tasks`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task_id: 'task_smoke' })
  });
  assert(createRes.status === 201, 'API task creation returned non-201 status');
  const run = await createRes.json();
  assert(run.task_id === 'task_smoke', 'API task creation task_id mismatch');
  assert(run.task?.scope?.org_id === 'default-org', 'API task creation org scope mismatch');
  assert(run.task?.scope?.project_id === 'default-project', 'API task creation project scope mismatch');
  assert(run.status === 'queued', 'API task creation status mismatch');
  assert(run.risk_level === 'low', 'API task creation risk_level mismatch');

  const getRunRes = await fetch(`${baseUrl}/runs/${run.run_id}`);
  assert(getRunRes.status === 200, 'API run retrieval returned non-200 status');
  const storedRun = await getRunRes.json();
  assert(storedRun.run_id === run.run_id, 'API run retrieval run_id mismatch');

  console.log(JSON.stringify({ ok: true, smoke: 'cli-api' }));
} finally {
  if (server.listening) {
    await new Promise((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }
  rmSync(tmpDir, { recursive: true, force: true });
}
