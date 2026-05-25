import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';

const DEFAULT_OUTPUT = path.join('dist', 'release-artifacts.json');

function parseArgs(values) {
  const options = {
    output: DEFAULT_OUTPUT
  };

  for (let index = 0; index < values.length; index += 1) {
    const value = values[index];
    const next = values[index + 1];

    if (value === '--output') {
      options.output = next;
      index += 1;
    } else if (value.startsWith('--output=')) {
      options.output = value.slice('--output='.length);
    } else {
      throw new Error(`unknown release artifact option: ${value}`);
    }
  }

  options.output = String(options.output || '').trim() || DEFAULT_OUTPUT;
  return options;
}

function buildManifest() {
  const packageJson = JSON.parse(readFileSync('package.json', 'utf8'));
  const publishingBlocked = packageJson.private === true;
  const warningReason = 'README warning marks Divinity Code as under heavy active development and not production-ready.';

  return {
    format: 'divinity.release_artifacts.v1',
    generated_by: 'tests/scripts_release_artifacts.mjs',
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
      license: packageJson.license,
      repository_url: packageJson.repository?.url || '',
      node_engine: packageJson.engines?.node || '',
      package_manager: packageJson.packageManager || '',
      bin: packageJson.bin || {}
    },
    non_production_warning_active: true,
    install_paths: [
      {
        install_path_id: 'source_checkout',
        status: 'available',
        label: 'Source checkout CLI',
        command: 'node apps/cli/src/index.mjs doctor',
        notes: 'Use this path for contributor and local evaluation workflows.'
      },
      {
        install_path_id: 'pnpm_global_link',
        status: 'available',
        label: 'Local pnpm-linked CLI',
        command: 'pnpm link --global && divinity doctor',
        notes: 'Use from a reviewed local checkout; this does not publish the package.'
      },
      {
        install_path_id: 'package_registry',
        status: publishingBlocked ? 'blocked' : 'available',
        label: 'Package registry install',
        command: '',
        reason: publishingBlocked
          ? 'package.json private=true blocks registry publishing until the production warning is cleared.'
          : 'Package registry publishing is allowed by package metadata.'
      },
      {
        install_path_id: 'binary_download',
        status: 'blocked',
        label: 'Signed binary download',
        command: '',
        reason: `No signed binary artifact is published while the non-production warning is active. ${warningReason}`
      }
    ],
    release_gates: [
      {
        gate_id: 'package_manifest',
        command: 'pnpm run test:package',
        required: true
      },
      {
        gate_id: 'runtime_doctor',
        command: 'node apps/cli/src/index.mjs doctor',
        required: true
      },
      {
        gate_id: 'source_doctor',
        command: 'node apps/cli/src/index.mjs doctor --profile source',
        required: true
      },
      {
        gate_id: 'contracts',
        command: 'pnpm run validate:contracts',
        required: true
      },
      {
        gate_id: 'smoke',
        command: 'pnpm run test:smoke',
        required: true
      },
      {
        gate_id: 'providers',
        command: 'pnpm run test:providers',
        required: true
      },
      {
        gate_id: 'full_suite',
        command: 'pnpm test',
        required: true
      }
    ],
    policy: {
      publishing_blocked: publishingBlocked,
      operator_owned_credentials_required: true,
      unsupported_install_commands: [
        'global npm install',
        'direct package execution through npm package runner'
      ],
      unsupported_provider_inputs: [
        'shared public credentials',
        'signup-free credential pools',
        'quota circumvention routing'
      ]
    }
  };
}

const options = parseArgs(process.argv.slice(2));
const artifactPath = path.resolve(options.output);
const artifact = buildManifest();

mkdirSync(path.dirname(artifactPath), { recursive: true });
writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

process.stdout.write(`${JSON.stringify({ ok: true, artifact_path: artifactPath, artifact }, null, 2)}\n`);
