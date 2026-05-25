import assert from 'assert/strict';

import { completeGoalRecord, createGoalRecords } from '../packages/goals/src/index.mjs';
import { evaluatePreflight, POLICY_PRESETS } from '../packages/policy-engine/src/index.mjs';

const task = {
  task_id: 'task_goal_records',
  objective: 'Update source files',
  repo: 'github.com/org/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2, hard_limit_usd: 5 },
  success_criteria: [
    'All contract examples validate',
    'Smoke test leaves no repo config behind'
  ],
  created_at: '2026-05-25T00:00:00Z'
};

{
  const preflight = evaluatePreflight({ task, policy: POLICY_PRESETS.safe_exec });
  const goals = createGoalRecords({
    run_id: 'run_goal_records',
    task,
    preflight,
    status: preflight.run_status,
    created_at: '2026-05-25T00:00:01Z'
  });

  assert.equal(goals.length, 2);
  assert.equal(goals[0].goal_id, 'goal_run_goal_records_001');
  assert.equal(goals[1].goal_id, 'goal_run_goal_records_002');
  assert.equal(goals[0].run_id, 'run_goal_records');
  assert.equal(goals[0].task_id, task.task_id);
  assert.equal(goals[0].title, 'All contract examples validate');
  assert.equal(goals[0].source, 'task.success_criteria');
  assert.equal(goals[0].status, 'pending');
  assert.deepEqual(goals[0].scope, task.scope);
  assert.equal(goals[0].created_at, '2026-05-25T00:00:01Z');
  assert.deepEqual(goals.map(goal => goal.budget_estimate_usd), [0.38, 0.37]);
  assert.ok(goals[0].evidence_refs.some(evidence => evidence.source === 'task.success_criteria'));
  assert.ok(goals[0].evidence_refs.some(evidence => evidence.source === 'task.budget'));
  assert.deepEqual(goals[0].completion_evidence_refs, []);
}

{
  const preflight = {
    run_status: 'paused',
    budget: { estimated_cost_usd: 0.25 },
    evidence_refs: []
  };
  const goals = createGoalRecords({
    run_id: 'run_goal_blocked',
    task: {
      ...task,
      success_criteria: ['Operator resolves budget pause']
    },
    preflight,
    status: 'paused',
    created_at: '2026-05-25T00:00:02Z'
  });

  assert.equal(goals.length, 1);
  assert.equal(goals[0].status, 'blocked');
  assert.equal(goals[0].budget_estimate_usd, 0.25);
}

{
  const goals = createGoalRecords({
    run_id: 'run_goal_empty',
    task: { ...task, success_criteria: [] },
    preflight: { budget: { estimated_cost_usd: 1 }, evidence_refs: [] },
    status: 'queued',
    created_at: '2026-05-25T00:00:03Z'
  });

  assert.deepEqual(goals, []);
}

{
  const goals = createGoalRecords({
    run_id: 'run_goal_complete',
    task,
    preflight: { budget: { estimated_cost_usd: 1 }, evidence_refs: [] },
    status: 'queued',
    created_at: '2026-05-25T00:00:04Z'
  });
  const completed = completeGoalRecord(goals[0], {
    verification: {
      verification_id: 'verify_exec_goal_complete',
      result: 'passed',
      completed_at: '2026-05-25T00:01:00Z'
    },
    completed_at: '2026-05-25T00:01:01Z'
  });

  assert.equal(completed.status, 'completed');
  assert.equal(completed.completed_at, '2026-05-25T00:01:01Z');
  assert.equal(completed.completion_evidence_refs.length, 1);
  assert.equal(completed.completion_evidence_refs[0].source, 'verification.result');
  assert.equal(completed.completion_evidence_refs[0].claim_type, 'observed');
  assert.ok(completed.completion_evidence_refs[0].supports.includes('goal.status'));
}

assert.throws(() => completeGoalRecord({
  goal_id: 'goal_run_goal_complete_001',
  run_id: 'run_goal_complete'
}, {
  verification: { verification_id: 'verify_exec_goal_failed', result: 'failed' }
}), /goal completion requires passed verification evidence/);

console.log(JSON.stringify({ ok: true, test: 'goal-records' }));
