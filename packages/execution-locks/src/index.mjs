const RELEASE_STATUSES = new Set(['released', 'failed', 'stale']);
const DEFAULT_LOCK_TTL_MS = 10 * 60 * 1000;

function text(value, fallback = '') {
  const parsed = String(value ?? '').trim();
  return parsed || fallback;
}

function expiresAt(locked_at, ttl_ms) {
  return new Date(Date.parse(locked_at) + ttl_ms).toISOString();
}

export function createExecutionLock({
  run,
  step,
  actor = 'executor@divinity',
  locked_at = new Date().toISOString(),
  expires_at = expiresAt(locked_at, DEFAULT_LOCK_TTL_MS)
}) {
  const runId = text(run?.run_id, 'unknown');
  const stepId = text(step?.step_id, 'unknown');
  return {
    lock_id: `lock_${runId}_${stepId}_${locked_at}`,
    run_id: runId,
    step_id: stepId,
    actor: text(actor, 'executor@divinity'),
    status: 'locked',
    locked_at,
    expires_at,
    released_at: null
  };
}

export function activeExecutionLock(run, now = new Date().toISOString()) {
  const nowMs = Date.parse(now);
  const locks = Array.isArray(run?.execution_locks) ? run.execution_locks : [];

  return locks.find(lock => {
    if (lock?.status !== 'locked') return false;
    const expiresMs = Date.parse(lock.expires_at);
    return !Number.isFinite(expiresMs) || !Number.isFinite(nowMs) || expiresMs > nowMs;
  }) || null;
}

export function recoverStaleExecutionLocks({
  run,
  now = new Date().toISOString()
}) {
  const nowMs = Date.parse(now);
  const locks = Array.isArray(run?.execution_locks) ? run.execution_locks : [];
  const recovered = [];

  for (const lock of locks) {
    if (lock?.status !== 'locked') continue;
    const expiresMs = Date.parse(lock.expires_at);
    if (!Number.isFinite(expiresMs) || !Number.isFinite(nowMs) || expiresMs > nowMs) continue;

    Object.assign(lock, releaseExecutionLock({
      lock,
      status: 'stale',
      released_at: now
    }));
    recovered.push(lock);
  }

  if (run && 'active_execution_lock' in run) {
    run.active_execution_lock = activeExecutionLock(run, now);
  }

  return recovered;
}

export function releaseExecutionLock({
  lock,
  status = 'released',
  released_at = new Date().toISOString()
}) {
  if (!RELEASE_STATUSES.has(status)) {
    throw new Error(`execution lock status must be one of: ${Array.from(RELEASE_STATUSES).join(', ')}`);
  }

  return {
    ...lock,
    status,
    released_at
  };
}
