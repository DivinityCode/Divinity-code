import assert from 'assert/strict';

import { createObservabilitySummary } from '../packages/observability/src/index.mjs';

const runs = [
  {
    run_id: 'run_allowed',
    status: 'queued',
    risk_level: 'low',
    preflight: {
      budget: { estimated_cost_usd: 0.25 }
    },
    task: {
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
      budget: { soft_limit_usd: 4, hard_limit_usd: 8 }
    },
    executions: [
      { status: 'failed', adapter: 'node_test', exit_code: 1 }
    ]
  }
];

const summary = createObservabilitySummary({ runs, generated_at: '2026-05-24T00:00:00.000Z' });

assert.equal(summary.format, 'divinity.observability.v1');
assert.equal(summary.generated_at, '2026-05-24T00:00:00.000Z');
assert.equal(summary.totals.run_count, 4);
assert.equal(summary.totals.estimated_cost_usd, 4);
assert.equal(summary.totals.soft_limit_usd, 9.1);
assert.equal(summary.totals.hard_limit_usd, 18.1);
assert.equal(summary.status_counts.failed, 2);
assert.equal(summary.status_counts.paused, 1);
assert.equal(summary.risk_counts.high, 2);
assert.equal(summary.budget.soft_limit_utilization, 0.44);

assert.deepEqual(summary.failure_taxonomy.map(item => [item.category, item.count]), [
  ['policy', 1],
  ['budget', 1],
  ['execution', 1]
]);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'policy').run_ids, ['run_policy_block']);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'budget').run_ids, ['run_budget_pause']);
assert.deepEqual(summary.failure_taxonomy.find(item => item.category === 'execution').run_ids, ['run_execution_failure']);

console.log(JSON.stringify({ ok: true, test: 'observability' }));
