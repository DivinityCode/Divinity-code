# Artifacts Package
Owner: Platform

Creates run artifact metadata and content for patch, log, and summary outputs.

## Current Surface
- `createRunArtifacts(...)` builds patch, log, and summary artifact records for a run.
- Patch artifacts include a deterministic unified-diff payload for `DIVINITY_TASK.md` generated from run context.
- Summary artifacts include a `decision_trace` with the chosen path, rejected alternative, rationale, and evidence references.
- `publicArtifactMetadata(...)` strips artifact content for run summaries and list endpoints.
