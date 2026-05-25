# Goals

`packages/goals` turns task `success_criteria` into durable run-level goal records.

Each record keeps the criterion text, run and task identity, org/project scope, lifecycle status, a budget allocation, and evidence references back to the criterion and budget preflight.

Goal completion is constrained to passed verifier evidence. `completeGoalRecord(...)` requires a `verification.result === "passed"` record and appends observed completion evidence before setting the goal to `completed`.
