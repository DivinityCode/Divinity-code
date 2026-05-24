import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import { cleanupRunWorkspace, createRunWorkspace } from './packages/workspaces/src/index.mjs';

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-workspaces-test-'));
const sourceDir = path.join(tmpDir, 'source');
const remoteSourceDir = path.join(tmpDir, 'remote-source');
const bareRemoteDir = path.join(tmpDir, 'remote.git');
const workspaceRoot = path.join(tmpDir, 'workspaces');

try {
  mkdirSync(path.join(sourceDir, 'src'), { recursive: true });
  mkdirSync(path.join(sourceDir, '.git'), { recursive: true });
  mkdirSync(path.join(sourceDir, 'node_modules', 'left-pad'), { recursive: true });
  writeFileSync(path.join(sourceDir, 'README.md'), '# Source README\n\nSnapshot content.\n');
  writeFileSync(path.join(sourceDir, 'src', 'app.mjs'), "console.log('app');\n");
  writeFileSync(path.join(sourceDir, '.git', 'HEAD'), 'ref: refs/heads/main\n');
  writeFileSync(path.join(sourceDir, 'node_modules', 'left-pad', 'index.js'), 'module.exports = null;\n');

  const workspace = createRunWorkspace({
    runId: 'run_workspace',
    repoPath: sourceDir,
    rootDir: workspaceRoot
  });

  assert.ok(workspace);
  assert.equal(workspace.run_id, 'run_workspace');
  assert.equal(workspace.source_path, sourceDir);
  assert.equal(workspace.kind, 'local_snapshot');
  assert.equal(path.dirname(workspace.path), workspaceRoot);
  assert.match(workspace.created_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(readFileSync(path.join(workspace.path, 'README.md'), 'utf8'), '# Source README\n\nSnapshot content.\n');
  assert.equal(readFileSync(path.join(workspace.path, 'src', 'app.mjs'), 'utf8'), "console.log('app');\n");
  assert.equal(readFileSync(path.join(workspace.path, '.git', 'HEAD'), 'utf8'), 'ref: refs/heads/main\n');
  assert.equal(existsSync(path.join(workspace.path, 'node_modules')), false);

  writeFileSync(path.join(sourceDir, 'README.md'), '# Source README\n\nSource changed after snapshot.\n');
  assert.match(readFileSync(path.join(workspace.path, 'README.md'), 'utf8'), /Snapshot content/);

  const cleanup = cleanupRunWorkspace(workspace);
  assert.equal(cleanup.cleaned, true);
  assert.equal(cleanup.path, workspace.path);
  assert.match(cleanup.cleaned_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(existsSync(workspace.path), false);

  const secondCleanup = cleanupRunWorkspace(workspace);
  assert.equal(secondCleanup.cleaned, false);
  assert.equal(secondCleanup.reason, 'workspace_not_found');

  assert.equal(cleanupRunWorkspace({
    kind: 'local_snapshot',
    path: sourceDir,
    source_path: sourceDir
  }).cleaned, false);

  mkdirSync(remoteSourceDir, { recursive: true });
  writeFileSync(path.join(remoteSourceDir, 'README.md'), '# Remote README\n\nCloned evidence.\n');
  execFileSync('git', ['init'], { cwd: remoteSourceDir, stdio: 'ignore' });
  execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: remoteSourceDir });
  execFileSync('git', ['config', 'user.name', 'Divinity Test'], { cwd: remoteSourceDir });
  execFileSync('git', ['add', 'README.md'], { cwd: remoteSourceDir });
  execFileSync('git', ['commit', '-m', 'seed remote'], { cwd: remoteSourceDir, stdio: 'ignore' });
  execFileSync('git', ['clone', '--bare', remoteSourceDir, bareRemoteDir], { stdio: 'ignore' });

  const remoteUrl = `file://${bareRemoteDir}`;
  const remoteWorkspace = createRunWorkspace({
    runId: 'run_remote_git',
    repoPath: remoteUrl,
    rootDir: workspaceRoot
  });
  assert.ok(remoteWorkspace);
  assert.equal(remoteWorkspace.kind, 'remote_git_clone');
  assert.equal(remoteWorkspace.repo_url, remoteUrl);
  assert.equal(path.dirname(remoteWorkspace.path), workspaceRoot);
  assert.match(readFileSync(path.join(remoteWorkspace.path, 'README.md'), 'utf8'), /Cloned evidence/);
  assert.equal(existsSync(path.join(remoteWorkspace.path, '.git')), true);

  const remoteCleanup = cleanupRunWorkspace(remoteWorkspace);
  assert.equal(remoteCleanup.cleaned, true);
  assert.equal(existsSync(remoteWorkspace.path), false);

  assert.equal(createRunWorkspace({
    runId: 'run_remote',
    repoPath: 'github.com/org/repo',
    rootDir: workspaceRoot
  }), null);

  console.log(JSON.stringify({ ok: true, test: 'workspaces' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
