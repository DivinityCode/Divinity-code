const ARTIFACT_TYPES = ['patch', 'log', 'summary'];

function decisionTrace({ status, preflight }) {
  if (status === 'awaiting_approval') {
    return {
      chosen_path: 'request_operator_approval',
      rejected_alternative: 'execute_without_approval',
      rationale: 'Risk threshold requires an operator decision before execution continues.',
      evidence_refs: preflight?.evidence_refs || []
    };
  }

  if (status === 'paused') {
    return {
      chosen_path: 'pause_for_budget_review',
      rejected_alternative: 'continue_past_hard_budget_cap',
      rationale: 'Hard budget cap enforcement pauses execution before additional work starts.',
      evidence_refs: preflight?.evidence_refs || []
    };
  }

  if (status === 'failed') {
    return {
      chosen_path: 'stop_before_execution',
      rejected_alternative: 'execute_disallowed_action',
      rationale: 'Policy or permission checks blocked the requested work before side effects.',
      evidence_refs: preflight?.evidence_refs || []
    };
  }

  return {
    chosen_path: 'queue_for_execution',
    rejected_alternative: 'pause_or_request_approval',
    rationale: 'Preflight allowed the run to enter the execution queue.',
    evidence_refs: preflight?.evidence_refs || []
  };
}

function patchText(value, fallback = 'unknown') {
  const text = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return text || fallback;
}

function generatedPatch({ task, status, preflight }) {
  const scope = task.scope
    ? `${patchText(task.scope.org_id)}/${patchText(task.scope.project_id)}`
    : 'default-org/default-project';
  const lines = [
    '# Divinity Task',
    `- Task ID: ${patchText(task.task_id)}`,
    `- Objective: ${patchText(task.objective, 'No objective provided')}`,
    `- Status: ${patchText(status)}`,
    `- Policy: ${patchText(task.policy_id)}`,
    `- Scope: ${scope}`,
    `- Preflight Decision: ${patchText(preflight?.decision, 'not_evaluated')}`
  ];

  return [
    'diff --git a/DIVINITY_TASK.md b/DIVINITY_TASK.md',
    'new file mode 100644',
    'index 0000000..e69de29',
    '--- /dev/null',
    '+++ b/DIVINITY_TASK.md',
    `@@ -0,0 +1,${lines.length} @@`,
    ...lines.map(line => `+${line}`)
  ].join('\n') + '\n';
}

function artifactContent({ run_id, task, status, type, preflight }) {
  if (type === 'summary') {
    return {
      summary: `Run ${run_id} for task ${task.task_id || 'unknown'} is ${status}: ${task.objective || 'No objective provided'}`,
      decision_trace: decisionTrace({ status, preflight })
    };
  }

  if (type === 'log') {
    return {
      lines: [
        `task_id=${task.task_id || 'unknown'}`,
        `status=${status}`,
        `objective=${task.objective || 'No objective provided'}`
      ]
    };
  }

  return {
    format: 'unified-diff',
    target_path: 'DIVINITY_TASK.md',
    patch: generatedPatch({ task, status, preflight }),
    note: 'Deterministic patch payload generated from run context.'
  };
}

export function createRunArtifacts({ run_id, task, status, preflight }) {
  return ARTIFACT_TYPES.map(type => ({
    artifact_id: `artifact_${run_id}_${type}`,
    run_id,
    type,
    uri: `artifact://${run_id}/${type}`,
    content: artifactContent({ run_id, task, status, type, preflight })
  }));
}

export function publicArtifactMetadata(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    run_id: artifact.run_id,
    type: artifact.type,
    uri: artifact.uri
  };
}
