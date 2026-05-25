import assert from 'assert/strict';

import { evaluatePreflight, POLICY_PRESETS } from '../packages/policy-engine/src/index.mjs';
import { createBudgetIncidents } from '../packages/budget-incidents/src/index.mjs';

const baseTask = {
  task_id: 'task_budget_incident',
  objective: 'Update source files',
  repo: 'github.com/org/repo',
  scope: { org_id: 'acme', project_id: 'platform' },
  policy_id: 'safe_exec',
  budget: { soft_limit_usd: 0.1, hard_limit_usd: 5 },
  created_at: '2026-05-24T00:00:00Z'
};

{
  const preflight = evaluatePreflight({ task: baseTask, policy: POLICY_PRESETS.safe_exec });
  const incidents = createBudgetIncidents({
    run_id: 'run_budget_soft',
    task: baseTask,
    preflight,
    source: 'preflight',
    created_at: '2026-05-24T00:00:01Z'
  });

  assert.equal(incidents.length, 1);
  assert.equal(incidents[0].severity, 'warning');
  assert.equal(incidents[0].threshold, 'soft_limit');
  assert.equal(incidents[0].status, 'open');
  assert.equal(incidents[0].reason, 'estimated_cost_exceeds_soft_limit');
  assert.equal(incidents[0].estimated_cost_usd, preflight.budget.estimated_cost_usd);
  assert.equal(incidents[0].limit_usd, baseTask.budget.soft_limit_usd);
  assert.deepEqual(incidents[0].scope, baseTask.scope);
  assert.ok(incidents[0].evidence_refs.some(evidence => evidence.source === 'task.budget'));
}

{
  const hardTask = {
    ...baseTask,
    budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 }
  };
  const preflight = evaluatePreflight({ task: hardTask, policy: POLICY_PRESETS.safe_exec });
  const incidents = createBudgetIncidents({
    run_id: 'run_budget_hard',
    task: hardTask,
    preflight,
    source: 'preflight',
    created_at: '2026-05-24T00:00:01Z'
  });

  assert.deepEqual(incidents.map(incident => incident.threshold), ['soft_limit', 'hard_limit']);
  assert.ok(incidents.some(incident => incident.severity === 'hard_stop'));
  assert.ok(incidents.every(incident => incident.incident_id.startsWith('budget_incident_run_budget_hard_')));
}

console.log(JSON.stringify({ ok: true, test: 'budget-incidents' }));
