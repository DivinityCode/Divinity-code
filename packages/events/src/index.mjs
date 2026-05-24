const EVENT_TYPES = new Set([
  'task_created',
  'preflight_completed',
  'status_changed',
  'approval_decided',
  'step_executed',
  'step_verified',
  'heartbeat_recorded',
  'workspace_cleaned'
]);

export function createRunEvent({
  run_id,
  type,
  status,
  message,
  metadata = {},
  created_at = new Date().toISOString()
}) {
  if (!EVENT_TYPES.has(type)) {
    throw new Error(`unknown run event type: ${type}`);
  }

  return {
    event_id: `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`,
    run_id,
    type,
    status,
    message,
    metadata,
    created_at
  };
}

export function createInitialRunEvents({ run_id, task, preflight, status }) {
  return [
    createRunEvent({
      run_id,
      type: 'task_created',
      status: 'queued',
      message: 'Task accepted by control plane',
      metadata: { task_id: task.task_id }
    }),
    createRunEvent({
      run_id,
      type: 'preflight_completed',
      status: 'queued',
      message: `Preflight decision: ${preflight.decision}`,
      metadata: {
        decision: preflight.decision,
        risk_level: preflight.risk_level,
        approval_required: preflight.approval_required,
        evidence_refs: preflight.evidence_refs || []
      }
    }),
    createRunEvent({
      run_id,
      type: 'status_changed',
      status,
      message: `Run status changed to ${status}`,
      metadata: { risk_level: preflight.risk_level }
    })
  ];
}
