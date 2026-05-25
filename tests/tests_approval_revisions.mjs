import assert from 'assert/strict';

import { createApprovalRevision, resubmitApprovalRevision } from '../packages/approval-revisions/src/index.mjs';

const revision = createApprovalRevision({
  run_id: 'run_revision_123',
  actor: 'operator@example.com',
  reason: 'Rollback evidence is missing.',
  requested_changes: ['Attach rollback plan', 'Confirm maintenance window'],
  requested_at: '2026-05-25T00:00:01Z'
});

assert.equal(revision.revision_id, 'approval_revision_run_revision_123_001');
assert.equal(revision.run_id, 'run_revision_123');
assert.equal(revision.actor, 'operator@example.com');
assert.equal(revision.reason, 'Rollback evidence is missing.');
assert.deepEqual(revision.requested_changes, ['Attach rollback plan', 'Confirm maintenance window']);
assert.equal(revision.status, 'requested');
assert.equal(revision.requested_at, '2026-05-25T00:00:01Z');

const resubmitted = resubmitApprovalRevision(revision, {
  actor: 'builder@example.com',
  reason: 'Rollback plan attached.',
  resubmitted_at: '2026-05-25T00:01:00Z'
});

assert.equal(resubmitted.revision_id, revision.revision_id);
assert.equal(resubmitted.status, 'resubmitted');
assert.equal(resubmitted.resubmitted_by, 'builder@example.com');
assert.equal(resubmitted.resubmission_reason, 'Rollback plan attached.');
assert.equal(resubmitted.resubmitted_at, '2026-05-25T00:01:00Z');

assert.throws(() => createApprovalRevision({
  run_id: 'run_revision_123',
  reason: ' '
}), /approval revision reason must be non-empty/);

console.log(JSON.stringify({ ok: true, test: 'approval-revisions' }));
