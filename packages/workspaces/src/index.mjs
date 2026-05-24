import { cpSync, mkdirSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const DEFAULT_WORKSPACE_ROOT = path.join(tmpdir(), 'divinity-run-workspaces');
const EXCLUDED_DIRECTORIES = new Set(['node_modules']);

function isLocalDirectory(repoPath) {
  if (!repoPath || /^https?:\/\//i.test(repoPath) || /^[\w.-]+\/[\w.-]+(?:\.git)?$/i.test(repoPath)) {
    return false;
  }

  try {
    return statSync(repoPath).isDirectory();
  } catch {
    return false;
  }
}

function safeRunSegment(runId) {
  return (runId || 'run').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function shouldCopy(source) {
  return !EXCLUDED_DIRECTORIES.has(path.basename(source));
}

export function createRunWorkspace({ runId, repoPath, rootDir = process.env.DIVINITY_WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT } = {}) {
  if (!isLocalDirectory(repoPath)) return null;

  const sourcePath = path.resolve(repoPath);
  const workspaceRoot = path.resolve(rootDir);
  mkdirSync(workspaceRoot, { recursive: true });

  const workspacePath = path.join(workspaceRoot, `${safeRunSegment(runId)}-${Date.now()}`);
  cpSync(sourcePath, workspacePath, {
    recursive: true,
    filter: shouldCopy
  });

  return {
    run_id: runId,
    kind: 'local_snapshot',
    source_path: sourcePath,
    path: workspacePath,
    created_at: new Date().toISOString()
  };
}

export function executionCwdForRun(run) {
  return run?.workspace?.path || run?.task?.repo || process.cwd();
}
