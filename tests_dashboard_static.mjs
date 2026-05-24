import assert from 'assert';
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('apps/dashboard/index.html', 'utf8');
const css = fs.readFileSync('apps/dashboard/styles.css', 'utf8');
const js = fs.readFileSync('apps/dashboard/app.js', 'utf8');

for (const status of ['all', 'queued', 'running', 'awaiting_approval', 'completed', 'failed']) {
  assert(html.includes(`data-filter="${status}"`), `missing ${status} filter`);
}

for (const selector of [
  'data-run-list',
  'data-event-timeline',
  'data-approval-list',
  'data-artifact-list',
  'data-audit-hash'
]) {
  assert(html.includes(selector), `missing ${selector}`);
}

for (const token of ['--indigo', '--teal', '--amber', '--red', '--row-height']) {
  assert(css.includes(token), `missing CSS token ${token}`);
}

const runDataMatch = js.match(/const runs = (\[[\s\S]*?\n\]);\n\nconst state =/);
assert(runDataMatch, 'dashboard sample run data not found');

const runs = vm.runInNewContext(runDataMatch[1], {
  event: (event_id, type, status, message, detail, created_at, duration) => ({
    event_id,
    run_id: '',
    type,
    status,
    message,
    metadata: { detail, duration },
    created_at
  }),
  artifact: (artifact_id, type, uri) => ({ artifact_id, run_id: '', type, uri })
});
const statuses = new Set(runs.map(run => run.status));
const riskLevels = new Set(runs.map(run => run.risk_level));

for (const status of ['queued', 'running', 'awaiting_approval', 'completed', 'failed']) {
  assert(statuses.has(status), `sample data missing ${status}`);
}

for (const risk of ['low', 'medium', 'high']) {
  assert(riskLevels.has(risk), `sample data missing ${risk} risk`);
}

assert(runs.some(run => run.status === 'awaiting_approval'), 'approval queue needs a pending run');
assert(runs.every(run => run.budget && Number.isFinite(run.budget.soft) && Number.isFinite(run.budget.hard)), 'runs need soft and hard budgets');
assert(runs.every(run => Array.isArray(run.events) && run.events.length > 0), 'runs need timelines');
assert(runs.some(run => run.artifacts.length > 0), 'at least one run needs artifacts');
assert(runs.every(run => /^[a-f0-9]{64}$/.test(run.audit.hash)), 'audit hashes must be sha256-like hex');

console.log(JSON.stringify({ ok: true, dashboard: 'static-shell', runs: runs.length }));
