const RISK_ORDER = ['low', 'medium', 'high', 'critical'];

const ACTION_RULES = [
  {
    type: 'shell',
    risk_level: 'high',
    permission: 'shell:execute',
    patterns: [/\bshell\b/i, /\bcommand\b/i, /\brun\b/i, /\bmigration\b/i]
  },
  {
    type: 'git_push',
    risk_level: 'high',
    permission: 'git:push',
    patterns: [/\bpush\b/i, /\bpull request\b/i, /\bpr\b/i]
  },
  {
    type: 'file_write',
    risk_level: 'medium',
    permission: 'file:write',
    patterns: [/\bmodify\b/i, /\bupdate\b/i, /\bedit\b/i, /\bwrite\b/i, /\bpatch\b/i]
  },
  {
    type: 'file_read',
    risk_level: 'low',
    permission: 'file:read',
    patterns: [/\bread\b/i, /\binspect\b/i, /\breview\b/i]
  }
];

export const POLICY_PRESETS = {
  read_only: {
    policy_id: 'read_only',
    permissions: ['file:read'],
    approval_threshold: 'medium'
  },
  scoped_edit: {
    policy_id: 'scoped_edit',
    permissions: ['file:read', 'file:write'],
    approval_threshold: 'high'
  },
  safe_exec: {
    policy_id: 'safe_exec',
    permissions: ['file:read', 'file:write', 'shell:execute'],
    approval_threshold: 'high'
  },
  full_exec: {
    policy_id: 'full_exec',
    permissions: ['file:read', 'file:write', 'shell:execute', 'git:push'],
    approval_threshold: 'critical'
  }
};

function compareRisk(left, right) {
  return RISK_ORDER.indexOf(left) - RISK_ORDER.indexOf(right);
}

function maxRisk(actions) {
  return actions.reduce((highest, action) => (
    compareRisk(action.risk_level, highest) > 0 ? action.risk_level : highest
  ), 'low');
}

function inferActions(objective) {
  const text = objective || '';
  const actions = ACTION_RULES.filter(rule => (
    rule.patterns.some(pattern => pattern.test(text))
  )).map(({ type, risk_level, permission }) => ({ type, risk_level, permission }));

  if (actions.length === 0) {
    actions.push({ type: 'file_read', risk_level: 'low', permission: 'file:read' });
  }

  return actions;
}

function estimateCost(actions) {
  const riskCost = {
    low: 0.25,
    medium: 0.75,
    high: 1.5,
    critical: 3
  };

  return Number(actions.reduce((total, action) => (
    total + riskCost[action.risk_level]
  ), 0).toFixed(2));
}

export function resolvePolicy(policyOrId) {
  if (!policyOrId) return POLICY_PRESETS.safe_exec;
  if (typeof policyOrId === 'string') return POLICY_PRESETS[policyOrId] || POLICY_PRESETS.safe_exec;
  return policyOrId;
}

export function evaluatePreflight({ task, policy }) {
  const resolvedPolicy = resolvePolicy(policy || task?.policy_id);
  const predicted_actions = inferActions(task?.objective);
  const risk_level = maxRisk(predicted_actions);
  const estimated_cost_usd = estimateCost(predicted_actions);
  const budget = {
    estimated_cost_usd,
    soft_limit_usd: task?.budget?.soft_limit_usd ?? null,
    hard_limit_usd: task?.budget?.hard_limit_usd ?? null,
    soft_cap_exceeded: task?.budget?.soft_limit_usd != null
      ? estimated_cost_usd > task.budget.soft_limit_usd
      : false,
    hard_cap_exceeded: task?.budget?.hard_limit_usd != null
      ? estimated_cost_usd > task.budget.hard_limit_usd
      : false
  };

  const permissions = new Set(resolvedPolicy.permissions || []);
  const blocked_reasons = [];
  const warnings = [];

  for (const action of predicted_actions) {
    if (!permissions.has(action.permission)) {
      blocked_reasons.push(`permission_denied:${action.type}`);
    }
  }

  if (budget.hard_cap_exceeded) {
    blocked_reasons.push('estimated_cost_exceeds_hard_limit');
  }

  if (budget.soft_cap_exceeded) {
    warnings.push('estimated_cost_exceeds_soft_limit');
  }

  const approval_required = !blocked_reasons.length
    && compareRisk(risk_level, resolvedPolicy.approval_threshold || 'high') >= 0;
  const decision = blocked_reasons.length
    ? 'block'
    : approval_required
      ? 'requires_approval'
      : 'allow';

  return {
    decision,
    risk_level,
    approval_required,
    policy_id: resolvedPolicy.policy_id,
    predicted_actions,
    budget,
    warnings,
    blocked_reasons
  };
}
