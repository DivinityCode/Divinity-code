import assert from 'assert/strict';

import { resolvePolicyPackForTask } from '../packages/policy-packs/src/index.mjs';
import { evaluateStepGate, POLICY_PRESETS } from '../packages/policy-engine/src/index.mjs';

const run = {
  run_id: 'run_step_gate',
  task: {
    task_id: 'task_step_gate',
    objective: 'Review the README',
    repo: 'github.com/org/repo',
    scope: { org_id: 'default-org', project_id: 'platform' },
    policy_id: 'safe_exec',
    budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
    created_at: '2026-05-24T00:00:00Z'
  },
  policy_pack: null
};
run.policy_pack = resolvePolicyPackForTask(run.task);

function assertEvidenceRefs(decision) {
  assert.ok(Array.isArray(decision.evidence_refs));
  assert.ok(decision.evidence_refs.length > 0);
  assert.ok(decision.evidence_refs.some(evidence => evidence.source === 'step.action' && evidence.claim_type === 'inferred'));
  assert.ok(decision.evidence_refs.some(evidence => evidence.source === 'task.budget' && evidence.claim_type === 'observed'));
}

{
  const gate = evaluateStepGate({
    run,
    step: { step_id: 'step_read', action: 'Read README' },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(gate.decision, 'allow');
  assert.equal(gate.status, 'allowed');
  assert.equal(gate.risk_level, 'low');
  assert.deepEqual(gate.blocked_reasons, []);
  assertEvidenceRefs(gate);
}

{
  const gate = evaluateStepGate({
    run,
    step: { step_id: 'step_shell', action: 'Run database migration shell command' },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(gate.decision, 'requires_approval');
  assert.equal(gate.status, 'blocked');
  assert.equal(gate.risk_level, 'high');
  assert.equal(gate.approval_required, true);
  assertEvidenceRefs(gate);
}

{
  const gate = evaluateStepGate({
    run,
    step: { step_id: 'step_push', action: 'Push branch to origin' },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(gate.decision, 'block');
  assert.equal(gate.status, 'blocked');
  assert.ok(gate.blocked_reasons.includes('permission_denied:git_push'));
  assertEvidenceRefs(gate);
}

{
  const gate = evaluateStepGate({
    run,
    step: { step_id: 'step_destructive_shell', action: 'Run shell command rm -rf build output' },
    policy: POLICY_PRESETS.safe_exec
  });

  assert.equal(gate.decision, 'block');
  assert.equal(gate.status, 'blocked');
  assert.ok(gate.blocked_reasons.includes('policy_hook:block_destructive_shell'));
  assert.ok(gate.policy_hooks.some(hook => hook.hook_id === 'block_destructive_shell' && hook.outcome === 'blocked'));
  assert.ok(gate.evidence_refs.some(evidence => evidence.source === 'policy_pack.pre_execution_hooks.block_destructive_shell'));
}

console.log(JSON.stringify({ ok: true, test: 'policy-step-gate' }));
