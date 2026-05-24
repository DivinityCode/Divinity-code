# API App
Owner: Control Plane

Planned endpoints: task creation, run retrieval, preflight checks.

## Authentication
Control-plane routes are public in local development when no API key is configured.
Set `DIVINITY_API_KEY` or comma-separated `DIVINITY_API_KEYS` to require `Authorization: Bearer <key>` on all API routes except `GET /health` and CORS `OPTIONS` preflight requests.

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

Task creation normalizes missing scope to `default-org/default-project`; callers can pass `scope.org_id` and `scope.project_id` to associate a run with an org and project.
