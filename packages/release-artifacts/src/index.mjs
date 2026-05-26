import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';

export const RELEASE_ARTIFACTS_FORMAT = 'divinity.release_artifacts.v1';
export const SOURCE_PROVENANCE_FORMAT = 'divinity.release_source_provenance.v1';
export const RELEASE_SBOM_FORMAT = 'divinity.release_sbom.v1';
export const DEFAULT_RELEASE_ARTIFACT_OUTPUT = path.join('dist', 'release-artifacts.json');
export const RELEASE_SIGNING_COMMAND_ENV = 'DIVINITY_RELEASE_SIGNING_COMMAND';
export const RELEASE_SIGNING_COMMAND_ARGS_ENV = 'DIVINITY_RELEASE_SIGNING_COMMAND_ARGS';
export const RELEASE_SIGNING_KEY_REF_ENV = 'DIVINITY_RELEASE_SIGNING_KEY_REF';
export const RELEASE_SIGNING_IDENTITY_ENV = 'DIVINITY_RELEASE_SIGNING_IDENTITY';

function cleanString(value) {
  return String(value || '').trim();
}

function skippedIntegrityPath(relativePath) {
  return (
    relativePath.startsWith('node_modules/') ||
    relativePath.startsWith('dist/') ||
    relativePath.startsWith('.git/') ||
    relativePath.includes('/node_modules/') ||
    relativePath.includes('/dist/') ||
    relativePath.includes('.divinity') ||
    relativePath.includes('provider-usage-ledger') ||
    relativePath.includes('provider-limits')
  );
}

function packageFileEntries(packageFiles, cwd) {
  const entries = [];
  for (const packageFile of packageFiles) {
    const relativePath = cleanString(packageFile).split(path.sep).join('/');
    if (!relativePath || skippedIntegrityPath(relativePath)) continue;
    const absolutePath = path.resolve(cwd, relativePath);
    let stat;
    try {
      stat = statSync(absolutePath);
    } catch {
      continue;
    }
    if (stat.isFile()) {
      entries.push(relativePath);
    } else if (stat.isDirectory()) {
      const pending = [relativePath];
      while (pending.length > 0) {
        const current = pending.pop();
        for (const entry of readdirSync(path.resolve(cwd, current), { withFileTypes: true })) {
          const child = path.join(current, entry.name).split(path.sep).join('/');
          if (skippedIntegrityPath(child)) continue;
          const childAbsolutePath = path.resolve(cwd, child);
          if (entry.isDirectory()) {
            pending.push(child);
          } else if (entry.isFile()) {
            entries.push(path.relative(cwd, childAbsolutePath).split(path.sep).join('/'));
          }
        }
      }
    }
  }
  return [...new Set(entries)].sort();
}

function sha256File(cwd, filePath) {
  return createHash('sha256').update(readFileSync(path.resolve(cwd, filePath))).digest('hex');
}

function buildArtifactIntegrity(packageFiles, cwd) {
  const files = packageFileEntries(packageFiles, cwd).map(filePath => ({
    path: filePath,
    bytes: statSync(path.resolve(cwd, filePath)).size,
    sha256: sha256File(cwd, filePath)
  }));
  return {
    algorithm: 'sha256',
    generated_from_package_files: true,
    redacts_secrets: true,
    files
  };
}

function readPackageLock(root) {
  try {
    return JSON.parse(readFileSync(path.join(root, 'package-lock.json'), 'utf8'));
  } catch {
    return null;
  }
}

function gitText({ cwd, gitCommand = 'git', args = [] } = {}) {
  try {
    return cleanString(execFileSync(gitCommand, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore']
    }));
  } catch {
    return '';
  }
}

function buildSourceProvenance({ cwd, packageJson, gitCommand = 'git' }) {
  const commitSha = gitText({ cwd, gitCommand, args: ['rev-parse', 'HEAD'] });
  if (!/^[a-f0-9]{40}$/.test(commitSha)) {
    return {
      format: SOURCE_PROVENANCE_FORMAT,
      status: 'unavailable',
      vcs: 'git',
      repository_url: packageJson.repository?.url || '',
      commit_sha: '',
      short_commit_sha: '',
      branch: '',
      tracked_changes: false,
      untracked_files_ignored: true,
      redacts_paths: true,
      reason: 'Git source provenance is unavailable for this release artifact context.'
    };
  }
  const branch = gitText({ cwd, gitCommand, args: ['rev-parse', '--abbrev-ref', 'HEAD'] });
  const trackedStatus = gitText({
    cwd,
    gitCommand,
    args: ['status', '--porcelain', '--untracked-files=no']
  });
  return {
    format: SOURCE_PROVENANCE_FORMAT,
    status: 'available',
    vcs: 'git',
    repository_url: packageJson.repository?.url || '',
    commit_sha: commitSha,
    short_commit_sha: commitSha.slice(0, 12),
    branch,
    tracked_changes: Boolean(trackedStatus),
    untracked_files_ignored: true,
    redacts_paths: true,
    reason: trackedStatus
      ? 'Tracked source changes were present when release metadata was generated; file paths are redacted.'
      : 'No tracked source changes were present when release metadata was generated.'
  };
}

function packageNameFromLockPath(lockPath) {
  const normalized = cleanString(lockPath).split(path.sep).join('/');
  if (!normalized.startsWith('node_modules/')) return '';
  const parts = normalized.slice('node_modules/'.length).split('/');
  if (parts[0]?.startsWith('@')) {
    return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : '';
  }
  return parts[0] || '';
}

function directDependencyType(name, packageJson) {
  if (Object.hasOwn(packageJson.dependencies || {}, name)) return 'production';
  if (Object.hasOwn(packageJson.devDependencies || {}, name)) return 'development';
  if (Object.hasOwn(packageJson.optionalDependencies || {}, name)) return 'optional';
  if (Object.hasOwn(packageJson.peerDependencies || {}, name)) return 'peer';
  return '';
}

function requestedRange(name, packageJson) {
  return cleanString(
    (packageJson.dependencies || {})[name] ||
    (packageJson.devDependencies || {})[name] ||
    (packageJson.optionalDependencies || {})[name] ||
    (packageJson.peerDependencies || {})[name]
  );
}

function componentId(name, version) {
  return `npm:${name}@${version}`;
}

function buildReleaseSbom({ packageJson, packageLock }) {
  if (!packageLock || !packageLock.packages || typeof packageLock.packages !== 'object') {
    return {
      format: RELEASE_SBOM_FORMAT,
      status: 'unavailable',
      source: 'package-lock.json',
      package_manager: 'npm',
      lockfile_version: null,
      generated_from_package_files: true,
      redacts_local_paths: true,
      redacts_registry_urls: true,
      redacts_integrity_values: true,
      component_count: 0,
      components: [],
      reason: 'package-lock.json was unavailable or invalid when release metadata was generated.'
    };
  }

  const components = [{
    component_id: componentId(packageJson.name, packageJson.version),
    name: packageJson.name,
    version: packageJson.version,
    component_type: 'application',
    dependency_type: 'root',
    direct: false,
    requested_range: '',
    license: cleanString(packageJson.license)
  }];

  for (const [lockPath, entry] of Object.entries(packageLock.packages)) {
    if (!lockPath || lockPath === '') continue;
    const name = packageNameFromLockPath(lockPath);
    const version = cleanString(entry?.version);
    if (!name || !version) continue;
    const directType = directDependencyType(name, packageJson);
    components.push({
      component_id: componentId(name, version),
      name,
      version,
      component_type: 'library',
      dependency_type: directType || 'transitive',
      direct: Boolean(directType),
      requested_range: directType ? requestedRange(name, packageJson) : '',
      license: cleanString(entry?.license)
    });
  }

  components.sort((left, right) => left.component_id.localeCompare(right.component_id));
  const uniqueComponents = [];
  const seen = new Set();
  for (const component of components) {
    if (seen.has(component.component_id)) continue;
    seen.add(component.component_id);
    uniqueComponents.push(component);
  }

  return {
    format: RELEASE_SBOM_FORMAT,
    status: 'generated',
    source: 'package-lock.json',
    package_manager: 'npm',
    lockfile_version: packageLock.lockfileVersion || null,
    generated_from_package_files: true,
    redacts_local_paths: true,
    redacts_registry_urls: true,
    redacts_integrity_values: true,
    component_count: uniqueComponents.length,
    components: uniqueComponents
  };
}

function signingCommandArgsStatus({ env = process.env } = {}) {
  const rawArgs = cleanString(env[RELEASE_SIGNING_COMMAND_ARGS_ENV]);
  if (!rawArgs) {
    return {
      configured: false,
      valid: true
    };
  }
  try {
    const parsed = JSON.parse(rawArgs);
    if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
      return {
        configured: true,
        valid: false,
        reason: `${RELEASE_SIGNING_COMMAND_ARGS_ENV} must be a JSON array of strings`
      };
    }
  } catch {
    return {
      configured: true,
      valid: false,
      reason: `${RELEASE_SIGNING_COMMAND_ARGS_ENV} must be a JSON array of strings`
    };
  }
  return {
    configured: true,
    valid: true
  };
}

function buildSigningConfiguration({ env = process.env } = {}) {
  const command = cleanString(env[RELEASE_SIGNING_COMMAND_ENV]);
  const keyRefConfigured = Boolean(cleanString(env[RELEASE_SIGNING_KEY_REF_ENV]));
  const identityConfigured = Boolean(cleanString(env[RELEASE_SIGNING_IDENTITY_ENV]));
  const commandArgs = signingCommandArgsStatus({ env });
  const commandConfigured = Boolean(command);
  const commandAbsolute = commandConfigured ? path.isAbsolute(command) : false;

  const base = {
    command_env_var: RELEASE_SIGNING_COMMAND_ENV,
    command_args_env_var: RELEASE_SIGNING_COMMAND_ARGS_ENV,
    key_ref_env_var: RELEASE_SIGNING_KEY_REF_ENV,
    identity_env_var: RELEASE_SIGNING_IDENTITY_ENV,
    command_configured: commandConfigured,
    command_absolute: commandAbsolute,
    command_args_configured: commandArgs.configured,
    key_ref_configured: keyRefConfigured,
    identity_configured: identityConfigured
  };

  if (commandConfigured && !commandAbsolute) {
    return {
      ...base,
      status: 'invalid',
      ready_when_release_gates_clear: false,
      reason: `${RELEASE_SIGNING_COMMAND_ENV} must be an absolute executable path`
    };
  }
  if (!commandArgs.valid) {
    return {
      ...base,
      status: 'invalid',
      ready_when_release_gates_clear: false,
      reason: commandArgs.reason
    };
  }
  const configured = commandConfigured && keyRefConfigured && identityConfigured;
  return {
    ...base,
    status: configured ? 'configured' : 'not_configured',
    ready_when_release_gates_clear: configured,
    reason: configured
      ? 'Release signing inputs are configured but release gates still control publishing and signing.'
      : 'Release signing command, key reference, and identity are not fully configured.'
  };
}

function buildArtifactSigning({ publishingBlocked, warningReason, env = process.env }) {
  const blockedReason = publishingBlocked
    ? `package.json private=true and the non-production warning block signing release artifacts. ${warningReason}`
    : `The non-production warning blocks signing release artifacts. ${warningReason}`;
  return {
    required: true,
    status: 'blocked',
    reason: blockedReason,
    key_source_required: true,
    allowed_algorithms: ['cosign', 'minisign', 'sigstore'],
    configuration: buildSigningConfiguration({ env }),
    targets: [
      {
        artifact_id: 'source_integrity_manifest',
        digest_algorithm: 'sha256',
        signature_status: 'unsigned',
        reason: 'Integrity metadata is generated, but no release signing key is configured while release gates are blocked.'
      },
      {
        artifact_id: 'package_registry_tarball',
        digest_algorithm: 'sha256',
        signature_status: publishingBlocked ? 'blocked' : 'unsigned',
        reason: publishingBlocked
          ? 'package.json private=true blocks package tarball publishing and signing.'
          : 'Package tarball signing requires a configured release signing key.'
      },
      {
        artifact_id: 'binary_download',
        digest_algorithm: 'sha256',
        signature_status: 'blocked',
        reason: 'No signed binary download is published while the non-production warning is active.'
      }
    ]
  };
}

export function buildReleaseArtifactsManifest({
  cwd = process.cwd(),
  generated_by = 'packages/release-artifacts',
  env = process.env,
  gitCommand = 'git'
} = {}) {
  const root = path.resolve(cwd);
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const packageLock = readPackageLock(root);
  const publishingBlocked = packageJson.private === true;
  const warningReason = 'README warning marks Divinity Code as under heavy active development and not production-ready.';

  return {
    format: RELEASE_ARTIFACTS_FORMAT,
    generated_by,
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
    source_provenance: buildSourceProvenance({ cwd: root, packageJson, gitCommand }),
    release_sbom: buildReleaseSbom({ packageJson, packageLock }),
    artifact_integrity: buildArtifactIntegrity(packageJson.files || [], root),
    artifact_signing: buildArtifactSigning({ publishingBlocked, warningReason, env }),
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
        install_path_id: 'local_package_tarball',
        status: 'available',
        label: 'Local package tarball smoke',
        command: 'pnpm run test:package-tarball',
        notes: 'Builds a local npm pack tarball, installs it into a temporary consumer project, and runs the installed divinity CLI.'
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
        gate_id: 'package_tarball_smoke',
        command: 'pnpm run test:package-tarball',
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
        gate_id: 'deprecation_audit',
        command: 'pnpm run test:deprecations',
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

export function writeReleaseArtifactsManifest({
  output = DEFAULT_RELEASE_ARTIFACT_OUTPUT,
  cwd = process.cwd()
} = {}) {
  const root = path.resolve(cwd);
  const artifactPath = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_ARTIFACT_OUTPUT);
  const artifact = buildReleaseArtifactsManifest({ cwd: root });

  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  return {
    ok: true,
    artifact_path: artifactPath,
    artifact
  };
}
