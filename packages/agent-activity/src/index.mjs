const ROLE_DEFINITIONS = [
  {
    role: 'planner',
    actor_id: 'planner@divinity',
    budget_weight: 0.2
  },
  {
    role: 'executor',
    actor_id: 'executor@divinity',
    budget_weight: 0.6
  },
  {
    role: 'verifier',
    actor_id: 'verifier@divinity',
    budget_weight: 0.2
  }
];

function text(value, fallback = 'unknown') {
  const parsed = String(value ?? '').trim();
  return parsed || fallback;
}

function roundCurrency(value) {
  return Number((Number(value) || 0).toFixed(2));
}

function statusForRole(role, runStatus) {
  if (role === 'planner') return 'completed';
  if (role === 'executor') return runStatus === 'queued' ? 'ready' : 'gated';
  if (role === 'verifier') return runStatus === 'queued' ? 'completed' : 'waiting';
  return 'waiting';
}

function actionForRole(role, objective) {
  if (role === 'planner') return `Plan implementation for: ${objective}`;
  if (role === 'executor') return `Execute approved work for: ${objective}`;
  return 'Verify outputs, evidence, policy, and budget state';
}

function reasonForRole(role, objective, preflight) {
  if (role === 'planner') {
    return `Planner decomposes the objective "${objective}" before execution.`;
  }
  if (role === 'executor') {
    return `Executor follows the ${preflight?.decision || 'unknown'} preflight decision for "${objective}".`;
  }
  return `Verifier checks artifacts and execution evidence after "${objective}" progresses.`;
}

function budgetEstimates(total) {
  let assigned = 0;
  return ROLE_DEFINITIONS.map((definition, index) => {
    if (index === ROLE_DEFINITIONS.length - 1) {
      return roundCurrency(total - assigned);
    }
    const value = roundCurrency(total * definition.budget_weight);
    assigned = roundCurrency(assigned + value);
    return value;
  });
}

export function createAgentActivityRecords({
  run_id,
  task,
  status,
  preflight,
  created_at = new Date().toISOString()
}) {
  const objective = text(task?.objective, 'No objective provided');
  const estimatedCost = preflight?.budget?.estimated_cost_usd || 0;
  const estimates = budgetEstimates(estimatedCost);
  const evidenceRefs = preflight?.evidence_refs || [];

  return ROLE_DEFINITIONS.map((definition, index) => ({
    activity_id: `activity_${run_id}_${definition.role}`,
    run_id,
    role: definition.role,
    actor_id: definition.actor_id,
    action: actionForRole(definition.role, objective),
    reason: reasonForRole(definition.role, objective, preflight),
    status: statusForRole(definition.role, status),
    budget_estimate_usd: estimates[index],
    evidence_refs: evidenceRefs,
    created_at
  }));
}
