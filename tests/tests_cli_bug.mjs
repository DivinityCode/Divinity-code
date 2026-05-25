import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

function runCli(tmpDir, ...args) {
  const output = execFileSync(
    process.execPath,
    [path.resolve('apps/cli/src/index.mjs'), ...args],
    { cwd: tmpDir, encoding: 'utf8' }
  );
  return JSON.parse(output);
}

const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-cli-bug-test-'));

try {
  execFileSync('git', ['init', '-b', 'main'], { cwd: tmpDir, stdio: 'ignore' });
  writeFileSync(path.join(tmpDir, 'README.md'), '# Bug Fixture\n');
  writeFileSync(path.join(tmpDir, 'package.json'), JSON.stringify({ name: 'bug-fixture' }, null, 2));

  const result = runCli(tmpDir, 'bug', 'Dashboard', 'does', 'not', 'load');

  assert.equal(result.ok, true);
  assert.equal(result.command, 'bug');
  assert.equal(result.report.format, 'divinity.bug_report.v1');
  assert.equal(result.report.summary, 'Dashboard does not load');
  assert.match(result.report.title, /Dashboard does not load/);
  assert.match(result.report.created_at, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(result.report.cwd, tmpDir);
  assert.equal(result.report.environment.node, process.version);
  assert.equal(typeof result.report.environment.platform, 'string');
  assert.equal(result.report.git.branch, 'main');
  assert.match(result.report.git.status_short, /\?\? README\.md/);
  assert.ok(Array.isArray(result.report.diagnostics.checks));
  assert.equal(typeof result.report.diagnostics.ok, 'boolean');
  assert.ok(result.report.diagnostics.checks.some(check => check.check_id === 'node'));
  assert.ok(result.report.diagnostics.checks.some(check => check.check_id === 'git'));
  assert.match(result.report.markdown, /## Summary/);
  assert.match(result.report.markdown, /Dashboard does not load/);
  assert.match(result.report.markdown, /## Diagnostics/);

  console.log(JSON.stringify({ ok: true, test: 'cli-bug' }));
} finally {
  rmSync(tmpDir, { recursive: true, force: true });
}
