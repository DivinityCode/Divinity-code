const DEFAULT_SCOPE = { org_id: 'default-org', project_id: 'default-project' };

function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
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
      summary: 'Budget limits and estimated cost were evaluated.',
      supports: ['budget_incidents', 'warnings', 'blocked_reasons']
    }
  ];
}

function createIncident({
  run_id,
  task,
  preflight,
  source,
  step,
  threshold,
  severity,
  reason,
  limit_usd,
  created_at
}) {
  const idParts = ['budget_incident', run_id, source, step?.step_id, threshold].filter(Boolean);
  return {
    incident_id: idParts.map(stableIdPart).join('_'),
    run_id,
    task_id: task?.task_id || 'unknown',
    step_id: step?.step_id || null,
    scope: {
      org_id: task?.scope?.org_id || DEFAULT_SCOPE.org_id,
      project_id: task?.scope?.project_id || DEFAULT_SCOPE.project_id
    },
    source,
    severity,
    threshold,
    status: 'open',
    reason,
    estimated_cost_usd: preflight?.budget?.estimated_cost_usd || 0,
    limit_usd,
    evidence_refs: budgetEvidenceRefs(preflight),
    created_at
  };
}

export function createBudgetIncidents({
  run_id,
  task,
  preflight,
  source = 'preflight',
  step = null,
  created_at = new Date().toISOString()
}) {
  const incidents = [];

  if (preflight?.budget?.soft_cap_exceeded) {
    incidents.push(createIncident({
      run_id,
      task,
      preflight,
      source,
      step,
      threshold: 'soft_limit',
      severity: 'warning',
      reason: 'estimated_cost_exceeds_soft_limit',
      limit_usd: preflight.budget.soft_limit_usd,
      created_at
    }));
  }

  if (preflight?.budget?.hard_cap_exceeded) {
    incidents.push(createIncident({
      run_id,
      task,
      preflight,
      source,
      step,
      threshold: 'hard_limit',
      severity: 'hard_stop',
      reason: 'estimated_cost_exceeds_hard_limit',
      limit_usd: preflight.budget.hard_limit_usd,
      created_at
    }));
  }

  return incidents;
}
