import assert from 'assert/strict';

import { evaluatePreflight, POLICY_PRESETS } from './packages/policy-engine/src/index.mjs';

const baseTask = {
  task_id: 'task_123',
  objective: 'Review the README copy',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

{
  const decision = evaluatePreflight({
    task: baseTask,
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(decision.decision, 'allow');
  assert.equal(decision.risk_level, 'low');
  assert.equal(decision.approval_required, false);
  assert.equal(decision.budget.hard_cap_exceeded, false);
  assert.deepEqual(decision.warnings, []);
}

{
  const decision = evaluatePreflight({
    task: {
      ...baseTask,
      objective: 'Run a database migration shell command'
    },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(decision.decision, 'requires_approval');
  assert.equal(decision.risk_level, 'high');
  assert.equal(decision.approval_required, true);
  assert.ok(decision.predicted_actions.some(action => action.type === 'shell'));
  assert.deepEqual(decision.warnings, []);
}

{
  const decision = evaluatePreflight({
    task: {
      ...baseTask,
      objective: 'Review source files',
      budget: { soft_limit_usd: 0.1, hard_limit_usd: 5 }
    },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(decision.decision, 'allow');
  assert.equal(decision.budget.soft_cap_exceeded, true);
  assert.equal(decision.budget.hard_cap_exceeded, false);
  assert.deepEqual(decision.warnings, ['estimated_cost_exceeds_soft_limit']);
}

{
  const decision = evaluatePreflight({
    task: {
      ...baseTask,
      objective: 'Update source files',
      budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 }
    },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(decision.decision, 'block');
  assert.equal(decision.budget.hard_cap_exceeded, true);
  assert.equal(decision.run_status, 'paused');
  assert.ok(decision.blocked_reasons.includes('estimated_cost_exceeds_hard_limit'));
  assert.ok(decision.warnings.includes('estimated_cost_exceeds_soft_limit'));
}

{
  const decision = evaluatePreflight({
    task: {
      ...baseTask,
      objective: 'Modify source files'
    },
    policy: POLICY_PRESETS.read_only
  });

  assert.equal(decision.decision, 'block');
  assert.ok(decision.blocked_reasons.includes('permission_denied:file_write'));
}

console.log(JSON.stringify({ ok: true, test: 'policy-preflight' }));
