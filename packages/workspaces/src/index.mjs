import { spawnSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { resolveRunnerIsolationProfile } from '../../runner-isolation/src/index.mjs';

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

function isGitCloneUrl(repoPath) {
  return Boolean(repoPath && (
    /^file:\/\//i.test(repoPath)
    || /^https:\/\/.+/i.test(repoPath)
    || /^ssh:\/\/.+/i.test(repoPath)
    || /^git@[^:]+:.+/i.test(repoPath)
  ));
}

function safeRunSegment(runId) {
  return (runId || 'run').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

function isVolatileGitObject(source) {
  const normalized = source.split(path.sep).join('/');
  if (!normalized.includes('/.git/objects/')) return false;
  const basename = path.basename(source);
  return basename.startsWith('bitmap-ref-tips_') || basename.startsWith('tmp_');
}

function shouldCopy(source) {
  if (source.includes(`${path.sep}.git${path.sep}`) && source.endsWith('.lock')) return false;
  if (isVolatileGitObject(source)) return false;
  return !EXCLUDED_DIRECTORIES.has(path.basename(source));
}

function copyLocalSnapshot(sourcePath, workspacePath) {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      cpSync(sourcePath, workspacePath, {
        recursive: true,
        filter: shouldCopy
      });
      return;
    } catch (error) {
      if (attempt === 0 && error?.code === 'ENOENT') {
        rmSync(workspacePath, { recursive: true, force: true });
        continue;
      }
      throw error;
    }
  }
}

function isPathInside(childPath, parentPath) {
  const relative = path.relative(parentPath, childPath);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

export function createRunWorkspace({
  runId,
  repoPath,
  rootDir = process.env.DIVINITY_WORKSPACE_ROOT || DEFAULT_WORKSPACE_ROOT,
  isolationProfileId = process.env.DIVINITY_RUNNER_ISOLATION_PROFILE || 'workspace_snapshot'
} = {}) {
  const workspaceRoot = path.resolve(rootDir);
  mkdirSync(workspaceRoot, { recursive: true });
  const workspacePath = path.join(workspaceRoot, `${safeRunSegment(runId)}-${Date.now()}`);
  const isolation = resolveRunnerIsolationProfile({ profile_id: isolationProfileId });

  if (isLocalDirectory(repoPath)) {
    const sourcePath = path.resolve(repoPath);
    copyLocalSnapshot(sourcePath, workspacePath);

    return {
      run_id: runId,
      kind: 'local_snapshot',
      source_path: sourcePath,
      root_path: workspaceRoot,
      path: workspacePath,
      isolation,
      created_at: new Date().toISOString()
    };
  }

  if (!isGitCloneUrl(repoPath)) return null;

  const clone = spawnSync('git', ['clone', '--depth', '1', repoPath, workspacePath], {
    encoding: 'utf8'
  });

  if (clone.status !== 0) {
    rmSync(workspacePath, { recursive: true, force: true });
    return {
      run_id: runId,
      kind: 'remote_git_clone_failed',
      repo_url: repoPath,
      root_path: workspaceRoot,
      path: null,
      isolation,
      created_at: new Date().toISOString(),
      error: clone.stderr || clone.error?.message || 'git clone failed'
    };
  }

  rmSync(path.join(workspacePath, 'node_modules'), { recursive: true, force: true });

  return {
    run_id: runId,
    kind: 'remote_git_clone',
    repo_url: repoPath,
    root_path: workspaceRoot,
    path: workspacePath,
    isolation,
    created_at: new Date().toISOString()
  };
}

export function executionCwdForRun(run) {
  return ['local_snapshot', 'remote_git_clone'].includes(run?.workspace?.kind) && run?.workspace?.path
    ? run.workspace.path
    : run?.task?.repo || process.cwd();
}

export function cleanupRunWorkspace(workspace) {
  if (!workspace || !['local_snapshot', 'remote_git_clone'].includes(workspace.kind) || !workspace.path || !workspace.root_path) {
    return {
      cleaned: false,
      reason: 'workspace_unmanaged',
      path: workspace?.path || null
    };
  }

  const targetPath = path.resolve(workspace.path);
  const rootPath = path.resolve(workspace.root_path);
  const sourcePath = workspace.source_path ? path.resolve(workspace.source_path) : null;

  if (!isPathInside(targetPath, rootPath) || targetPath === rootPath) {
    return {
      cleaned: false,
      reason: 'workspace_outside_root',
      path: targetPath
    };
  }

  if (sourcePath && targetPath === sourcePath) {
    return {
      cleaned: false,
      reason: 'workspace_matches_source',
      path: targetPath
    };
  }

  if (!existsSync(targetPath)) {
    return {
      cleaned: false,
      reason: 'workspace_not_found',
      path: targetPath
    };
  }

  rmSync(targetPath, { recursive: true, force: true });

  return {
    cleaned: true,
    path: targetPath,
    cleaned_at: new Date().toISOString()
  };
}
