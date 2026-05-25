export const TEAM_POLICY_PACKS = [
  {
    pack_id: 'team_policy_starter',
    name: 'Starter Team Policy',
    scope: { org_id: 'default-org' },
    default_policy_id: 'safe_exec',
    approval_threshold: 'high',
    budget_defaults: { soft_limit_usd: 2, hard_limit_usd: 5 },
    pre_execution_hooks: [
      {
        hook_id: 'block_destructive_shell',
        name: 'Block destructive shell commands',
        stage: 'pre_execution',
        effect: 'block',
        action_types: ['shell'],
        pattern: '\\b(rm\\s+-rf|drop\\s+database)\\b',
        reason: 'destructive_shell_command'
      }
    ]
  },
  {
    pack_id: 'team_policy_regulated',
    name: 'Regulated Team Policy',
    scope: { org_id: 'regulated-org' },
    default_policy_id: 'scoped_edit',
    approval_threshold: 'medium',
    budget_defaults: { soft_limit_usd: 1, hard_limit_usd: 3 },
    pre_execution_hooks: [
      {
        hook_id: 'block_destructive_shell',
        name: 'Block destructive shell commands',
        stage: 'pre_execution',
        effect: 'block',
        action_types: ['shell'],
        pattern: '\\b(rm\\s+-rf|drop\\s+database)\\b',
        reason: 'destructive_shell_command'
      },
      {
        hook_id: 'warn_regulated_write_scope',
        name: 'Warn on regulated file writes',
        stage: 'pre_execution',
        effect: 'warn',
        action_types: ['file_write'],
        pattern: null,
        reason: 'regulated_write_scope_review'
      }
    ]
  }
];

function publicPolicyPack(pack) {
  return {
    ...pack,
    scope: { ...pack.scope },
    budget_defaults: { ...pack.budget_defaults },
    pre_execution_hooks: (pack.pre_execution_hooks || []).map(hook => ({
      ...hook,
      action_types: [...(hook.action_types || [])]
    }))
  };
}

export function resolvePolicyPackForTask(task = {}) {
  const orgId = task.scope?.org_id || 'default-org';
  const pack = TEAM_POLICY_PACKS.find(candidate => candidate.scope.org_id === orgId) || TEAM_POLICY_PACKS[0];
  return publicPolicyPack(pack);
}
