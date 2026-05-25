import assert from 'assert/strict';

import { resolvePolicyPackForTask } from '../packages/policy-packs/src/index.mjs';
import { evaluatePreflight, POLICY_PRESETS } from '../packages/policy-engine/src/index.mjs';

const baseTask = {
  task_id: 'task_123',
  objective: 'Review the README copy',
  repo: 'github.com/org/repo',
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

function assertEvidenceRefs(decision) {
  assert.ok(Array.isArray(decision.evidence_refs));
  assert.ok(decision.evidence_refs.length > 0);
  for (const evidence of decision.evidence_refs) {
    assert.match(evidence.evidence_id, /^evidence_/);
    assert.equal(typeof evidence.source, 'string');
    assert.equal(typeof evidence.summary, 'string');
    assert.match(evidence.claim_type, /^(observed|inferred)$/);
    assert.ok(Array.isArray(evidence.supports));
    assert.ok(evidence.supports.length > 0);
  }
}

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
  assertEvidenceRefs(decision);
  assert.ok(decision.evidence_refs.some(evidence => evidence.source === 'task.objective' && evidence.claim_type === 'inferred'));
  assert.ok(decision.evidence_refs.some(evidence => evidence.source === 'policy.permissions' && evidence.claim_type === 'observed'));
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
  assertEvidenceRefs(decision);
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
  assertEvidenceRefs(decision);
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
  assertEvidenceRefs(decision);
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
  assertEvidenceRefs(decision);
}

{
  const task = {
    ...baseTask,
    objective: 'Run shell command rm -rf build output'
  };
  const decision = evaluatePreflight({
    task,
    policy: POLICY_PRESETS.safe_exec,
    policyPack: resolvePolicyPackForTask(task)
  });

  assert.equal(decision.decision, 'block');
  assert.equal(decision.run_status, 'failed');
  assert.ok(decision.blocked_reasons.includes('policy_hook:block_destructive_shell'));
  assert.ok(decision.policy_hooks.some(hook => (
    hook.hook_id === 'block_destructive_shell'
    && hook.matched === true
    && hook.outcome === 'blocked'
  )));
  assert.ok(decision.evidence_refs.some(evidence => (
    evidence.source === 'policy_pack.pre_execution_hooks.block_destructive_shell'
    && evidence.claim_type === 'observed'
  )));
}

{
  const task = {
    ...baseTask,
    scope: { org_id: 'regulated-org', project_id: 'platform' },
    objective: 'Update source files'
  };
  const decision = evaluatePreflight({
    task,
    policy: POLICY_PRESETS.scoped_edit,
    policyPack: resolvePolicyPackForTask(task)
  });

  assert.equal(decision.decision, 'allow');
  assert.ok(decision.warnings.includes('policy_hook:warn_regulated_write_scope'));
  assert.ok(decision.policy_hooks.some(hook => (
    hook.hook_id === 'warn_regulated_write_scope'
    && hook.matched === true
    && hook.outcome === 'warned'
  )));
}

console.log(JSON.stringify({ ok: true, test: 'policy-preflight' }));
