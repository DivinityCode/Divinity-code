function stableIdPart(value) {
  return String(value || '').replace(/[^\w-]+/g, '_');
}

export function createApprovalComment({
  run_id,
  actor = 'operator',
  body,
  created_at = new Date().toISOString(),
  index = 1
}) {
  const normalizedBody = String(body || '').trim();
  if (!normalizedBody) {
    throw new Error('approval comment body must be non-empty');
  }

  return {
    comment_id: ['approval_comment', run_id || 'run_unknown', String(index).padStart(3, '0')]
      .map(stableIdPart)
      .join('_'),
    run_id: run_id || 'run_unknown',
    actor: String(actor || '').trim() || 'operator',
    body: normalizedBody,
    created_at
  };
}
