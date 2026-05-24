# Starter Recipes

Divinity Code ships four guided recipes for first-run onboarding:

| Recipe | Policy | Purpose |
| --- | --- | --- |
| Review Project Readme | `read_only` | Inspect setup gaps without write or execution permissions. |
| Draft Documentation Update | `scoped_edit` | Produce a small documentation patch with artifact review. |
| Investigate Failing Test | `safe_exec` | Run a test repair loop with approval-aware execution. |
| Budget Pause Walkthrough | `safe_exec` | Demonstrate hard budget cap pause behavior. |

The CLI exposes these through `divinity recipes`, and `divinity init` includes the same recipes in its onboarding JSON output.
