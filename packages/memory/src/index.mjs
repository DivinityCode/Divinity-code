import crypto from 'crypto';

function text(value, fallback = 'unknown') {
  const parsed = String(value ?? '').replace(/\r?\n/g, ' ').trim();
  return parsed || fallback;
}

function scopeFor(task) {
  return {
    org_id: text(task?.scope?.org_id, 'default-org'),
    project_id: text(task?.scope?.project_id, 'default-project')
  };
}

function memoryId({ scope, fact, source }) {
  const digest = crypto
    .createHash('sha256')
    .update(JSON.stringify({ scope, fact, source }))
    .digest('hex')
    .slice(0, 16);
  return `mem_${digest}`;
}

function memoryEntry({ scope, fact, source, confidence, recorded_at }) {
  return {
    memory_id: memoryId({ scope, fact, source }),
    scope,
    fact,
    confidence,
    provenance: {
      source,
      recorded_at
    }
  };
}

export function createRunMemoryEntries({ run_id, task, preflight, recorded_at = new Date().toISOString() }) {
  const scope = scopeFor(task);
  return [
    memoryEntry({
      scope: { level: 'session', id: text(run_id) },
      fact: `Run ${text(run_id)} objective: ${text(task?.objective, 'No objective provided')}`,
      source: 'task.objective',
      confidence: 0.85,
      recorded_at
    }),
    memoryEntry({
      scope: { level: 'project', id: `${scope.org_id}/${scope.project_id}` },
      fact: `Project ${scope.project_id} used policy ${text(task?.policy_id)} with decision ${text(preflight?.decision, 'not_evaluated')}`,
      source: 'task.policy_id',
      confidence: 0.8,
      recorded_at
    }),
    memoryEntry({
      scope: { level: 'team', id: scope.org_id },
      fact: `Org ${scope.org_id} budget soft ${task?.budget?.soft_limit_usd ?? 'unknown'} hard ${task?.budget?.hard_limit_usd ?? 'unknown'} with risk ${text(preflight?.risk_level)}`,
      source: 'task.budget',
      confidence: 0.75,
      recorded_at
    })
  ];
}
