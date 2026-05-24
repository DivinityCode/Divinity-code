# Run Store

Persists API run state for the Control Plane.

## API
- `createRunStore({ filePath })`: returns `runs`, `artifacts`, `auditRecords`, and `persist()`.
- `createConfiguredRunStore(env)`: reads `DIVINITY_RUN_STORE_PATH` and falls back to an in-memory store when unset.

The file-backed store writes a versioned JSON snapshot with runs, artifact records, and audit records. Writes are atomic through a temporary file and rename.

## API Integration
Set `DIVINITY_RUN_STORE_PATH=/path/to/runs.json` before starting `apps/api` to preserve run state across API restarts. Leave it unset for deterministic in-memory test and demo runs.
