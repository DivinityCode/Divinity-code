import assert from 'assert/strict';
import { execFileSync } from 'child_process';
import { existsSync, mkdtempSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
const tmpDir = mkdtempSync(path.join(tmpdir(), 'divinity-release-artifacts-'));
const outputPath = path.join(tmpDir, 'release-artifacts.json');

const output = execFileSync(
  process.execPath,
  [path.resolve('tests/scripts_release_artifacts.mjs'), '--output', outputPath],
  { cwd: process.cwd(), encoding: 'utf8' }
);
const result = JSON.parse(output);

assert.equal(result.ok, true);
assert.equal(result.artifact_path, outputPath);
assert.equal(existsSync(outputPath), true);

const artifact = JSON.parse(readFileSync(outputPath, 'utf8'));
assert.deepEqual(result.artifact, artifact);
assert.equal(artifact.format, 'divinity.release_artifacts.v1');
assert.equal(artifact.package.name, packageJson.name);
assert.equal(artifact.package.version, packageJson.version);
assert.equal(artifact.package.private, packageJson.private);
assert.equal(artifact.package.license, packageJson.license);
assert.equal(artifact.package.repository_url, packageJson.repository.url);
assert.equal(artifact.package.node_engine, packageJson.engines.node);
assert.equal(artifact.package.package_manager, packageJson.packageManager);
assert.deepEqual(artifact.package.bin, packageJson.bin);
assert.equal(artifact.non_production_warning_active, true);

const installPathsById = new Map(artifact.install_paths.map(installPath => [installPath.install_path_id, installPath]));
for (const installPathId of [
  'source_checkout',
  'pnpm_global_link',
  'package_registry',
  'binary_download'
]) {
  assert.ok(installPathsById.has(installPathId), `missing install path: ${installPathId}`);
}

assert.equal(installPathsById.get('source_checkout').status, 'available');
assert.match(installPathsById.get('source_checkout').command, /node apps\/cli\/src\/index\.mjs doctor/);
assert.equal(installPathsById.get('pnpm_global_link').status, 'available');
assert.match(installPathsById.get('pnpm_global_link').command, /pnpm link --global/);
assert.equal(installPathsById.get('package_registry').status, 'blocked');
assert.match(installPathsById.get('package_registry').reason, /private/);
assert.equal(installPathsById.get('binary_download').status, 'blocked');
assert.match(installPathsById.get('binary_download').reason, /non-production warning/);

for (const command of [
  'pnpm run test:package',
  'node apps/cli/src/index.mjs doctor',
  'node apps/cli/src/index.mjs doctor --profile source',
  'pnpm run validate:contracts',
  'pnpm run test:smoke',
  'pnpm run test:providers',
  'pnpm test'
]) {
  assert.ok(
    artifact.release_gates.some(gate => gate.command === command),
    `missing release gate: ${command}`
  );
}

const serialized = JSON.stringify(artifact);
for (const disallowed of [
  'npm install -g divinity-code',
  'npx divinity',
  'public shared key',
  'no-signup',
  'bypass'
]) {
  assert.equal(serialized.includes(disallowed), false, `release artifact must not include ${disallowed}`);
}

console.log(JSON.stringify({ ok: true, test: 'release-artifacts' }));
