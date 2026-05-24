# Workspaces

Creates per-run execution workspaces for the Control Plane.

## API
- `createRunWorkspace({ runId, repoPath, rootDir })`: creates a local snapshot when `repoPath` is an existing directory and returns workspace metadata.
- `executionCwdForRun(run)`: resolves the workspace path for execution, falling back to the task repo or current process directory.

Local snapshots copy the repository into `DIVINITY_WORKSPACE_ROOT` when set, or the OS temp directory by default. `node_modules` is excluded to keep snapshots bounded; Git metadata is preserved so Git-based execution adapters can inspect workspace status.

Remote repository checkout, workspace cleanup policies, and containerized runner isolation remain future execution-plane work.
