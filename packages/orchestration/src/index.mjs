function text(value, fallback = 'unknown') {
  const parsed = String(value ?? '').trim();
  return parsed || fallback;
}

function plannedSteps(task) {
  const objective = text(task?.objective, 'No objective provided');
  return [
    {
      step_id: 'plan_context',
      action: `Review context for: ${objective}`,
      owner: 'planner'
    },
    {
      step_id: 'execute_objective',
      action: objective,
      owner: 'executor'
    },
    {
      step_id: 'verify_artifacts',
      action: 'Verify outputs, evidence, policy, and budget state',
      owner: 'verifier'
    }
  ];
}

function executorStatus(status) {
  return status === 'queued' ? 'ready' : 'gated';
}

function verifierResult(status) {
  return status === 'queued' ? 'verified' : 'waiting_for_gate_resolution';
}

export function createOrchestrationTrace({ run_id, task, status, preflight }) {
  const steps = plannedSteps(task);
  const evidenceRefs = preflight?.evidence_refs || [];

  return {
    pipeline_id: `pipeline_${run_id}`,
    run_id,
    stages: [
      {
        role: 'planner',
        status: 'completed',
        output: {
          objective: text(task?.objective, 'No objective provided'),
          steps
        },
        evidence_refs: evidenceRefs
      },
      {
        role: 'executor',
        status: executorStatus(status),
        output: {
          planned_steps: steps.length,
          side_effects: 'none'
        },
        evidence_refs: evidenceRefs
      },
      {
        role: 'verifier',
        status: 'completed',
        output: {
          result: verifierResult(status),
          preflight_decision: text(preflight?.decision, 'not_evaluated'),
          risk_level: text(preflight?.risk_level, 'unknown')
        },
        evidence_refs: evidenceRefs
      }
    ]
  };
}
