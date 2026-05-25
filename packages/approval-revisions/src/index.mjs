function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

function normalizeList(values) {
  return (Array.isArray(values) ? values : [values])
    .map(value => String(value || '').trim())
    .filter(Boolean);
}

export function createApprovalRevision({
  run_id,
  actor = 'operator',
  reason,
  requested_changes = [],
  requested_at = new Date().toISOString(),
  index = 1
}) {
  const normalizedReason = String(reason || '').trim();
  if (!normalizedReason) {
    throw new Error('approval revision reason must be non-empty');
  }

  return {
    revision_id: ['approval_revision', run_id || 'run_unknown', String(index).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id: run_id || 'run_unknown',
    actor: String(actor || '').trim() || 'operator',
    reason: normalizedReason,
    requested_changes: normalizeList(requested_changes),
    status: 'requested',
    requested_at
  };
}

export function resubmitApprovalRevision(revision, {
  actor = 'operator',
  reason = '',
  resubmitted_at = new Date().toISOString()
} = {}) {
  return {
    ...revision,
    status: 'resubmitted',
    resubmitted_by: String(actor || '').trim() || 'operator',
    resubmission_reason: String(reason || '').trim(),
    resubmitted_at
  };
}
