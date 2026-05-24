import assert from 'assert/strict';

import {
  activeExecutionLock,
  createExecutionLock,
  releaseExecutionLock
} from '../packages/execution-locks/src/index.mjs';

const lock = createExecutionLock({
  run: { run_id: 'run_lock_123' },
  step: { step_id: 'step_lock_123' },
  actor: 'executor@divinity',
  locked_at: '2026-05-25T00:00:00.000Z',
  expires_at: '2026-05-25T00:05:00.000Z'
});

assert.equal(lock.lock_id, 'lock_run_lock_123_step_lock_123_2026-05-25T00:00:00.000Z');
assert.equal(lock.run_id, 'run_lock_123');
assert.equal(lock.step_id, 'step_lock_123');
assert.equal(lock.actor, 'executor@divinity');
assert.equal(lock.status, 'locked');
assert.equal(lock.locked_at, '2026-05-25T00:00:00.000Z');
assert.equal(lock.expires_at, '2026-05-25T00:05:00.000Z');
assert.equal(lock.released_at, null);

assert.equal(activeExecutionLock({ execution_locks: [lock] }, '2026-05-25T00:04:00.000Z').lock_id, lock.lock_id);
assert.equal(activeExecutionLock({ execution_locks: [lock] }, '2026-05-25T00:06:00.000Z'), null);

const released = releaseExecutionLock({
  lock,
  status: 'released',
  released_at: '2026-05-25T00:01:00.000Z'
});
assert.equal(released.status, 'released');
assert.equal(released.released_at, '2026-05-25T00:01:00.000Z');
assert.equal(activeExecutionLock({ execution_locks: [released] }, '2026-05-25T00:02:00.000Z'), null);

assert.throws(
  () => releaseExecutionLock({ lock, status: 'invalid' }),
  /execution lock status must be one of/
);

console.log(JSON.stringify({ ok: true, test: 'execution-locks' }));
