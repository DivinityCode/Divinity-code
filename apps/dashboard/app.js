const sampleRuns = [
  {
    run_id: 'run_2026_05_24_0012',
    task_id: 'task_users_pagination',
    objective: 'Add cursor-based pagination to GET /v1/users',
    status: 'awaiting_approval',
    risk_level: 'medium',
    created_at: '2026-05-24T10:12:43.000Z',
    budget: { spent: 12.43, soft: 50, hard: 100 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_001', 'task_created', 'queued', 'Task created', 'Task payload accepted by API.', '2026-05-24T10:12:43.000Z', '120ms'),
      event('evt_002', 'preflight_completed', 'awaiting_approval', 'Preflight requires approval', 'Predicted write and test execution actions.', '2026-05-24T10:12:58.000Z', '2.34s', [
        evidence('inferred', 'task.objective', 'Predicted write and test execution actions.'),
        evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
      ]),
      event('evt_003', 'status_changed', 'awaiting_approval', 'Awaiting approval', 'Manual approval required before execution.', '2026-05-24T10:13:28.000Z', '-')
    ],
    decision_trace: decisionTrace('request_operator_approval', 'execute_without_approval', 'Risk threshold requires an operator decision before execution continues.', [
      evidence('inferred', 'task.objective', 'Predicted write and test execution actions.'),
      evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
    ]),
    artifacts: [
      artifact('artifact_patch_0012', 'patch', 'artifact://run_2026_05_24_0012/patch.diff'),
      artifact('artifact_log_0012', 'log', 'artifact://run_2026_05_24_0012/run.log'),
      artifact('artifact_summary_0012', 'summary', 'artifact://run_2026_05_24_0012/summary.md')
    ],
    audit: {
      hash: 'b3f9c8d2e5f4a7d9b2c7e6f0a1b9c8d2f6e7a1b9c8d2e6f4a7d9b2c7e6f0a1b9',
      recorded_at: '2026-05-24T10:13:28.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0011',
    task_id: 'task_auth_middleware',
    objective: 'Refactor auth middleware to support API keys',
    status: 'running',
    risk_level: 'low',
    created_at: '2026-05-24T09:47:10.000Z',
    budget: { spent: 8.21, soft: 40, hard: 75 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_011', 'task_created', 'queued', 'Task created', 'Repository context attached.', '2026-05-24T09:47:10.000Z', '90ms'),
      event('evt_012', 'preflight_completed', 'queued', 'Preflight allowed', 'Read and scoped edit permissions granted.', '2026-05-24T09:47:22.000Z', '1.2s'),
      event('evt_013', 'status_changed', 'running', 'Execution running', 'Implementation loop is applying changes.', '2026-05-24T09:48:01.000Z', '5.26s')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', [
      evidence('observed', 'policy.permissions', 'safe_exec policy grants scoped write and shell execution.')
    ]),
    artifacts: [
      artifact('artifact_log_0011', 'log', 'artifact://run_2026_05_24_0011/run.log'),
      artifact('artifact_summary_0011', 'summary', 'artifact://run_2026_05_24_0011/summary.md')
    ],
    audit: {
      hash: '8f3a7c2d5e6f4a1bb3f9c8d2e5f4a7d9b2c7e6f0a1b9c8d2f6e7a1b9c8d2e6f4',
      recorded_at: '2026-05-24T09:48:01.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0010',
    task_id: 'task_n_plus_one',
    objective: 'Fix N+1 query in user list endpoint',
    status: 'completed',
    risk_level: 'low',
    created_at: '2026-05-24T08:33:14.000Z',
    budget: { spent: 4.15, soft: 30, hard: 50 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_101', 'task_created', 'queued', 'Task created', 'Objective normalized.', '2026-05-24T08:33:14.000Z', '80ms'),
      event('evt_102', 'preflight_completed', 'queued', 'Preflight allowed', 'No high-risk action predicted.', '2026-05-24T08:33:23.000Z', '820ms'),
      event('evt_103', 'status_changed', 'completed', 'Completed', 'Patch, log, and summary artifacts exported.', '2026-05-24T08:42:11.000Z', '4.18s')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', [
      evidence('inferred', 'task.objective', 'No high-risk action predicted.')
    ]),
    executions: [
      {
        execution_id: 'exec_0010_readme',
        step_id: 'step_readme',
        adapter: 'file_read',
        status: 'completed',
        exit_code: 0,
        target_path: 'README.md',
        stdout: '# Divinity Code',
        stderr: '',
        completed_at: '2026-05-24T08:38:21.000Z'
      },
      {
        execution_id: 'exec_0010_git',
        step_id: 'step_git_status',
        adapter: 'git_status',
        status: 'completed',
        exit_code: 0,
        target_path: null,
        stdout: ' M apps/api/src/server.mjs',
        stderr: '',
        completed_at: '2026-05-24T08:39:03.000Z'
      },
      {
        execution_id: 'exec_0010_test',
        step_id: 'step_dashboard_static',
        adapter: 'node_test',
        status: 'completed',
        exit_code: 0,
        target_path: 'tests/tests_dashboard_static.mjs',
        stdout: '{"ok":true,"dashboard":"static-shell","runs":6}',
        stderr: '',
        completed_at: '2026-05-24T08:40:19.000Z'
      },
      {
        execution_id: 'exec_0010_contracts',
        step_id: 'step_validate_contracts',
        adapter: 'package_script',
        status: 'completed',
        exit_code: 0,
        target_path: 'package.json#scripts.validate:contracts',
        stdout: 'PASS packages/contracts/examples/task.valid.json expected=true',
        stderr: '',
        completed_at: '2026-05-24T08:41:03.000Z'
      }
    ],
    verifications: [
      verification('verify_exec_0010_readme', 'exec_0010_readme', 'step_readme', 'passed'),
      verification('verify_exec_0010_git', 'exec_0010_git', 'step_git_status', 'passed'),
      verification('verify_exec_0010_test', 'exec_0010_test', 'step_dashboard_static', 'passed'),
      verification('verify_exec_0010_contracts', 'exec_0010_contracts', 'step_validate_contracts', 'passed')
    ],
    artifacts: [
      artifact('artifact_patch_0010', 'patch', 'artifact://run_2026_05_24_0010/patch.diff'),
      artifact('artifact_log_0010', 'log', 'artifact://run_2026_05_24_0010/run.log'),
      artifact('artifact_summary_0010', 'summary', 'artifact://run_2026_05_24_0010/summary.md')
    ],
    audit: {
      hash: 'c9e1a8f6d4b2c0e7f5a3d1b9c8e6f4a2d0b7c5e3f1a9d8c6b4e2f0a7d5c3b1aa',
      recorded_at: '2026-05-24T08:42:11.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0009',
    task_id: 'task_order_index',
    objective: 'Add missing index for orders.customer_id',
    status: 'failed',
    risk_level: 'medium',
    created_at: '2026-05-24T07:58:05.000Z',
    budget: { spent: 2.31, soft: 20, hard: 40 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_091', 'task_created', 'queued', 'Task created', 'Database migration task accepted.', '2026-05-24T07:58:05.000Z', '110ms'),
      event('evt_092', 'preflight_completed', 'failed', 'Preflight blocked', 'Migration permission was missing.', '2026-05-24T07:58:16.000Z', '1.04s'),
      event('evt_093', 'status_changed', 'failed', 'Run failed', 'Policy gate blocked execution.', '2026-05-24T07:58:18.000Z', '-')
    ],
    decision_trace: decisionTrace('stop_before_execution', 'execute_disallowed_action', 'Policy or permission checks blocked the requested work before side effects.', [
      evidence('observed', 'policy.permissions', 'Migration permission was missing.')
    ]),
    artifacts: [
      artifact('artifact_log_0009', 'log', 'artifact://run_2026_05_24_0009/run.log'),
      artifact('artifact_summary_0009', 'summary', 'artifact://run_2026_05_24_0009/summary.md')
    ],
    audit: {
      hash: 'da8f3c7e2b6a1d9f4c8e3b7a2d6f1c9e5b0a4d8f2c6e1b9a3d7f0c4e8b2a6d1a',
      recorded_at: '2026-05-24T07:58:18.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0008',
    task_id: 'task_lockfile',
    objective: 'Update dependencies and lockfile',
    status: 'queued',
    risk_level: 'low',
    created_at: '2026-05-24T07:22:45.000Z',
    budget: { spent: 0, soft: 25, hard: 50 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_081', 'task_created', 'queued', 'Task created', 'Waiting for scheduler capacity.', '2026-05-24T07:22:45.000Z', '-')
    ],
    decision_trace: decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', []),
    artifacts: [],
    audit: {
      hash: 'f1c9e5b0a4d8f2c6e1b9a3d7f0c4e8b2a6d1da8f3c7e2b6a1d9f4c8e3b7a2d6a',
      recorded_at: '2026-05-24T07:22:45.000Z'
    }
  },
  {
    run_id: 'run_2026_05_24_0007',
    task_id: 'task_rate_limit',
    objective: 'Implement rate limiting for login endpoint',
    status: 'paused',
    risk_level: 'high',
    created_at: '2026-05-24T06:58:32.000Z',
    budget: { spent: 92.14, soft: 60, hard: 90 },
    actor: 'ai-agent@divinity',
    events: [
      event('evt_071', 'task_created', 'queued', 'Task created', 'Security-sensitive endpoint flagged.', '2026-05-24T06:58:32.000Z', '130ms'),
      event('evt_072', 'preflight_completed', 'queued', 'Preflight allowed', 'Scoped edit and safe exec permissions granted.', '2026-05-24T06:58:51.000Z', '2.1s', [
        evidence('inferred', 'task.objective', 'Security-sensitive endpoint work was classified from objective text.'),
        evidence('observed', 'task.budget', 'Budget limits and spend are loaded from run state.')
      ]),
      event('evt_073', 'status_changed', 'paused', 'Paused by budget cap', 'Hard budget cap was exceeded before the next execution step.', '2026-05-24T07:02:17.000Z', '6.12s')
    ],
    decision_trace: decisionTrace('pause_for_budget_review', 'continue_past_hard_budget_cap', 'Hard budget cap enforcement pauses execution before additional work starts.', [
      evidence('observed', 'task.budget', 'Budget limits and spend are loaded from run state.')
    ]),
    artifacts: [
      artifact('artifact_log_0007', 'log', 'artifact://run_2026_05_24_0007/run.log')
    ],
    audit: {
      hash: 'a4d8f2c6e1b9a3d7f0c4e8b2a6d1da8f3c7e2b6a1d9f4c8e3b7a2d6f1c9e5b0a',
      recorded_at: '2026-05-24T07:02:17.000Z'
    }
  }
];

let runs = sampleRuns;
let runEventSource = null;
let subscribedRunId = null;
let apiRunsLoaded = false;
let observabilitySummary = createObservabilitySummary({ runs });

const state = {
  filter: 'all',
  search: '',
  selectedRunId: runs[0].run_id
};

const selectors = {
  runList: document.querySelector('[data-run-list]'),
  approvalList: document.querySelector('[data-approval-list]'),
  observabilitySummary: document.querySelector('[data-observability-summary]'),
  failureTaxonomy: document.querySelector('[data-failure-taxonomy]'),
  statusFilter: document.querySelector('[data-status-filter]'),
  search: document.querySelector('[data-run-search]'),
  toast: document.querySelector('[data-toast]')
};

function event(event_id, type, status, message, detail, created_at, duration, evidence_refs = []) {
  return {
    event_id,
    run_id: '',
    type,
    status,
    message,
    metadata: { detail, duration, evidence_refs },
    created_at
  };
}

function evidence(claim_type, source, summary) {
  return {
    claim_type,
    source,
    summary
  };
}

function artifact(artifact_id, type, uri) {
  return { artifact_id, run_id: '', type, uri };
}

function verification(verification_id, execution_id, step_id, result) {
  return {
    verification_id,
    run_id: '',
    step_id,
    execution_id,
    status: 'completed',
    result,
    checks: [
      {
        check_id: 'execution_completed',
        status: result === 'passed' ? 'passed' : 'failed',
        summary: `Verifier observed execution result ${result}.`
      }
    ],
    evidence_refs: [
      evidence('observed', 'execution.exit_code', `Verifier result ${result} for ${execution_id}.`)
    ]
  };
}

function decisionTrace(chosen_path, rejected_alternative, rationale, evidence_refs = []) {
  return { chosen_path, rejected_alternative, rationale, evidence_refs };
}

function safeNumber(value) {
  return Number.isFinite(value) ? value : 0;
}

function rounded(value) {
  return Number(safeNumber(value).toFixed(2));
}

function runBudget(run) {
  return {
    estimated_cost_usd: safeNumber(run.preflight?.budget?.estimated_cost_usd ?? run.budget?.spent),
    soft_limit_usd: safeNumber(run.task?.budget?.soft_limit_usd ?? run.budget?.soft),
    hard_limit_usd: safeNumber(run.task?.budget?.hard_limit_usd ?? run.budget?.hard)
  };
}

function classifyRunFailure(run) {
  const blockedReasons = run.preflight?.blocked_reasons || [];
  if (run.status === 'paused' || blockedReasons.some(reason => reason.includes('budget') || reason.includes('cost'))) {
    return 'budget';
  }

  const executions = run.executions || [];
  if (executions.some(execution => execution.status === 'failed')) return 'execution';

  if (run.status === 'failed' && (
    run.preflight?.decision === 'block'
    || blockedReasons.some(reason => reason.startsWith('permission_denied'))
    || /policy/i.test(run.decision_trace?.rationale || '')
  )) {
    return 'policy';
  }

  if (run.status === 'failed') return 'unknown';
  return null;
}

function createObservabilitySummary({ runs: sourceRuns, generated_at = new Date().toISOString() }) {
  const status_counts = Object.fromEntries(['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed'].map(status => [status, 0]));
  const risk_counts = Object.fromEntries(['low', 'medium', 'high', 'critical'].map(risk => [risk, 0]));
  const failureBuckets = new Map(['policy', 'budget', 'execution', 'unknown'].map(category => [category, []]));
  let estimatedCost = 0;
  let softLimit = 0;
  let hardLimit = 0;

  for (const run of sourceRuns) {
    if (status_counts[run.status] != null) status_counts[run.status] += 1;
    if (risk_counts[run.risk_level] != null) risk_counts[run.risk_level] += 1;
    const budget = runBudget(run);
    estimatedCost += budget.estimated_cost_usd;
    softLimit += budget.soft_limit_usd;
    hardLimit += budget.hard_limit_usd;

    const failureCategory = classifyRunFailure(run);
    if (failureCategory) failureBuckets.get(failureCategory).push(run.run_id);
  }

  return {
    format: 'divinity.observability.v1',
    generated_at,
    totals: {
      run_count: sourceRuns.length,
      approvals_pending: status_counts.awaiting_approval,
      estimated_cost_usd: rounded(estimatedCost),
      soft_limit_usd: rounded(softLimit),
      hard_limit_usd: rounded(hardLimit)
    },
    status_counts,
    risk_counts,
    budget: {
      soft_limit_utilization: softLimit ? rounded(estimatedCost / softLimit) : 0,
      hard_limit_utilization: hardLimit ? rounded(estimatedCost / hardLimit) : 0
    },
    failure_taxonomy: ['policy', 'budget', 'execution', 'unknown'].map(category => ({
      category,
      count: failureBuckets.get(category).length,
      run_ids: failureBuckets.get(category)
    })).filter(item => item.count > 0)
  };
}

function apiBaseUrl() {
  const params = new URLSearchParams(window.location.search);
  const base = params.get('api') || '';
  return base.replace(/\/$/, '');
}

function normalizeApiEvent(runEvent) {
  return {
    ...runEvent,
    metadata: {
      ...runEvent.metadata,
      detail: runEvent.metadata?.detail || runEvent.message,
      duration: runEvent.metadata?.duration || '-'
    }
  };
}

function normalizeApiRun(run) {
  const budget = run.task?.budget || run.preflight?.budget || {};
  const createdAt = run.created_at || run.events?.[0]?.created_at || new Date().toISOString();
  const stepExecutions = (run.steps || []).map(step => step.execution).filter(Boolean);
  const stepVerifications = (run.steps || []).map(step => step.verification).filter(Boolean);
  return {
    run_id: run.run_id,
    task_id: run.task_id,
    objective: run.task?.objective || run.task_id || run.run_id,
    status: run.status,
    risk_level: run.risk_level,
    created_at: createdAt,
    budget: {
      spent: run.preflight?.budget?.estimated_cost_usd || 0,
      soft: budget.soft_limit_usd || 0,
      hard: budget.hard_limit_usd || 0
    },
    actor: run.approval?.actor || 'api',
    events: (run.events || []).map(normalizeApiEvent),
    decision_trace: decisionTraceForRun(run),
    executions: run.executions || stepExecutions,
    verifications: run.verifications || stepVerifications,
    artifacts: run.artifacts || [],
    audit: {
      hash: run.audit?.hash || '0'.repeat(64),
      recorded_at: run.audit?.recorded_at || createdAt
    }
  };
}

function decisionTraceForRun(run) {
  if (run.decision_trace) return run.decision_trace;
  const evidenceRefs = run.preflight?.evidence_refs || [];

  if (run.status === 'awaiting_approval') {
    return decisionTrace('request_operator_approval', 'execute_without_approval', 'Risk threshold requires an operator decision before execution continues.', evidenceRefs);
  }

  if (run.status === 'paused') {
    return decisionTrace('pause_for_budget_review', 'continue_past_hard_budget_cap', 'Hard budget cap enforcement pauses execution before additional work starts.', evidenceRefs);
  }

  if (run.status === 'failed') {
    return decisionTrace('stop_before_execution', 'execute_disallowed_action', 'Policy or permission checks blocked the requested work before side effects.', evidenceRefs);
  }

  return decisionTrace('queue_for_execution', 'pause_or_request_approval', 'Preflight allowed the run to enter the execution queue.', evidenceRefs);
}

function replaceRun(nextRun) {
  const index = runs.findIndex(run => run.run_id === nextRun.run_id);
  if (index === -1) {
    runs = [nextRun, ...runs];
  } else {
    runs = runs.map(run => run.run_id === nextRun.run_id ? nextRun : run);
  }
  observabilitySummary = createObservabilitySummary({ runs });
}

function closeRunStream() {
  if (!runEventSource) return;
  runEventSource.close();
  runEventSource = null;
  subscribedRunId = null;
}

function subscribeToSelectedRun() {
  const base = apiBaseUrl();
  const runId = state.selectedRunId;
  if (!base || !apiRunsLoaded || !runId || typeof EventSource === 'undefined' || subscribedRunId === runId) return;

  closeRunStream();
  subscribedRunId = runId;
  runEventSource = new EventSource(`${base}/runs/${runId}/stream`);

  const handleUpdate = (event) => {
    const updated = normalizeApiRun(JSON.parse(event.data));
    hydrateRunReferences([updated]);
    replaceRun(updated);
    state.selectedRunId = updated.run_id;
    render();
  };

  runEventSource.addEventListener('run_snapshot', handleUpdate);
  runEventSource.addEventListener('run_updated', handleUpdate);
  runEventSource.addEventListener('error', () => {
    showToast('Live event stream disconnected; use refresh to reload run state');
    closeRunStream();
  });
}

function hydrateRunReferences(sourceRuns) {
  for (const run of sourceRuns) {
    for (const runEvent of run.events) runEvent.run_id = run.run_id;
    for (const runArtifact of run.artifacts) runArtifact.run_id = run.run_id;
    for (const runVerification of run.verifications || []) runVerification.run_id = run.run_id;
  }
}

async function loadApiRuns() {
  const base = apiBaseUrl();
  if (!base) return;

  try {
    const response = await fetch(`${base}/runs`);
    if (!response.ok) throw new Error(`GET /runs returned ${response.status}`);
    const payload = await response.json();
    const apiRuns = (payload.runs || []).map(normalizeApiRun);
    if (!apiRuns.length) {
      apiRunsLoaded = false;
      closeRunStream();
      showToast('API connected; no runs are available yet');
      return;
    }
    hydrateRunReferences(apiRuns);
    runs = apiRuns;
    apiRunsLoaded = true;
    observabilitySummary = await loadApiObservability(base);
    state.selectedRunId = apiRuns[0].run_id;
    showToast(`Loaded ${apiRuns.length} run${apiRuns.length === 1 ? '' : 's'} from API`);
    render();
  } catch (error) {
    apiRunsLoaded = false;
    closeRunStream();
    showToast(`API unavailable; using sample data (${error.message})`);
  }
}

async function loadApiObservability(base) {
  try {
    const response = await fetch(`${base}/observability`);
    if (!response.ok) throw new Error(`GET /observability returned ${response.status}`);
    return await response.json();
  } catch (error) {
    showToast(`API observability unavailable; deriving metrics from runs (${error.message})`);
    return createObservabilitySummary({ runs });
  }
}

function formatCurrency(value) {
  return `$${value.toFixed(2)}`;
}

function formatDate(value) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat('en', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function statusClass(status) {
  return `status-${status}`;
}

function statusLabel(status, compact = false) {
  if (compact && status === 'awaiting_approval') return 'awaiting';
  return status;
}

function riskClass(risk) {
  return `risk-${risk}`;
}

function filteredRuns() {
  return runs.filter(run => {
    const statusMatch = state.filter === 'all' || run.status === state.filter;
    const searchText = `${run.run_id} ${run.objective} ${run.task_id}`.toLowerCase();
    return statusMatch && searchText.includes(state.search.toLowerCase());
  });
}

function countByStatus(status) {
  if (status === 'all') return runs.length;
  return runs.filter(run => run.status === status).length;
}

function budgetPercent(run) {
  if (!run.budget.soft) return 0;
  return Math.min(100, Math.round((run.budget.spent / run.budget.soft) * 100));
}

function renderCounts() {
  for (const node of document.querySelectorAll('[data-count]')) {
    node.textContent = countByStatus(node.dataset.count);
  }

  const approvalCount = runs.filter(run => run.status === 'awaiting_approval').length;
  for (const node of document.querySelectorAll('[data-approval-count]')) {
    node.textContent = approvalCount;
  }
}

function renderObservability() {
  const summary = observabilitySummary || createObservabilitySummary({ runs });
  selectors.observabilitySummary.innerHTML = `
    <div>
      <dt>Runs</dt>
      <dd>${summary.totals.run_count}</dd>
    </div>
    <div>
      <dt>Pending</dt>
      <dd>${summary.totals.approvals_pending}</dd>
    </div>
    <div>
      <dt>Est. Cost</dt>
      <dd>${formatCurrency(summary.totals.estimated_cost_usd)}</dd>
    </div>
    <div>
      <dt>Soft Use</dt>
      <dd>${Math.round(summary.budget.soft_limit_utilization * 100)}%</dd>
    </div>
  `;
  selectors.failureTaxonomy.innerHTML = renderFailureTaxonomy(summary.failure_taxonomy);
}

function renderFailureTaxonomy(items = []) {
  if (!items.length) return '<div class="empty-state">No failures are classified.</div>';

  return items.map(item => `
    <article class="taxonomy-item">
      <div>
        <strong>${item.category}</strong>
        <span>${item.count} run${item.count === 1 ? '' : 's'}</span>
      </div>
      <code>${item.run_ids.join(', ')}</code>
    </article>
  `).join('');
}

function renderRunList() {
  const rows = filteredRuns().map(run => `
    <tr class="run-row ${run.run_id === state.selectedRunId ? 'selected' : ''}" data-run-id="${run.run_id}" tabindex="0">
      <td>
        <span class="run-radio">
          <span class="radio-dot" aria-hidden="true"></span>
          ${run.run_id.replace('run_', 'RUN-')}
        </span>
      </td>
      <td class="objective-cell">${run.objective}</td>
      <td><span class="status-pill ${statusClass(run.status)}">${statusLabel(run.status, true)}</span></td>
      <td><span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span></td>
      <td>
        <span class="budget-cell">
          <span>${formatCurrency(run.budget.spent)} / ${formatCurrency(run.budget.soft)}</span>
          <span class="budget-bar" aria-hidden="true"><span style="width:${budgetPercent(run)}%"></span></span>
        </span>
      </td>
    </tr>
  `).join('');

  selectors.runList.innerHTML = rows || `
    <tr class="run-row">
      <td colspan="5" class="empty-state">No runs match the current filter.</td>
    </tr>
  `;

  for (const row of selectors.runList.querySelectorAll('[data-run-id]')) {
    row.addEventListener('click', () => selectRun(row.dataset.runId));
    row.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        selectRun(row.dataset.runId);
      }
    });
  }
}

function selectedRun() {
  return runs.find(run => run.run_id === state.selectedRunId) || runs[0];
}

function renderRunDetail() {
  const run = selectedRun();
  document.querySelector('[data-selected-run-id]').textContent = run.run_id.replace('run_', 'RUN-');
  document.querySelector('[data-selected-objective]').textContent = run.objective;
  document.querySelector('[data-selected-created]').textContent = formatDate(run.created_at);
  document.querySelector('[data-selected-soft]').textContent = formatCurrency(run.budget.soft);
  document.querySelector('[data-selected-hard]').textContent = formatCurrency(run.budget.hard);
  document.querySelector('[data-selected-risk]').innerHTML = `<span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span>`;

  const status = document.querySelector('[data-selected-status]');
  status.textContent = statusLabel(run.status);
  status.className = `status-pill ${statusClass(run.status)}`;

  document.querySelector('[data-event-timeline]').innerHTML = run.events.map(renderEvent).join('');
  document.querySelector('[data-decision-trace]').innerHTML = renderDecisionTrace(run.decision_trace);
  document.querySelector('[data-execution-list]').innerHTML = renderExecutions(run);
  document.querySelector('[data-artifact-list]').innerHTML = renderArtifacts(run);
  document.querySelector('[data-audit-hash]').textContent = run.audit.hash;
  document.querySelector('[data-audit-recorded]').textContent = formatDate(run.audit.recorded_at);
}

function renderDecisionTrace(trace) {
  return `
    <dl>
      <div>
        <dt>Chosen</dt>
        <dd>${trace.chosen_path}</dd>
      </div>
      <div>
        <dt>Rejected</dt>
        <dd>${trace.rejected_alternative}</dd>
      </div>
    </dl>
    <p>${trace.rationale}</p>
    ${renderEvidenceLabels(trace.evidence_refs)}
  `;
}

function renderEvent(runEvent) {
  const tone = runEvent.status === 'failed'
    ? 'fail'
    : runEvent.status === 'awaiting_approval'
      ? 'warn'
      : 'success';
  const icon = tone === 'fail' ? '!' : tone === 'warn' ? '!' : 'ok';

  return `
    <li class="timeline-event">
      <time class="event-time" datetime="${runEvent.created_at}">${formatTime(runEvent.created_at)}</time>
      <span class="event-dot ${tone}" aria-hidden="true">${icon}</span>
      <span class="event-copy">
        <strong>${runEvent.message}</strong>
        <span>${runEvent.metadata.detail}</span>
        ${renderEvidenceLabels(runEvent.metadata.evidence_refs)}
      </span>
      <span class="event-duration">${runEvent.metadata.duration}</span>
    </li>
  `;
}

function renderEvidenceLabels(evidenceRefs = []) {
  if (!evidenceRefs.length) return '';

  return `
    <span class="claim-list">
      ${evidenceRefs.map(evidence => `
        <span class="claim-chip claim-${evidence.claim_type}" title="${evidence.source}: ${evidence.summary}">
          ${evidence.claim_type === 'observed' ? 'Observed' : 'Inferred'}
        </span>
      `).join('')}
    </span>
  `;
}

function renderArtifacts(run) {
  if (!run.artifacts.length) {
    return '<li class="empty-state">Artifacts will appear after execution starts.</li>';
  }

  return run.artifacts.map(item => `
    <li class="artifact-item">
      <span class="artifact-icon" aria-hidden="true">[]</span>
      <span>${item.uri.split('/').pop()}</span>
      <span>${item.type}</span>
    </li>
  `).join('');
}

function renderExecutions(run) {
  const executions = run.executions || [];
  if (!executions.length) {
    return '<li class="empty-state">Execution records appear after approved steps run.</li>';
  }

  const verificationsByExecution = new Map((run.verifications || []).map(record => [record.execution_id, record]));
  return executions.map(item => `
    <li class="execution-item">
      <span class="execution-main">
        <strong>${item.adapter}</strong>
        <span>${item.step_id}</span>
      </span>
      <span class="status-pill ${item.status === 'completed' ? 'status-completed' : 'status-failed'}">${item.status}</span>
      ${renderVerificationResult(verificationsByExecution.get(item.execution_id))}
      <span class="execution-meta">exit ${item.exit_code}${item.target_path ? ` - ${item.target_path}` : ''}</span>
      <code class="execution-output">${(item.stdout || item.stderr || '').split('\n')[0] || '-'}</code>
    </li>
  `).join('');
}

function renderVerificationResult(record) {
  if (!record) return '<span class="verification-chip verification-pending">verify pending</span>';
  return `
    <span class="verification-chip verification-${record.result}">
      verify ${record.result}
    </span>
  `;
}

function renderApprovalQueue() {
  const approvals = runs.filter(run => run.status === 'awaiting_approval');
  selectors.approvalList.innerHTML = approvals.map(run => `
    <article class="approval-card" data-approval-run="${run.run_id}">
      <div>
        <h3>${run.run_id.replace('run_', 'RUN-')}</h3>
        <p>${run.objective}</p>
      </div>
      <dl>
        <div>
          <dt>Risk</dt>
          <dd><span class="risk-pill ${riskClass(run.risk_level)}">${run.risk_level}</span></dd>
        </div>
        <div>
          <dt>Budget</dt>
          <dd>${formatCurrency(run.budget.spent)} / ${formatCurrency(run.budget.soft)}</dd>
        </div>
      </dl>
      <div class="approval-actions">
        <button class="approve-button" type="button" data-decision="approve">Approve</button>
        <button class="reject-button" type="button" data-decision="reject">Reject</button>
      </div>
    </article>
  `).join('') || '<div class="empty-state">No approvals are pending.</div>';

  for (const card of selectors.approvalList.querySelectorAll('[data-approval-run]')) {
    for (const button of card.querySelectorAll('[data-decision]')) {
      button.addEventListener('click', () => decideApproval(card.dataset.approvalRun, button.dataset.decision));
    }
  }
}

function selectRun(runId) {
  state.selectedRunId = runId;
  render();
}

async function decideApproval(runId, decision) {
  const run = runs.find(item => item.run_id === runId);
  if (!run || run.status !== 'awaiting_approval') return;

  const base = apiBaseUrl();
  if (base) {
    try {
      const response = await fetch(`${base}/runs/${runId}/approval`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          decision,
          actor: 'dashboard',
          reason: `Dashboard ${decision} action`
        })
      });
      if (!response.ok) throw new Error(`POST approval returned ${response.status}`);
      const updated = normalizeApiRun(await response.json());
      hydrateRunReferences([updated]);
      replaceRun(updated);
      state.selectedRunId = updated.run_id;
      showToast(`${updated.run_id.replace('run_', 'RUN-')} ${decision === 'approve' ? 'approved' : 'rejected'} by dashboard`);
      render();
      return;
    } catch (error) {
      showToast(`Approval API failed: ${error.message}`);
      return;
    }
  }

  run.status = decision === 'approve' ? 'queued' : 'failed';
  run.events.push(event(
    `evt_${Date.now()}`,
    'approval_decided',
    run.status,
    `Approval decision: ${decision}`,
    `Operator ${decision}d the requested action.`,
    new Date().toISOString(),
    '-'
  ));
  run.audit = {
    hash: `${run.audit.hash.slice(0, 56)}${decision === 'approve' ? 'a110ed01' : 'b10ced01'}`,
    recorded_at: new Date().toISOString()
  };
  state.selectedRunId = run.run_id;
  showToast(`${run.run_id.replace('run_', 'RUN-')} ${decision === 'approve' ? 'approved' : 'rejected'} by operator`);
  render();
}

function showToast(message) {
  selectors.toast.textContent = message;
  selectors.toast.hidden = false;
  window.clearTimeout(showToast.timeoutId);
  showToast.timeoutId = window.setTimeout(() => {
    selectors.toast.hidden = true;
  }, 2400);
}

function render() {
  observabilitySummary = apiRunsLoaded ? observabilitySummary : createObservabilitySummary({ runs });
  renderCounts();
  renderObservability();
  renderRunList();
  renderRunDetail();
  renderApprovalQueue();
  subscribeToSelectedRun();
}

selectors.statusFilter.addEventListener('click', (event) => {
  const button = event.target.closest('[data-filter]');
  if (!button) return;

  state.filter = button.dataset.filter;
  for (const item of selectors.statusFilter.querySelectorAll('[data-filter]')) {
    const isActive = item === button;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', String(isActive));
  }
  renderRunList();
});

selectors.search.addEventListener('input', (event) => {
  state.search = event.target.value;
  renderRunList();
});

document.querySelector('[data-refresh-button]').addEventListener('click', () => {
  const base = apiBaseUrl();
  if (base) {
    loadApiRuns();
  } else {
    showToast('Dashboard refreshed from local contract sample data');
  }
});

hydrateRunReferences(runs);

render();
loadApiRuns();
