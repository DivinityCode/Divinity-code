# Artifacts Package
Owner: Platform

Creates run artifact metadata and scaffolded content for patch, log, and summary outputs.

## Current Surface
- `createRunArtifacts(...)` builds patch, log, and summary artifact records for a run.
- Summary artifacts include a `decision_trace` with the chosen path, rejected alternative, rationale, and evidence references.
- `publicArtifactMetadata(...)` strips artifact content for run summaries and list endpoints.
