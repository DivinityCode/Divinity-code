import assert from 'assert/strict';

import { createRunHeartbeat, latestHeartbeatAt } from '../packages/heartbeats/src/index.mjs';

const heartbeat = createRunHeartbeat({
  run: { run_id: 'run_heartbeat_123' },
  actor: 'executor@divinity',
  status: 'alive',
  message: 'Workspace is still processing.',
  recorded_at: '2026-05-25T00:00:00.000Z'
});

assert.equal(heartbeat.heartbeat_id, 'heartbeat_run_heartbeat_123_2026-05-25T00:00:00.000Z');
assert.equal(heartbeat.run_id, 'run_heartbeat_123');
assert.equal(heartbeat.actor, 'executor@divinity');
assert.equal(heartbeat.status, 'alive');
assert.equal(heartbeat.message, 'Workspace is still processing.');
assert.equal(heartbeat.recorded_at, '2026-05-25T00:00:00.000Z');

assert.equal(latestHeartbeatAt({ heartbeats: [heartbeat] }), '2026-05-25T00:00:00.000Z');
assert.equal(latestHeartbeatAt({ heartbeats: [] }), null);

assert.throws(
  () => createRunHeartbeat({ run: { run_id: 'run_123' }, status: 'bad' }),
  /heartbeat status must be one of/
);

console.log(JSON.stringify({ ok: true, test: 'heartbeats' }));
