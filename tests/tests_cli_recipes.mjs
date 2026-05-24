import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { STARTER_RECIPES } from '../packages/recipes/src/index.mjs';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

function assertRecipes(recipes) {
  assert.ok(Array.isArray(recipes));
  assert.ok(recipes.length >= 4);
  assert.equal(new Set(recipes.map(recipe => recipe.recipe_id)).size, recipes.length);

  for (const recipe of recipes) {
    assert.match(recipe.recipe_id, /^recipe_/);
    assert.equal(typeof recipe.title, 'string');
    assert.equal(typeof recipe.description, 'string');
    assert.equal(typeof recipe.objective, 'string');
    assert.equal(typeof recipe.policy_id, 'string');
    assert.equal(typeof recipe.scope.org_id, 'string');
    assert.equal(typeof recipe.scope.project_id, 'string');
    assert.ok(recipe.budget.soft_limit_usd > 0);
    assert.ok(recipe.budget.hard_limit_usd >= recipe.budget.soft_limit_usd);
    assert.ok(Array.isArray(recipe.steps));
    assert.ok(recipe.steps.length >= 3);
  }
}

assertRecipes(STARTER_RECIPES);

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-recipes-test-'));

try {
  const recipesResult = runCli(tmpDir, 'recipes');
  assert.equal(recipesResult.ok, true);
  assert.equal(recipesResult.command, 'recipes');
  assertRecipes(recipesResult.recipes);

  const initResult = runCli(tmpDir, 'init');
  assert.equal(initResult.ok, true);
  assertRecipes(initResult.starter_recipes);

  console.log(JSON.stringify({ ok: true, test: 'cli-recipes' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
