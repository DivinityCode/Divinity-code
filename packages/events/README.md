# Events Package
Owner: Platform

Defines run event envelopes shared by CLI, API, and dashboard.

## Current Surface
- `createRunEvent(...)` builds a single `RunEvent` envelope.
- `createInitialRunEvents(...)` builds task-created, preflight-completed, and status-changed events for a new run.
