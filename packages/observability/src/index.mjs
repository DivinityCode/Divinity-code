const STATUSES = ['queued', 'running', 'awaiting_approval', 'paused', 'completed', 'failed'];
const RISKS = ['low', 'medium', 'high', 'critical'];
const FAILURE_CATEGORIES = ['policy', 'budget', 'execution', 'unknown'];

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

function failedExecutions(run) {
  const directExecutions = Array.isArray(run?.executions) ? run.executions : [];
  const stepExecutions = Array.isArray(run?.steps)
    ? run.steps.map(step => step.execution).filter(Boolean)
    : [];
  return [...directExecutions, ...stepExecutions].filter(execution => execution.status === 'failed');
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

export function createObservabilitySummary({ runs = [], generated_at = new Date().toISOString() } = {}) {
  const status_counts = Object.fromEntries(STATUSES.map(status => [status, 0]));
  const risk_counts = Object.fromEntries(RISKS.map(risk => [risk, 0]));
  const failures = new Map(FAILURE_CATEGORIES.map(category => [category, []]));

  let estimatedCost = 0;
  let softLimit = 0;
  let hardLimit = 0;

  for (const run of runs) {
    if (status_counts[run?.status] != null) status_counts[run.status] += 1;
    if (risk_counts[run?.risk_level] != null) risk_counts[run.risk_level] += 1;

    const budget = runBudget(run);
    estimatedCost += budget.estimated_cost_usd;
    softLimit += budget.soft_limit_usd;
    hardLimit += budget.hard_limit_usd;

    const failureCategory = classifyRunFailure(run);
    if (failureCategory) failures.get(failureCategory).push(run.run_id);
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
    failure_taxonomy
  };
}
