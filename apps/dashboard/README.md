# Dashboard App
Owner: Operator Experience

Static operator dashboard shell for the bootstrap MVP.

Implemented views:
- Task queue with status filtering and search.
- Run detail timeline with contract-shaped run events.
- Approval queue with local approve/reject state transitions.
- Cost, risk, artifact, and audit metadata panels.

Open `index.html` directly in a browser for local inspection. The shell uses
sample data shaped after the current API contracts and does not require a build
step.

To load local API data instead, start the API and open:

```text
index.html?api=http://127.0.0.1:3000
```

With an API base URL present, refresh loads `GET /runs` and approve/reject posts
to `POST /runs/:id/approval`. The selected run also subscribes to
`GET /runs/:id/stream` for live status updates.
