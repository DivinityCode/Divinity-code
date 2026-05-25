import assert from 'assert/strict';

import { createApprovalComment } from '../packages/approval-comments/src/index.mjs';

{
  const comment = createApprovalComment({
    run_id: 'run_comment_123',
    actor: 'operator@example.com',
    body: 'Please confirm migration rollback plan before approval.',
    created_at: '2026-05-25T00:00:01Z',
    index: 1
  });

  assert.equal(comment.comment_id, 'approval_comment_run_comment_123_001');
  assert.equal(comment.run_id, 'run_comment_123');
  assert.equal(comment.actor, 'operator@example.com');
  assert.equal(comment.body, 'Please confirm migration rollback plan before approval.');
  assert.equal(comment.created_at, '2026-05-25T00:00:01Z');
}

{
  const comment = createApprovalComment({
    run_id: 'run_comment_123',
    actor: '',
    body: '  Needs review.  ',
    created_at: '2026-05-25T00:00:02Z',
    index: 2
  });

  assert.equal(comment.comment_id, 'approval_comment_run_comment_123_002');
  assert.equal(comment.actor, 'operator');
  assert.equal(comment.body, 'Needs review.');
}

assert.throws(() => createApprovalComment({
  run_id: 'run_comment_123',
  body: ' ',
  index: 3
}), /approval comment body must be non-empty/);

console.log(JSON.stringify({ ok: true, test: 'approval-comments' }));
