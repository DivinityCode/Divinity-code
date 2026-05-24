const HEARTBEAT_STATUSES = new Set(['alive', 'warning', 'stale']);

function text(value, fallback = '') {
  const parsed = String(value ?? '').trim();
  return parsed || fallback;
}

export function createRunHeartbeat({
  run,
  actor = 'system',
  status = 'alive',
  message = 'Run heartbeat recorded.',
  recorded_at = new Date().toISOString()
}) {
  if (!HEARTBEAT_STATUSES.has(status)) {
    throw new Error(`heartbeat status must be one of: ${Array.from(HEARTBEAT_STATUSES).join(', ')}`);
  }

  const runId = text(run?.run_id, 'unknown');
  return {
    heartbeat_id: `heartbeat_${runId}_${recorded_at}`,
    run_id: runId,
    actor: text(actor, 'system'),
    status,
    message: text(message, 'Run heartbeat recorded.'),
    recorded_at
  };
}

export function latestHeartbeatAt(run) {
  const heartbeats = Array.isArray(run?.heartbeats) ? run.heartbeats : [];
  if (!heartbeats.length) return null;
  return heartbeats
    .map(heartbeat => heartbeat.recorded_at)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}
