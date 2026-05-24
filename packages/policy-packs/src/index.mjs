export const TEAM_POLICY_PACKS = [
  {
    pack_id: 'team_policy_starter',
    name: 'Starter Team Policy',
    scope: { org_id: 'default-org' },
    default_policy_id: 'safe_exec',
    approval_threshold: 'high',
    budget_defaults: { soft_limit_usd: 2, hard_limit_usd: 5 }
  },
  {
    pack_id: 'team_policy_regulated',
    name: 'Regulated Team Policy',
    scope: { org_id: 'regulated-org' },
    default_policy_id: 'scoped_edit',
    approval_threshold: 'medium',
    budget_defaults: { soft_limit_usd: 1, hard_limit_usd: 3 }
  }
];

function publicPolicyPack(pack) {
  return {
    ...pack,
    scope: { ...pack.scope },
    budget_defaults: { ...pack.budget_defaults }
  };
}

export function resolvePolicyPackForTask(task = {}) {
  const orgId = task.scope?.org_id || 'default-org';
  const pack = TEAM_POLICY_PACKS.find(candidate => candidate.scope.org_id === orgId) || TEAM_POLICY_PACKS[0];
  return publicPolicyPack(pack);
}
