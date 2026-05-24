import assert from 'assert/strict';

import { createAgentActivityRecords } from '../packages/agent-activity/src/index.mjs';

const task = {
  task_id: 'task_agent_activity',
  objective: 'Review the repository README',
  repo: '/tmp/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 2.5, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

const preflight = {
  decision: 'allow',
  risk_level: 'low',
  budget: { estimated_cost_usd: 1.25 },
  evidence_refs: [
    {
      evidence_id: 'evidence_task_objective',
      source: 'task.objective',
      claim_type: 'inferred',
      summary: 'Objective indicates review work.',
      supports: ['decision']
    }
  ]
};

const activity = createAgentActivityRecords({
  run_id: 'run_agent_activity',
  task,
  status: 'queued',
  preflight,
  created_at: '2026-05-24T00:00:01.000Z'
});

assert.deepEqual(activity.map(item => item.role), ['planner', 'executor', 'verifier']);
assert.deepEqual(activity.map(item => item.actor_id), [
  'planner@divinity',
  'executor@divinity',
  'verifier@divinity'
]);
assert.deepEqual(activity.map(item => item.status), ['completed', 'ready', 'completed']);
assert.ok(activity.every(item => item.reason.includes(task.objective) || item.role === 'verifier'));
assert.ok(activity.every(item => item.evidence_refs[0].source === 'task.objective'));
assert.equal(activity.reduce((total, item) => Number((total + item.budget_estimate_usd).toFixed(2)), 0), 1.25);

const gated = createAgentActivityRecords({
  run_id: 'run_agent_activity_gated',
  task,
  status: 'awaiting_approval',
  preflight,
  created_at: '2026-05-24T00:00:02.000Z'
});

assert.equal(gated.find(item => item.role === 'executor').status, 'gated');
assert.equal(gated.find(item => item.role === 'verifier').status, 'waiting');

console.log(JSON.stringify({ ok: true, test: 'agent-activity' }));
