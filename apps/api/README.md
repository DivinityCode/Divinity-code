# API App
Owner: Control Plane

Planned endpoints: task creation, run retrieval, preflight checks.

## Current Endpoints
- `GET /health`
- `GET /audit`
- `POST /preflight`
- `POST /tasks`
- `GET /approvals`
- `GET /runs/:id`
- `GET /runs/:id/events`
- `GET /runs/:id/stream`
- `GET /runs/:id/artifacts`
- `GET /artifacts/:artifact_id`
- `POST /runs/:id/steps`
- `POST /runs/:id/approval`
