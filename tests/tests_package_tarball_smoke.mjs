import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const npmBin = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-package-tarball-'));
const packDir = path.join(tmpRoot, 'pack');
const consumerDir = path.join(tmpRoot, 'consumer');

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: process.cwd(),
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
    ...options
  });
}

function runJson(command, args, options = {}) {
  return JSON.parse(run(command, args, options));
}

try {
  mkdirSync(packDir, { recursive: true });
  mkdirSync(consumerDir, { recursive: true });

  const packResult = runJson(npmBin, ['pack', '--json', '--pack-destination', packDir]);
  assert.equal(Array.isArray(packResult), true);
  assert.equal(packResult.length, 1);
  assert.equal(packResult[0].name, 'divinity-code');
  assert.match(packResult[0].filename, /^divinity-code-0\.1\.0\.tgz$/);
  assert.ok(packResult[0].files.some(file => file.path === 'apps/cli/src/index.mjs'));
  assert.ok(packResult[0].files.some(file => file.path === 'packages/provider-runtime/providers.v1.json'));
  assert.equal(packResult[0].files.some(file => file.path.startsWith('tests/')), false);

  const tarballPath = path.join(packDir, packResult[0].filename);
  assert.equal(existsSync(tarballPath), true);

  writeFileSync(path.join(consumerDir, 'package.json'), JSON.stringify({
    name: 'divinity-package-consumer',
    private: true,
    version: '0.0.0'
  }, null, 2));

  run(npmBin, ['install', '--no-audit', '--no-fund', '--ignore-scripts', tarballPath], {
    cwd: consumerDir
  });

  const installedPackageJson = JSON.parse(readFileSync(path.join(consumerDir, 'node_modules', 'divinity-code', 'package.json'), 'utf8'));
  assert.equal(installedPackageJson.name, 'divinity-code');
  assert.deepEqual(installedPackageJson.bin, { divinity: 'apps/cli/src/index.mjs' });

  const binPath = path.join(consumerDir, 'node_modules', '.bin', process.platform === 'win32' ? 'divinity.cmd' : 'divinity');
  assert.equal(existsSync(binPath), true);

  const doctor = runJson(process.execPath, [binPath, 'doctor'], { cwd: consumerDir });
  assert.equal(doctor.ok, true);
  assert.equal(doctor.command, 'doctor');
  assert.equal(doctor.profile, 'runtime');
  assert.ok(doctor.checks.some(check => check.check_id === 'cli_entrypoint' && check.ok === true));
  assert.equal(doctor.checks.some(check => check.check_id === 'api_server_source'), false);
  assert.equal(doctor.checks.some(check => check.check_id === 'node_modules'), false);

  const providers = runJson(process.execPath, [binPath, 'providers'], { cwd: consumerDir });
  assert.equal(providers.ok, true);
  assert.equal(providers.command, 'providers');
  assert.ok(providers.llm_providers.some(provider => provider.provider_id === 'openrouter'));

  console.log(JSON.stringify({ ok: true, test: 'package-tarball-smoke' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
