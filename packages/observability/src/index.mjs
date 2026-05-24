const STATUSES = ['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed'];
const RISKS = ['low', 'medium', 'high', 'critical'];
const FAILURE_CATEGORIES = ['policy', 'budget', 'execution', 'unknown'];
const ACTIVE_STATUSES = new Set(['queued', 'running', 'awaiting_approval']);
const DEFAULT_STALE_AFTER_MS = 5 * 60 * 1000;
const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };

function number(value) {
  return Number.isFinite(value) ? value : 0;
}

function rounded(value) {
  return Number(number(value).toFixed(2));
}

function ratio(numerator, denominator) {
  if (!denominator) return 0;
  return rounded(numerator / denominator);
}

function runBudget(run) {
  const taskBudget = run?.task?.budget || {};
  const displayBudget = run?.budget || {};
  return {
    estimated_cost_usd: number(run?.preflight?.budget?.estimated_cost_usd ?? displayBudget.spent),
    soft_limit_usd: number(taskBudget.soft_limit_usd ?? displayBudget.soft),
    hard_limit_usd: number(taskBudget.hard_limit_usd ?? displayBudget.hard)
  };
}

function countMap(values) {
  return Object.fromEntries(values.map(value => [value, 0]));
}

function runScope(run) {
  const scope = run?.task?.scope || run?.scope || {};
  return {
    org_id: String(scope.org_id || DEFAULT_SCOPE.org_id).trim() || DEFAULT_SCOPE.org_id,
    project_id: String(scope.project_id || DEFAULT_SCOPE.project_id).trim() || DEFAULT_SCOPE.project_id
  };
}

function emptyScopeRollup(scope) {
  return {
    scope,
    run_count: 0,
    approvals_pending: 0,
    estimated_cost_usd: 0,
    soft_limit_usd: 0,
    hard_limit_usd: 0,
    status_counts: countMap(STATUSES),
    risk_counts: countMap(RISKS)
  };
}

function addRunToScopeRollup(rollup, run, budget) {
  rollup.run_count += 1;
  if (run?.status === 'awaiting_approval') rollup.approvals_pending += 1;
  if (rollup.status_counts[run?.status] != null) rollup.status_counts[run.status] += 1;
  if (rollup.risk_counts[run?.risk_level] != null) rollup.risk_counts[run.risk_level] += 1;
  rollup.estimated_cost_usd += budget.estimated_cost_usd;
  rollup.soft_limit_usd += budget.soft_limit_usd;
  rollup.hard_limit_usd += budget.hard_limit_usd;
}

function finalizeScopeRollup(rollup) {
  const estimatedCost = rounded(rollup.estimated_cost_usd);
  const softLimit = rounded(rollup.soft_limit_usd);
  const hardLimit = rounded(rollup.hard_limit_usd);
  return {
    ...rollup,
    estimated_cost_usd: estimatedCost,
    soft_limit_usd: softLimit,
    hard_limit_usd: hardLimit,
    soft_limit_utilization: ratio(estimatedCost, softLimit),
    hard_limit_utilization: ratio(estimatedCost, hardLimit)
  };
}

function sortedRollups(map) {
  return Array.from(map.values()).sort((left, right) => {
    const leftKey = left.scope.project_id
      ? `${left.scope.org_id}/${left.scope.project_id}`
      : left.scope.org_id;
    const rightKey = right.scope.project_id
      ? `${right.scope.org_id}/${right.scope.project_id}`
      : right.scope.org_id;
    return leftKey.localeCompare(rightKey);
  }).map(finalizeScopeRollup);
}

function createScopeRollups(runs) {
  const orgRollups = new Map();
  const projectRollups = new Map();

  for (const run of runs) {
    const scope = runScope(run);
    const budget = runBudget(run);
    const orgKey = scope.org_id;
    const projectKey = `${scope.org_id}/${scope.project_id}`;

    if (!orgRollups.has(orgKey)) {
      orgRollups.set(orgKey, emptyScopeRollup({
        level: 'org',
        org_id: scope.org_id
      }));
    }
    if (!projectRollups.has(projectKey)) {
      projectRollups.set(projectKey, emptyScopeRollup({
        level: 'project',
        org_id: scope.org_id,
        project_id: scope.project_id
      }));
    }

    addRunToScopeRollup(orgRollups.get(orgKey), run, budget);
    addRunToScopeRollup(projectRollups.get(projectKey), run, budget);
  }

  return [
    ...sortedRollups(orgRollups),
    ...sortedRollups(projectRollups)
  ];
}

function failedExecutions(run) {
  const directExecutions = Array.isArray(run?.executions) ? run.executions : [];
  const stepExecutions = Array.isArray(run?.steps)
    ? run.steps.map(step => step.execution).filter(Boolean)
    : [];
  return [...directExecutions, ...stepExecutions].filter(execution => execution.status === 'failed');
}

function latestHeartbeatAt(run) {
  const heartbeats = Array.isArray(run?.heartbeats) ? run.heartbeats : [];
  return heartbeats
    .map(heartbeat => heartbeat.recorded_at)
    .filter(Boolean)
    .sort()
    .at(-1) || run?.last_heartbeat_at || null;
}

function isStaleRun(run, generated_at, stale_after_ms) {
  if (!ACTIVE_STATUSES.has(run?.status)) return false;
  const lastSeenAt = latestHeartbeatAt(run) || run?.created_at;
  if (!lastSeenAt) return false;

  const lastSeenMs = Date.parse(lastSeenAt);
  const generatedMs = Date.parse(generated_at);
  if (!Number.isFinite(lastSeenMs) || !Number.isFinite(generatedMs)) return false;
  return generatedMs - lastSeenMs > stale_after_ms;
}

export function classifyRunFailure(run) {
  const blockedReasons = run?.preflight?.blocked_reasons || [];
  if (run?.status === 'paused' || blockedReasons.some(reason => reason.includes('budget') || reason.includes('cost'))) {
    return 'budget';
  }

  if (failedExecutions(run).length > 0) {
    return 'execution';
  }

  if (run?.status === 'failed' && (
    run?.preflight?.decision === 'block'
    || blockedReasons.some(reason => reason.startsWith('permission_denied'))
  )) {
    return 'policy';
  }

  if (run?.status === 'failed') return 'unknown';
  return null;
}

export function createObservabilitySummary({
  runs = [],
  generated_at = new Date().toISOString(),
  stale_after_ms = DEFAULT_STALE_AFTER_MS
} = {}) {
  const status_counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  const risk_counts = Object.fromEntries(RISKS.map(risk => [risk, 0]));
  const failures = new Map(FAILURE_CATEGORIES.map(category => [category, []]));
  const staleRunIds = [];

  let estimatedCost = 0;
  let softLimit = 0;
  let hardLimit = 0;
  let heartbeatCount = 0;

  for (const run of runs) {
    if (status_counts[run?.status] != null) status_counts[run.status] += 1;
    if (risk_counts[run?.risk_level] != null) risk_counts[run.risk_level] += 1;

    const budget = runBudget(run);
    estimatedCost += budget.estimated_cost_usd;
    softLimit += budget.soft_limit_usd;
    hardLimit += budget.hard_limit_usd;

    const failureCategory = classifyRunFailure(run);
    if (failureCategory) failures.get(failureCategory).push(run.run_id);

    heartbeatCount += Array.isArray(run?.heartbeats) ? run.heartbeats.length : 0;
    if (isStaleRun(run, generated_at, stale_after_ms)) staleRunIds.push(run.run_id);
  }

  const failure_taxonomy = FAILURE_CATEGORIES
    .map(category => ({
      category,
      count: failures.get(category).length,
      run_ids: failures.get(category)
    }))
    .filter(item => item.count > 0);

  return {
    format: 'divinity.observability.v1',
    generated_at,
    totals: {
      run_count: runs.length,
      approvals_pending: status_counts.awaiting_approval,
      estimated_cost_usd: rounded(estimatedCost),
      soft_limit_usd: rounded(softLimit),
      hard_limit_usd: rounded(hardLimit)
    },
    status_counts,
    risk_counts,
    budget: {
      soft_limit_utilization: ratio(estimatedCost, softLimit),
      hard_limit_utilization: ratio(estimatedCost, hardLimit)
    },
    liveness: {
      heartbeat_count: heartbeatCount,
      stale_run_count: staleRunIds.length,
      stale_run_ids: staleRunIds
    },
    failure_taxonomy,
    scope_rollups: createScopeRollups(runs)
  };
}
