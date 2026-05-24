export const STARTER_RECIPES = [
  {
    recipe_id: 'recipe_safe_readme_review',
    title: 'Review Project Readme',
    description: 'Run a low-risk repository review and produce a summary artifact.',
    objective: 'Review the README and summarize setup gaps',
    policy_id: 'read_only',
    scope: { org_id: 'default-org', project_id: 'default-project' },
    budget: { soft_limit_usd: 1, hard_limit_usd: 2 },
    steps: [
      'Initialize the workspace with the read-only policy preset.',
      'Run the README review objective from the CLI.',
      'Inspect the summary artifact and audit record.'
    ]
  },
  {
    recipe_id: 'recipe_scoped_docs_update',
    title: 'Draft Documentation Update',
    description: 'Use scoped edit permissions for a small documentation improvement.',
    objective: 'Update onboarding documentation with missing setup notes',
    policy_id: 'scoped_edit',
    scope: { org_id: 'default-org', project_id: 'docs' },
    budget: { soft_limit_usd: 2, hard_limit_usd: 4 },
    steps: [
      'Initialize with the scoped-edit policy preset.',
      'Submit the documentation objective.',
      'Review generated patch, log, summary, and decision trace artifacts.'
    ]
  },
  {
    recipe_id: 'recipe_safe_test_fix',
    title: 'Investigate Failing Test',
    description: 'Use safe execution with an approval-aware budget for a test repair loop.',
    objective: 'Run failing tests, identify the smallest fix, and summarize evidence',
    policy_id: 'safe_exec',
    scope: { org_id: 'default-org', project_id: 'quality' },
    budget: { soft_limit_usd: 3, hard_limit_usd: 6 },
    steps: [
      'Initialize with safe execution and explicit budget caps.',
      'Submit the failing-test investigation objective.',
      'Approve high-risk execution if the run enters the approval queue.'
    ]
  },
  {
    recipe_id: 'recipe_budget_pause_demo',
    title: 'Budget Pause Walkthrough',
    description: 'Exercise hard budget cap behavior without running side-effecting work.',
    objective: 'Update source files with a deliberately low hard budget cap',
    policy_id: 'safe_exec',
    scope: { org_id: 'default-org', project_id: 'governance' },
    budget: { soft_limit_usd: 0.1, hard_limit_usd: 0.1 },
    steps: [
      'Initialize safe execution with a very low hard budget.',
      'Submit an update objective that exceeds the hard cap.',
      'Confirm the run pauses and records budget evidence before execution.'
    ]
  }
];

export function publicStarterRecipes() {
  return STARTER_RECIPES.map(recipe => ({ ...recipe }));
}
