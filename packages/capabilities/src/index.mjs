import { publicExecutionAdapters } from '../../execution/src/index.mjs';
import { publicConnectorAdapters } from '../../connectors/src/index.mjs';
import { POLICY_PRESETS } from '../../policy-engine/src/index.mjs';
import { publicStarterRecipes } from '../../recipes/src/index.mjs';

function publicPolicies() {
  return Object.values(POLICY_PRESETS).map(policy => ({
    policy_id: policy.policy_id,
    permissions: [...(policy.permissions || [])],
    approval_threshold: policy.approval_threshold
  }));
}

function publicRecipeCapabilities() {
  return publicStarterRecipes().map(recipe => ({
    recipe_id: recipe.recipe_id,
    title: recipe.title,
    policy_id: recipe.policy_id,
    scope: { ...recipe.scope },
    budget: { ...recipe.budget }
  }));
}

export function createCapabilitiesCatalog({ generated_at = new Date().toISOString() } = {}) {
  return {
    format: 'divinity.capabilities.v1',
    generated_at,
    policies: publicPolicies(),
    execution_adapters: publicExecutionAdapters(),
    connector_adapters: publicConnectorAdapters(),
    starter_recipes: publicRecipeCapabilities()
  };
}
