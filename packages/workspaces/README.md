# Workspaces

Creates per-run execution workspaces for the Control Plane.

## API
- `createRunWorkspace({ runId, repoPath, rootDir, isolationProfileId })`: creates a local snapshot when `repoPath` is an existing directory, or performs a shallow `git clone` when `repoPath` is an explicit Git URL. The workspace records the resolved runner isolation profile.
- `executionCwdForRun(run)`: resolves the workspace path for execution, falling back to the task repo or current process directory.
- `cleanupRunWorkspace(workspace)`: removes a managed local snapshot or Git clone when it is still inside its recorded workspace root.

Local snapshots copy the repository into `DIVINITY_WORKSPACE_ROOT` when set, or the OS temp directory by default. Explicit Git URLs use `git clone --depth 1` into the same workspace root. `node_modules` is excluded or removed to keep snapshots bounded; Git metadata is preserved so Git-based execution adapters can inspect workspace status.

The default runner isolation profile is `workspace_snapshot`. Set `DIVINITY_RUNNER_ISOLATION_PROFILE=container_sandbox` or pass `isolationProfileId` to record Docker container-sandbox intent on workspace metadata. Constrained shell adapters execute through the `packages/runner-isolation` Docker argv plan when that profile is selected; `file_read` remains a deterministic local workspace read.

The API exposes `POST /runs/:id/workspace/cleanup` to remove a run workspace and record a `workspace_cleaned` timeline event.
