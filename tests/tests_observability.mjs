import assert from 'assert/strict';

import { createObservabilitySummary } from '../packages/observability/src/index.mjs';

const runs = [
  {
    run_id: 'run_allowed',
    status: 'awaiting_approval',
    risk_level: 'low',
    created_at: '2026-05-24T00:00:00.000Z',
    preflight: {
      budget: { estimated_cost_usd: 0.25 }
    },
    task: {
      scope: { org_id: 'acme', project_id: 'platform' },
      budget: { soft_limit_usd: 2, hard_limit_usd: 4 }
    }
  },
  {
    run_id: 'run_policy_block',
    status: 'failed',
    risk_level: 'high',
    preflight: {
      blocked_reasons: ['permission_denied:shell'],
      budget: { estimated_cost_usd: 1.5 }
    },
    task: {
      scope: { org_id: 'acme', project_id: 'billing' },
      budget: { soft_limit_usd: 3, hard_limit_usd: 6 }
    }
  },
  {
    run_id: 'run_budget_pause',
    status: 'paused',
    risk_level: 'high',
    preflight: {
      blocked_reasons: ['estimated_cost_exceeds_hard_limit'],
      budget: { estimated_cost_usd: 1.5 }
    },
    task: {
      scope: { org_id: 'acme', project_id: 'platform' },
      budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 }
    }
  },
  {
    run_id: 'run_execution_failure',
    status: 'failed',
    risk_level: 'medium',
    preflight: {
      blocked_reasons: [],
      budget: { estimated_cost_usd: 0.75 }
    },
    task: {
      scope: { org_id: 'acme', project_id: 'platform' },
      budget: { soft_limit_usd: 4, hard_limit_usd: 8 }
    },
    executions: [
      { status: 'failed', adapter: 'node_test', exit_code: 1 }
    ]
  },
  {
    run_id: 'run_fresh_heartbeat',
    status: 'running',
    risk_level: 'low',
    created_at: '2026-05-24T00:00:00.000Z',
    last_heartbeat_at: '2026-05-24T00:09:30.000Z',
    heartbeats: [
      {
        heartbeat_id: 'heartbeat_run_fresh_heartbeat_2026-05-24T00:09:30.000Z',
        run_id: 'run_fresh_heartbeat',
        status: 'alive',
        actor: 'executor@divinity',
        message: 'still active',
        recorded_at: '2026-05-24T00:09:30.000Z'
      }
    ],
    preflight: {
      budget: { estimated_cost_usd: 0.25 }
    },
    task: {
      scope: { org_id: 'ops', project_id: 'sandbox' },
      budget: { soft_limit_usd: 2, hard_limit_usd: 4 }
    }
  }
];

const summary = createObservabilitySummary({ runs, generated_at: '2026-05-24T00:10:00.000Z' });

assert.equal(summary.format, 'divinity.observability.v1');
assert.equal(summary.generated_at, '2026-05-24T00:10:00.000Z');
assert.equal(summary.totals.run_count, 5);
assert.equal(summary.totals.approvals_pending, 1);
assert.equal(summary.totals.estimated_cost_usd, 4.25);
assert.equal(summary.totals.soft_limit_usd, 11.1);
assert.equal(summary.totals.hard_limit_usd, 22.1);
assert.equal(summary.status_counts.failed, 2);
assert.equal(summary.status_counts.paused, 1);
assert.equal(summary.status_counts.running, 1);
assert.equal(summary.status_counts.awaiting_approval, 1);
assert.equal(summary.risk_counts.high, 2);
assert.equal(summary.budget.soft_limit_utilization, 0.38);
assert.equal(summary.liveness.heartbeat_count, 1);
assert.deepEqual(summary.liveness.stale_run_ids, ['run_allowed']);

assert.deepEqual(summary.failure_taxonomy.map(item => [item.category, item.count]), [
  ['policy', 1],
  ['budget', 1],
  ['execution', 1]
]);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'policy').run_ids, ['run_policy_block']);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'budget').run_ids, ['run_budget_pause']);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'execution').run_ids, ['run_execution_failure']);

assert.deepEqual(summary.scope_rollups.map(item => (
  item.scope.level === 'org'
    ? `org:${item.scope.org_id}`
    : `project:${item.scope.org_id}/${item.scope.project_id}`
)), [
  'org:acme',
  'org:ops',
  'project:acme/billing',
  'project:acme/platform',
  'project:ops/sandbox'
]);

const acme = summary.scope_rollups.find(item => item.scope.level === 'org' && item.scope.org_id === 'acme');
assert.equal(acme.run_count, 4);
assert.equal(acme.approvals_pending, 1);
assert.equal(acme.estimated_cost_usd, 4);
assert.equal(acme.soft_limit_usd, 9.1);
assert.equal(acme.hard_limit_usd, 18.1);
assert.equal(acme.soft_limit_utilization, 0.44);
assert.equal(acme.status_counts.awaiting_approval, 1);
assert.equal(acme.risk_counts.high, 2);

const platform = summary.scope_rollups.find(item => item.scope.level === 'project' && item.scope.project_id === 'platform');
assert.equal(platform.run_count, 3);
assert.equal(platform.estimated_cost_usd, 2.5);
assert.equal(platform.approvals_pending, 1);

const billing = summary.scope_rollups.find(item => item.scope.level === 'project' && item.scope.project_id === 'billing');
assert.equal(billing.run_count, 1);
assert.equal(billing.estimated_cost_usd, 1.5);

const ops = summary.scope_rollups.find(item => item.scope.level === 'org' && item.scope.org_id === 'ops');
assert.equal(ops.run_count, 1);
assert.equal(ops.estimated_cost_usd, 0.25);

console.log(JSON.stringify({ ok: true, test: 'observability' }));
