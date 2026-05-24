# Artifacts Package
Owner: Platform

Creates run artifact metadata and content for patch, log, summary, and PR summary outputs.

## Current Surface
- `createRunArtifacts(...)` builds patch, log, summary, and PR summary artifact records for a run.
- Patch artifacts include a deterministic unified-diff payload for `DIVINITY_TASK.md` generated from run context.
- Summary artifacts include a `decision_trace` with the chosen path, rejected alternative, rationale, and evidence references.
- PR summary artifacts include a GitHub-ready title, Markdown body, and the same decision trace used by the run summary.
- `publicArtifactMetadata(...)` strips artifact content for run summaries and list endpoints.
