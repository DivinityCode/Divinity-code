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
  'data-operator-control-list',
  'data-goal-list',
  'data-approval-revision',
  'data-approval-comment-list',
  'data-connector-reference-list',
  'data-agent-activity-list',
  'data-execution-list',
  'data-approval-list',
  'data-observability-summary',
  'data-liveness-summary',
  'data-failure-taxonomy',
  'data-scope-rollups',
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
  agentActivity: (activity_id, role, status, budget_estimate_usd) => ({
    activity_id,
    run_id: '',
    role,
    actor_id: `${role}@divinity`,
    action: `${role} activity`,
    reason: `${role} activity reason`,
    status,
    budget_estimate_usd,
    evidence_refs: []
  }),
  evidence: (claim_type, source, summary) => ({ claim_type, source, summary }),
  artifact: (artifact_id, type, uri) => ({ artifact_id, run_id: '', type, uri }),
  heartbeat: (heartbeat_id, run_id, actor, status, message, recorded_at) => ({
    heartbeat_id,
    run_id,
    actor,
    status,
    message,
    recorded_at
  }),
  verification: (verification_id, execution_id, step_id, result) => ({
    verification_id,
    execution_id,
    step_id,
    status: 'completed',
    result
  }),
  decisionTrace: (chosen_path, rejected_alternative, rationale, evidence_refs = []) => ({
    chosen_path,
    rejected_alternative,
    rationale,
    evidence_refs
  }),
  connectorReference: (reference_id, adapter, resource_type, resource_id, url = '') => ({
    format: 'divinity.connector_reference.v1',
    reference_id,
    run_id: '',
    adapter,
    resource_type,
    resource_id,
    url,
    attached_by: 'operator@divinity',
    attached_at: '2026-05-24T10:12:43.000Z',
    metadata: {}
  }),
  goalRecord: (goal_id, title, status, budget_estimate_usd) => ({
    goal_id,
    run_id: '',
    task_id: 'task_dashboard_static',
    scope: { org_id: 'fraction-estate', project_id: 'divinity-code' },
    source: 'task.success_criteria',
    title,
    status,
    budget_estimate_usd,
    evidence_refs: [
      { evidence_id: `${goal_id}_criteria`, source: 'task.success_criteria', claim_type: 'observed', summary: title, supports: ['goal.title'] }
    ],
    completion_evidence_refs: []
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
assert(runs.some(run => Array.isArray(run.goals) && run.goals.length > 0), 'sample data should include goal records');
assert(runs.some(run => Array.isArray(run.approval_comments) && run.approval_comments.length > 0), 'sample data should include approval comments');
assert(runs.some(run => run.approval_revision?.status === 'requested'), 'sample data should include requested approval revision');
assert(runs.some(run => Array.isArray(run.agent_activity) && run.agent_activity.length > 0), 'sample data should include agent activity records');
assert(runs.some(run => Array.isArray(run.executions) && run.executions.length > 0), 'sample data should include execution records');
assert(runs.some(run => run.task?.toolset_resolution?.operator_controls?.length > 0), 'sample data should include operator controls');
assert(runs.some(run => (run.executions || []).some(execution => execution.attempt === 2 && execution.retry_of)), 'sample data should include retry execution metadata');
assert(runs.some(run => Array.isArray(run.verifications) && run.verifications.length > 0), 'sample data should include verification records');
assert(runs.some(run => Array.isArray(run.heartbeats) && run.heartbeats.length > 0), 'sample data should include heartbeat records');
assert(runs.some(run => Array.isArray(run.connector_references) && run.connector_references.length > 0), 'sample data should include connector references');
assert(js.includes('claim_type'), 'dashboard sample data should include fact/inference labels');
assert(js.includes('renderEvidenceLabels'), 'dashboard should render evidence labels');
assert(js.includes('renderDecisionTrace'), 'dashboard should render decision trace panel');
assert(js.includes('toolset_resolution: run.task?.toolset_resolution || run.toolset_resolution || null'), 'dashboard should preserve API toolset resolution');
assert(js.includes('renderOperatorControls'), 'dashboard should render operator controls');
assert(js.includes('renderApprovalControlSummary'), 'approval cards should summarize operator controls');
assert(js.includes('renderGoals'), 'dashboard should render goal records');
assert(js.includes('renderApprovalComments'), 'dashboard should render approval comments');
assert(js.includes('renderApprovalRevision'), 'dashboard should render approval revisions');
assert(js.includes('approval_comments: run.approval_comments || []'), 'dashboard should preserve API approval comments');
assert(js.includes('approval_revision: run.approval_revision || null'), 'dashboard should preserve API approval revisions');
assert(js.includes('renderConnectorReferences'), 'dashboard should render connector references');
assert(js.includes('renderAgentActivity'), 'dashboard should render agent activity records');
assert(js.includes('renderExecutions'), 'dashboard should render execution records');
assert(js.includes('renderRetryMetadata'), 'dashboard should render retry metadata');
assert(js.includes('renderVerificationResult'), 'dashboard should render verification records');
assert(js.includes('attempt') && js.includes('retry_of') && js.includes('max_attempts'), 'dashboard should preserve execution retry fields');
assert(js.includes('git_status') && js.includes('file_read') && js.includes('node_test') && js.includes('package_script'), 'dashboard should show execution adapter names');
assert(css.includes('verification-chip'), 'dashboard should style verification chips');
assert(css.includes('retry-chip'), 'dashboard should style retry metadata');
assert(css.includes('operator-control-item'), 'dashboard should style operator controls');
assert(css.includes('approval-control-summary'), 'dashboard should style approval control summary');
assert(css.includes('goal-item'), 'dashboard should style goal records');
assert(css.includes('approval-comment-item'), 'dashboard should style approval comments');
assert(css.includes('approval-revision-card'), 'dashboard should style approval revisions');
assert(css.includes('connector-reference-item'), 'dashboard should style connector reference items');
assert(js.includes('Observed') && js.includes('Inferred'), 'dashboard should show observed/inferred label text');
assert(runs.some(run => run.artifacts.length > 0), 'at least one run needs artifacts');
assert(runs.some(run => run.artifacts.some(artifact => artifact.type === 'pr_summary')), 'sample data should include PR summary artifacts');
assert(runs.every(run => /^[a-f0-9]{64}$/.test(run.audit.hash)), 'audit hashes must be sha256-like hex');
assert(js.includes('new URLSearchParams(window.location.search)'), 'dashboard should read API query parameter');
assert(js.includes('fetch(`${base}/runs`)'), 'dashboard should load API runs');
assert(js.includes('fetch(`${base}/observability`)'), 'dashboard should load API observability summary');
assert(js.includes('fetch(`${base}/runs/${runId}/approval`'), 'dashboard should post approval decisions to API');
assert(js.includes('new EventSource(`${base}/runs/${runId}/stream`)'), 'dashboard should subscribe to API run stream');
assert(js.includes('createObservabilitySummary'), 'dashboard should derive local observability summary');
assert(js.includes('renderLivenessSummary'), 'dashboard should render heartbeat liveness summary');
assert(js.includes('renderFailureTaxonomy'), 'dashboard should render failure taxonomy');
assert(js.includes('renderScopeRollups'), 'dashboard should render scope rollups');
assert(js.includes('scope_rollups'), 'dashboard observability should include scope rollups');
assert(css.includes('scope-rollup-item'), 'dashboard should style scope rollups');

console.log(JSON.stringify({ ok: true, dashboard: 'static-shell', runs: runs.length }));
