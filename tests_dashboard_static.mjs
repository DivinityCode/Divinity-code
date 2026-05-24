import assert from 'assert';
import fs from 'fs';
import vm from 'vm';

const html = fs.readFileSync('apps/dashboard/index.html', 'utf8');
const css = fs.readFileSync('apps/dashboard/styles.css', 'utf8');
const js = fs.readFileSync('apps/dashboard/app.js', 'utf8');

for (const status of ['all', 'queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed']) {
  assert(html.includes(`data-filter="${status}"`), `missing ${status} filter`);
}

for (const selector of [
  'data-run-list',
  'data-event-timeline',
  'data-decision-trace',
  'data-approval-list',
  'data-artifact-list',
  'data-audit-hash'
]) {
  assert(html.includes(selector), `missing ${selector}`);
}

for (const token of ['--indigo', '--teal', '--amber', '--red', '--row-height']) {
  assert(css.includes(token), `missing CSS token ${token}`);
}

for (const selector of ['claim-observed', 'claim-inferred']) {
  assert(css.includes(selector), `missing ${selector} style`);
}
assert(css.includes('decision-trace'), 'missing decision trace styles');

const runDataMatch = js.match(/const sampleRuns = (\[[\s\S]*?\n\]);\n\nlet runs =/);
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
  evidence: (claim_type, source, summary) => ({ claim_type, source, summary }),
  artifact: (artifact_id, type, uri) => ({ artifact_id, run_id: '', type, uri }),
  decisionTrace: (chosen_path, rejected_alternative, rationale, evidence_refs = []) => ({
    chosen_path,
    rejected_alternative,
    rationale,
    evidence_refs
  })
});
const statuses = new Set(runs.map(run => run.status));
const riskLevels = new Set(runs.map(run => run.risk_level));

for (const status of ['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed']) {
  assert(statuses.has(status), `sample data missing ${status}`);
}

for (const risk of ['low', 'medium', 'high']) {
  assert(riskLevels.has(risk), `sample data missing ${risk} risk`);
}

assert(runs.some(run => run.status === 'awaiting_approval'), 'approval queue needs a pending run');
assert(runs.every(run => run.budget && Number.isFinite(run.budget.soft) && Number.isFinite(run.budget.hard)), 'runs need soft and hard budgets');
assert(runs.every(run => Array.isArray(run.events) && run.events.length > 0), 'runs need timelines');
assert(runs.every(run => run.decision_trace?.chosen_path && run.decision_trace?.rejected_alternative), 'runs need decision traces');
assert(js.includes('claim_type'), 'dashboard sample data should include fact/inference labels');
assert(js.includes('renderEvidenceLabels'), 'dashboard should render evidence labels');
assert(js.includes('renderDecisionTrace'), 'dashboard should render decision trace panel');
assert(js.includes('Observed') && js.includes('Inferred'), 'dashboard should show observed/inferred label text');
assert(runs.some(run => run.artifacts.length > 0), 'at least one run needs artifacts');
assert(runs.every(run => /^[a-f0-9]{64}$/.test(run.audit.hash)), 'audit hashes must be sha256-like hex');
assert(js.includes('new URLSearchParams(window.location.search)'), 'dashboard should read API query parameter');
assert(js.includes('fetch(`${base}/runs`)'), 'dashboard should load API runs');
assert(js.includes('fetch(`${base}/runs/${runId}/approval`'), 'dashboard should post approval decisions to API');
assert(js.includes('new EventSource(`${base}/runs/${runId}/stream`)'), 'dashboard should subscribe to API run stream');

console.log(JSON.stringify({ ok: true, dashboard: 'static-shell', runs: runs.length }));
