# Dashboard App
Owner: Operator Experience

Static operator dashboard shell for the bootstrap MVP.

Implemented views:
- Task queue with status filtering and search.
- Run detail timeline with contract-shaped run events.
- Approval queue with local approve/reject state transitions.
- Cost, risk, artifact, PR summary artifact, and audit metadata panels.
- Observability summary with run health, heartbeat liveness, org/project budget rollups, budget pressure, and failure taxonomy.
- Decision trace panel with chosen path, rejected alternative, rationale, and supporting evidence.
- Connector reference panel for attached ticket, docs, and CI context.
- Agent activity panel for planner, executor, and verifier actor/status/budget records.
- Execution panel with post-execution verifier result chips.

Open `index.html` directly in a browser for local inspection. The shell uses
sample data shaped after the current API contracts and does not require a build
step. Run detail renders connector references, agent activity, execution
records, verification records, and liveness records from
`run.connector_references`, `run.agent_activity`,
`run.executions`/`run.verifications`, `run.heartbeats`, or completed step
payloads when API data is loaded.

To load local API data instead, start the API and open:

```text
index.html?api=http://127.0.0.1:3000
```

With an API base URL present, refresh loads `GET /runs` and
`GET /observability`, and approve/reject posts to `POST /runs/:id/approval`.
The selected run also subscribes to `GET /runs/:id/stream` for live status
updates, including heartbeat changes.
