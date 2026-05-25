const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };

function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function successCriteria(task) {
  if (!Array.isArray(task?.success_criteria)) return [];
  return task.success_criteria.map(criterion => String(criterion || '').trim()).filter(Boolean);
}

function statusForRunStatus(status) {
  if (status === 'paused' || status === 'failed') return 'blocked';
  if (status === 'completed') return 'completed';
  return 'pending';
}

function budgetAllocations(total, count) {
  if (count <= 0) return [];
  const cents = Math.max(0, Math.round(Number(total || 0) * 100));
  const base = Math.floor(cents / count);
  const remainder = cents - (base * count);
  return Array.from({ length: count }, (_, index) => (
    Number(((base + (index < remainder ? 1 : 0)) / 100).toFixed(2))
  ));
}

function budgetEvidenceRefs(preflight) {
  const refs = (preflight?.evidence_refs || []).filter(evidence => (
    evidence.source === 'task.budget' || (evidence.supports || []).includes('budget')
  ));
  if (refs.length > 0) return refs;

  return [
    {
      evidence_id: 'evidence_task_budget',
      source: 'task.budget',
      claim_type: 'observed',
      summary: 'Budget estimate was evaluated for goal planning.',
      supports: ['goal.budget_estimate_usd', 'goal.status']
    }
  ];
}

function criterionEvidenceRef(criterion, index) {
  return {
    evidence_id: `evidence_goal_criteria_${String(index + 1).padStart(3, '0')}`,
    source: 'task.success_criteria',
    claim_type: 'observed',
    summary: `Success criterion ${index + 1}: ${criterion}`,
    supports: ['goal.title', 'goal.status']
  };
}

function verificationEvidenceRef(goal, verification) {
  return {
    evidence_id: `evidence_${stableIdPart(goal?.goal_id)}_${stableIdPart(verification?.verification_id)}`,
    source: 'verification.result',
    claim_type: 'observed',
    summary: `Verification ${verification.verification_id} passed for goal completion.`,
    supports: ['goal.status', 'goal.completion_evidence_refs']
  };
}

export function createGoalRecords({
  run_id,
  task,
  preflight,
  status,
  created_at = new Date().toISOString()
}) {
  const criteria = successCriteria(task);
  const allocations = budgetAllocations(preflight?.budget?.estimated_cost_usd, criteria.length);
  const goalStatus = statusForRunStatus(status || preflight?.run_status);

  return criteria.map((criterion, index) => ({
    goal_id: ['goal', run_id || 'run_unknown', String(index + 1).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id: run_id || 'run_unknown',
    task_id: task?.task_id || 'unknown',
    scope: {
      org_id: task?.scope?.org_id || DEFAULT_SCOPE.org_id,
      project_id: task?.scope?.project_id || DEFAULT_SCOPE.project_id
    },
    source: 'task.success_criteria',
    title: criterion,
    status: goalStatus,
    budget_estimate_usd: allocations[index] || 0,
    evidence_refs: [
      criterionEvidenceRef(criterion, index),
      ...budgetEvidenceRefs(preflight)
    ],
    completion_evidence_refs: [],
    created_at
  }));
}

export function completeGoalRecord(goal, {
  verification,
  completed_at = new Date().toISOString()
} = {}) {
  if (!verification || verification.result !== 'passed') {
    throw new Error('goal completion requires passed verification evidence');
  }

  return {
    ...goal,
    status: 'completed',
    completion_evidence_refs: [
      ...(goal.completion_evidence_refs || []),
      verificationEvidenceRef(goal, verification)
    ],
    completed_at
  };
}
