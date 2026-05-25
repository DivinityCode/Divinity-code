# Goals

`packages/goals` turns task `success_criteria` into durable run-level goal records.

Each record keeps the criterion text, run and task identity, org/project scope, an initial lifecycle status, a budget allocation, and evidence references back to the criterion and budget preflight. This is intentionally record-only: goal mutation and completion routes are left for later slices.
