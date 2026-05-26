import { execFileSync } from 'child_process';
import { createHash } from 'crypto';
import { chmodSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs';
import path from 'path';

export const RELEASE_ARTIFACTS_FORMAT = 'divinity.release_artifacts.v1';
export const SOURCE_PROVENANCE_FORMAT = 'divinity.release_source_provenance.v1';
export const RELEASE_SBOM_FORMAT = 'divinity.release_sbom.v1';
export const RELEASE_REGISTRY_PUBLISH_READINESS_FORMAT = 'divinity.release_registry_publish_readiness.v1';
export const RELEASE_BINARY_READINESS_FORMAT = 'divinity.release_binary_readiness.v1';
export const RELEASE_BINARY_ARTIFACTS_FORMAT = 'divinity.release_binary_artifacts.v1';
export const RELEASE_NATIVE_BINARY_ARTIFACTS_FORMAT = 'divinity.release_native_binary_artifacts.v1';
export const RELEASE_CANDIDATE_BUNDLE_FORMAT = 'divinity.release_candidate_bundle.v1';
export const RELEASE_CANDIDATE_BUNDLE_READINESS_FORMAT = 'divinity.release_candidate_bundle_readiness.v1';
export const RELEASE_ATTESTATION_FORMAT = 'divinity.release_attestation.v1';
export const RELEASE_ATTESTATION_READINESS_FORMAT = 'divinity.release_attestation_readiness.v1';
export const RELEASE_PROMOTION_PREFLIGHT_FORMAT = 'divinity.release_promotion_preflight.v1';
export const RELEASE_GATE_CLEARANCE_FORMAT = 'divinity.release_gate_clearance.v1';
export const RELEASE_SIGNATURE_ARTIFACTS_FORMAT = 'divinity.release_signature_artifacts.v1';
export const RELEASE_SIGNATURE_ARTIFACTS_READINESS_FORMAT = 'divinity.release_signature_artifacts_readiness.v1';
export const DEFAULT_RELEASE_ARTIFACT_OUTPUT = path.join('dist', 'release-artifacts.json');
export const DEFAULT_RELEASE_BINARY_OUTPUT = path.join('dist', 'binary');
export const DEFAULT_RELEASE_NATIVE_BINARY_OUTPUT = path.join('dist', 'native-binary');
export const DEFAULT_RELEASE_BUNDLE_OUTPUT = path.join('dist', 'release-bundle');
export const DEFAULT_RELEASE_SIGNATURE_OUTPUT = path.join('dist', 'release-signatures');
export const DEFAULT_RELEASE_PROMOTION_PREFLIGHT_OUTPUT = path.join('dist', 'release-promotion-preflight.json');
export const NPM_TOKEN_ENV = 'NPM_TOKEN';
export const RELEASE_SIGNING_COMMAND_ENV = 'DIVINITY_RELEASE_SIGNING_COMMAND';
export const RELEASE_SIGNING_COMMAND_ARGS_ENV = 'DIVINITY_RELEASE_SIGNING_COMMAND_ARGS';
export const RELEASE_SIGNING_KEY_REF_ENV = 'DIVINITY_RELEASE_SIGNING_KEY_REF';
export const RELEASE_SIGNING_IDENTITY_ENV = 'DIVINITY_RELEASE_SIGNING_IDENTITY';
export const NATIVE_BINARY_BUILD_COMMAND_ENV = 'DIVINITY_NATIVE_BINARY_BUILD_COMMAND';
export const NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV = 'DIVINITY_NATIVE_BINARY_BUILD_COMMAND_ARGS';

const BINARY_RELEASE_TARGETS = [
  {
    platform: 'linux',
    arch: 'x64',
    filename: 'divinity-linux-x64'
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: 'divinity-linux-arm64'
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: 'divinity-darwin-x64'
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: 'divinity-darwin-arm64'
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: 'divinity-win32-x64.cmd'
  }
];

const NATIVE_BINARY_RELEASE_TARGETS = [
  {
    platform: 'linux',
    arch: 'x64',
    filename: 'divinity-linux-x64'
  },
  {
    platform: 'linux',
    arch: 'arm64',
    filename: 'divinity-linux-arm64'
  },
  {
    platform: 'darwin',
    arch: 'x64',
    filename: 'divinity-darwin-x64'
  },
  {
    platform: 'darwin',
    arch: 'arm64',
    filename: 'divinity-darwin-arm64'
  },
  {
    platform: 'win32',
    arch: 'x64',
    filename: 'divinity-win32-x64.exe'
  }
];

function cleanString(value) {
  return String(value || '').trim();
}

function defaultNpmCommand() {
  return process.platform === 'win32' ? 'npm.cmd' : 'npm';
}

function normalizedRelativePath(from, to) {
  return path.relative(from, to).split(path.sep).join('/');
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

function sha256Bytes(value) {
  return createHash('sha256').update(value).digest('hex');
}

function sha256Absolute(filePath) {
  return createHash('sha256').update(readFileSync(filePath)).digest('hex');
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

function parseSigningCommandArgs({ env = process.env } = {}) {
  const rawArgs = cleanString(env[RELEASE_SIGNING_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  return JSON.parse(rawArgs);
}

function nativeBinaryBuildCommandArgsStatus({ env = process.env } = {}) {
  const rawArgs = cleanString(env[NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV]);
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
        reason: `${NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV} must be a JSON array of strings`
      };
    }
  } catch {
    return {
      configured: true,
      valid: false,
      reason: `${NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV} must be a JSON array of strings`
    };
  }
  return {
    configured: true,
    valid: true
  };
}

function parseNativeBinaryBuildCommandArgs({ env = process.env } = {}) {
  const rawArgs = cleanString(env[NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  return JSON.parse(rawArgs);
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

function buildNativeBinaryBuildConfiguration({ env = process.env } = {}) {
  const command = cleanString(env[NATIVE_BINARY_BUILD_COMMAND_ENV]);
  const commandArgs = nativeBinaryBuildCommandArgsStatus({ env });
  const commandConfigured = Boolean(command);
  const commandAbsolute = commandConfigured ? path.isAbsolute(command) : false;

  const base = {
    command_env_var: NATIVE_BINARY_BUILD_COMMAND_ENV,
    command_args_env_var: NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV,
    command_configured: commandConfigured,
    command_absolute: commandAbsolute,
    command_args_configured: commandArgs.configured
  };

  if (commandConfigured && !commandAbsolute) {
    return {
      ...base,
      status: 'invalid',
      reason: `${NATIVE_BINARY_BUILD_COMMAND_ENV} must be an absolute executable path`
    };
  }
  if (!commandArgs.valid) {
    return {
      ...base,
      status: 'invalid',
      reason: commandArgs.reason
    };
  }
  return {
    ...base,
    status: commandConfigured ? 'configured' : 'not_configured',
    reason: commandConfigured
      ? 'Native binary build command is configured but release gates still control public distribution.'
      : 'Native binary build command is not configured.'
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

function buildRegistryPublishReadiness({
  packageJson,
  publishingBlocked,
  warningActive = true,
  env = process.env
}) {
  const tokenConfigured = Boolean(cleanString(env[NPM_TOKEN_ENV]));
  const blockers = [];
  if (publishingBlocked) blockers.push('package_private');
  if (warningActive) blockers.push('non_production_warning');
  if (!tokenConfigured) blockers.push('missing_registry_token');
  const status = blockers.length ? 'blocked' : 'ready';
  return {
    format: RELEASE_REGISTRY_PUBLISH_READINESS_FORMAT,
    status,
    package_name: packageJson.name,
    package_version: packageJson.version,
    registry_url: 'https://registry.npmjs.org/',
    provenance_required: true,
    publish_command: 'npm publish --provenance --access public',
    dry_run_command: 'npm publish --dry-run --provenance --access public',
    token_env_var: NPM_TOKEN_ENV,
    token_configured: tokenConfigured,
    redacts_token: true,
    redacts_local_paths: true,
    blockers,
    reason: status === 'ready'
      ? 'Registry publishing metadata is ready once release gates pass.'
      : 'Registry publishing remains blocked until package privacy, production warning, and token readiness gates clear.'
  };
}

function buildNativeBinaryBuildPipeline({ env = process.env } = {}) {
  const configuration = buildNativeBinaryBuildConfiguration({ env });
  return {
    status: configuration.status,
    command: 'pnpm run release:native-binary',
    smoke_test_command: 'pnpm run test:native-binary',
    artifact_format: RELEASE_NATIVE_BINARY_ARTIFACTS_FORMAT,
    artifact_type: 'native_binary',
    command_env_var: NATIVE_BINARY_BUILD_COMMAND_ENV,
    command_args_env_var: NATIVE_BINARY_BUILD_COMMAND_ARGS_ENV,
    command_configured: configuration.command_configured,
    command_absolute: configuration.command_absolute,
    command_args_configured: configuration.command_args_configured,
    redacts_local_paths: true,
    redacts_build_command: true,
    reason: configuration.reason
  };
}

function buildBinaryReleaseReadiness({ warningActive = true, env = process.env } = {}) {
  const blockers = [
    ...(warningActive ? ['non_production_warning'] : []),
    'native_binary_build_pending',
    'signing_blocked'
  ];
  return {
    format: RELEASE_BINARY_READINESS_FORMAT,
    status: 'blocked',
    artifact_id: 'binary_download',
    binary_name: 'divinity',
    build_command: 'pnpm run release:binary',
    smoke_test_command: 'pnpm run test:binary',
    signing_required: true,
    checksums_required: true,
    checksum_status: 'generated',
    build_pipeline: {
      status: 'available',
      command: 'pnpm run release:binary',
      artifact_format: RELEASE_BINARY_ARTIFACTS_FORMAT,
      artifact_type: 'node_launcher',
      native_binary: false,
      redacts_local_paths: true
    },
    smoke_gate: {
      status: 'available',
      command: 'pnpm run test:binary'
    },
    native_build_pipeline: buildNativeBinaryBuildPipeline({ env }),
    supported_targets: BINARY_RELEASE_TARGETS.map(target => ({
      ...target,
      status: 'generated',
      native_binary: false,
      public_download_status: 'blocked'
    })),
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: 'Local Node launcher artifacts and checksums can be generated, but signed native binary downloads remain blocked until the production warning is cleared and release signing is configured.'
  };
}

function releaseBundleBlockers({ publishingBlocked, warningActive = true } = {}) {
  return [
    ...(publishingBlocked ? ['package_private'] : []),
    ...(warningActive ? ['non_production_warning'] : []),
    'native_binary_build_pending',
    'signing_blocked'
  ];
}

function buildReleaseCandidateBundleReadiness({
  publishingBlocked,
  warningActive = true
} = {}) {
  const blockers = releaseBundleBlockers({ publishingBlocked, warningActive });
  return {
    format: RELEASE_CANDIDATE_BUNDLE_READINESS_FORMAT,
    status: blockers.length ? 'blocked' : 'ready',
    artifact_format: RELEASE_CANDIDATE_BUNDLE_FORMAT,
    build_command: 'pnpm run release:bundle',
    smoke_test_command: 'pnpm run test:release-bundle',
    output_directory: DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/'),
    includes: [
      'release_artifacts_manifest',
      'package_tarball',
      'binary_artifacts_manifest',
      'bundle_checksums'
    ],
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: blockers.length
      ? 'Release candidate bundles can be generated for review, but public package and signed native binary distribution remain blocked by release gates.'
      : 'Release candidate bundle metadata is ready once release gates pass.'
  };
}

function buildReleaseAttestationReadiness({
  publishingBlocked,
  warningActive = true
} = {}) {
  const blockers = releaseBundleBlockers({ publishingBlocked, warningActive });
  return {
    format: RELEASE_ATTESTATION_READINESS_FORMAT,
    status: blockers.length ? 'blocked' : 'ready',
    artifact_format: RELEASE_ATTESTATION_FORMAT,
    attestation_path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/attestation.json`,
    build_command: 'pnpm run release:bundle',
    smoke_test_command: 'pnpm run test:release-bundle',
    signing_required: true,
    signing_status: 'blocked',
    subject_kinds: [
      'release_artifacts_manifest',
      'package_tarball',
      'binary_artifacts_manifest',
      'binary_launcher',
      'checksum_manifest'
    ],
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: blockers.length
      ? 'Release attestation metadata can be generated for review, but signing and public distribution remain blocked by release gates.'
      : 'Release attestation metadata is ready once release gates pass.'
  };
}

function buildReleaseSignatureArtifactsReadiness({
  publishingBlocked,
  warningActive = true,
  env = process.env
} = {}) {
  const blockers = releaseBundleBlockers({ publishingBlocked, warningActive });
  return {
    format: RELEASE_SIGNATURE_ARTIFACTS_READINESS_FORMAT,
    status: blockers.length ? 'blocked' : 'ready',
    artifact_format: RELEASE_SIGNATURE_ARTIFACTS_FORMAT,
    build_command: 'pnpm run release:signatures',
    smoke_test_command: 'pnpm run test:release-signatures',
    output_directory: DEFAULT_RELEASE_SIGNATURE_OUTPUT.split(path.sep).join('/'),
    bundle_manifest_path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/manifest.json`,
    signing_required: true,
    signing_configuration: redactedSigningConfiguration(buildSigningConfiguration({ env })),
    signed_artifact_ids: [
      'release_artifacts_manifest',
      'package_tarball',
      'binary_artifacts_manifest',
      'binary_checksums',
      'release_attestation',
      'bundle_checksums'
    ],
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: blockers.length
      ? 'Release signatures can be generated for local release-candidate review, but public signed distribution remains blocked by release gates.'
      : 'Release signature artifacts are ready once release gates pass.'
  };
}

function promotionPreflightBlockers({ publishingBlocked, warningActive = true, tokenConfigured = false } = {}) {
  return [
    ...(publishingBlocked ? ['package_private'] : []),
    ...(warningActive ? ['non_production_warning'] : []),
    ...(!tokenConfigured ? ['missing_registry_token'] : []),
    'native_binary_build_pending',
    'signing_blocked'
  ];
}

function releasePromotionRequiredArtifacts() {
  return [
    {
      artifact_id: 'release_artifacts_manifest',
      path: DEFAULT_RELEASE_ARTIFACT_OUTPUT.split(path.sep).join('/'),
      command: 'pnpm run release:artifacts',
      required: true
    },
    {
      artifact_id: 'release_candidate_bundle_manifest',
      path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/manifest.json`,
      command: 'pnpm run release:bundle',
      required: true
    },
    {
      artifact_id: 'release_attestation',
      path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/attestation.json`,
      command: 'pnpm run release:bundle',
      required: true
    },
    {
      artifact_id: 'native_binary_artifacts_manifest',
      path: `${DEFAULT_RELEASE_NATIVE_BINARY_OUTPUT.split(path.sep).join('/')}/manifest.json`,
      command: 'pnpm run release:native-binary',
      required: true
    },
    {
      artifact_id: 'release_signature_artifacts_manifest',
      path: `${DEFAULT_RELEASE_SIGNATURE_OUTPUT.split(path.sep).join('/')}/manifest.json`,
      command: 'pnpm run release:signatures',
      required: true
    },
    {
      artifact_id: 'binary_artifacts_manifest',
      path: `${DEFAULT_RELEASE_BINARY_OUTPUT.split(path.sep).join('/')}/manifest.json`,
      command: 'pnpm run release:binary',
      required: true
    }
  ];
}

function releasePromotionGates() {
  return [
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
      gate_id: 'binary_artifact_smoke',
      command: 'pnpm run test:binary',
      required: true
    },
    {
      gate_id: 'native_binary_artifacts',
      command: 'pnpm run test:native-binary',
      required: true
    },
    {
      gate_id: 'release_candidate_bundle_smoke',
      command: 'pnpm run test:release-bundle',
      required: true
    },
    {
      gate_id: 'release_artifacts_manifest',
      command: 'pnpm run test:release-artifacts',
      required: true
    },
    {
      gate_id: 'release_signature_artifacts',
      command: 'pnpm run test:release-signatures',
      required: true
    },
    {
      gate_id: 'release_status_surface',
      command: 'pnpm run test:release-status',
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
      gate_id: 'full_suite',
      command: 'pnpm test',
      required: true
    }
  ];
}

function redactedSigningConfiguration(configuration) {
  return {
    status: configuration.status,
    command_configured: configuration.command_configured,
    command_absolute: configuration.command_absolute,
    command_args_configured: configuration.command_args_configured,
    key_ref_configured: configuration.key_ref_configured,
    identity_configured: configuration.identity_configured,
    ready_when_release_gates_clear: configuration.ready_when_release_gates_clear
  };
}

export function buildReleaseGateClearanceAudit({
  packageJson,
  publishingBlocked = packageJson?.private === true,
  warningActive = true,
  env = process.env
} = {}) {
  const tokenConfigured = Boolean(cleanString(env[NPM_TOKEN_ENV]));
  const signingConfiguration = buildSigningConfiguration({ env });
  const nativeBinaryBuildConfiguration = buildNativeBinaryBuildConfiguration({ env });
  const blockers = promotionPreflightBlockers({
    publishingBlocked,
    warningActive,
    tokenConfigured
  });

  return {
    format: RELEASE_GATE_CLEARANCE_FORMAT,
    status: blockers.length ? 'blocked' : 'ready',
    public_release_ready: blockers.length === 0,
    blockers,
    clearance_items: [
      {
        item_id: 'package_privacy',
        status: publishingBlocked ? 'blocked' : 'ready',
        blocker: 'package_private',
        current_state: publishingBlocked ? 'package.json private=true' : 'package publishing enabled',
        required_state: 'package publishing is explicitly enabled by an approved public release decision',
        evidence_command: 'pnpm run test:package',
        evidence_artifacts: ['package.json']
      },
      {
        item_id: 'production_warning',
        status: warningActive ? 'blocked' : 'ready',
        blocker: 'non_production_warning',
        current_state: warningActive ? 'README non-production warning active' : 'README production warning cleared',
        required_state: 'README production warning is removed only after the public readiness audit passes',
        evidence_command: 'pnpm run test:public-docs',
        evidence_artifacts: ['README.md', 'docs/RELEASE_CHECKLIST.md']
      },
      {
        item_id: 'registry_token',
        status: tokenConfigured ? 'ready' : 'blocked',
        blocker: 'missing_registry_token',
        current_state: tokenConfigured ? 'NPM_TOKEN configured' : 'NPM_TOKEN not configured',
        required_state: 'operator-owned npm automation token is configured outside repository files',
        evidence_command: 'pnpm run test:release-promotion',
        evidence_artifacts: ['dist/release-promotion-preflight.json']
      },
      {
        item_id: 'native_binary_distribution',
        status: 'blocked',
        blocker: 'native_binary_build_pending',
        current_state: nativeBinaryBuildConfiguration.status === 'configured'
          ? 'native binary build inputs configured'
          : nativeBinaryBuildConfiguration.status === 'invalid'
            ? 'native binary build inputs invalid'
            : 'local Node launcher artifacts only',
        required_state: 'signed native binary artifacts are built, checksummed, smoke-tested, and attached to release distribution',
        evidence_command: 'pnpm run test:native-binary',
        evidence_artifacts: ['dist/native-binary/manifest.json', 'dist/native-binary/SHA256SUMS']
      },
      {
        item_id: 'release_signing',
        status: 'blocked',
        blocker: 'signing_blocked',
        current_state: signingConfiguration.status === 'configured'
          ? 'release signing inputs configured'
          : signingConfiguration.status === 'invalid'
            ? 'release signing inputs invalid'
            : 'release signing inputs not configured',
        required_state: 'package tarball, binary downloads, and release attestation are signed by an approved signing workflow',
        evidence_command: 'pnpm run test:release-signatures',
        evidence_artifacts: ['dist/release-signatures/manifest.json', 'dist/release-bundle/attestation.json']
      },
      {
        item_id: 'github_release_readiness',
        status: 'required',
        blocker: '',
        current_state: 'Release Readiness workflow configured',
        required_state: 'GitHub Release Readiness workflow passes on the PR head SHA before integration',
        evidence_command: 'pnpm run test:github-workflows',
        evidence_artifacts: ['.github/workflows/release-readiness.yml']
      }
    ],
    redacts_local_paths: true,
    redacts_registry_token: true,
    redacts_signing_secrets: true,
    reason: blockers.length
      ? 'Public release clearance remains blocked; each clearance item records the current state, required state, and local evidence command.'
      : 'Public release clearance metadata is ready.'
  };
}

export function buildReleasePromotionPreflight({
  packageJson,
  publishingBlocked = packageJson?.private === true,
  warningActive = true,
  env = process.env
} = {}) {
  const tokenConfigured = Boolean(cleanString(env[NPM_TOKEN_ENV]));
  const blockers = promotionPreflightBlockers({
    publishingBlocked,
    warningActive,
    tokenConfigured
  });
  const signingConfiguration = redactedSigningConfiguration(buildSigningConfiguration({ env }));
  return {
    format: RELEASE_PROMOTION_PREFLIGHT_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: blockers.length ? 'blocked' : 'ready',
    public_release_ready: blockers.length === 0,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true,
      repository_url: packageJson.repository?.url || ''
    },
    command: 'pnpm run release:promotion-preflight',
    smoke_test_command: 'pnpm run test:release-promotion',
    registry_publish: {
      status: publishingBlocked || warningActive || !tokenConfigured ? 'blocked' : 'ready',
      package_name: packageJson.name,
      package_version: packageJson.version,
      registry_url: 'https://registry.npmjs.org/',
      provenance_required: true,
      publish_command: 'npm publish --provenance --access public',
      dry_run_command: 'npm publish --dry-run --provenance --access public',
      token_env_var: NPM_TOKEN_ENV,
      token_configured: tokenConfigured
    },
    binary_distribution: {
      status: 'blocked',
      artifact_type: 'signed_native_binary',
      binary_name: 'divinity',
      build_command: 'pnpm run release:native-binary',
      smoke_test_command: 'pnpm run test:native-binary',
      attestation_path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/attestation.json`,
      public_download_status: 'blocked',
      reason: 'Signed native binary distribution remains blocked until native packaging and signing gates are implemented and release blockers clear.'
    },
    signing: {
      required: true,
      status: 'blocked',
      configuration: signingConfiguration,
      attestation_required: true,
      attestation_path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/attestation.json`,
      signed_artifacts: [
        'package_tarball',
        'binary_download',
        'release_attestation'
      ],
      reason: 'Promotion signing remains blocked while the non-production warning and release gates are active.'
    },
    required_artifacts: releasePromotionRequiredArtifacts(),
    release_gates: releasePromotionGates(),
    blockers,
    redacts_local_paths: true,
    redacts_registry_token: true,
    redacts_signing_secrets: true,
    reason: blockers.length
      ? 'Public package and signed binary promotion remains blocked until release gates, package metadata, registry credentials, native binary packaging, and signing are ready.'
      : 'Release promotion preflight is ready.'
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
    release_gate_clearance: buildReleaseGateClearanceAudit({
      packageJson,
      publishingBlocked,
      warningActive: true,
      env
    }),
    source_provenance: buildSourceProvenance({ cwd: root, packageJson, gitCommand }),
    release_sbom: buildReleaseSbom({ packageJson, packageLock }),
    artifact_integrity: buildArtifactIntegrity(packageJson.files || [], root),
    artifact_signing: buildArtifactSigning({ publishingBlocked, warningReason, env }),
    release_candidate_bundle: buildReleaseCandidateBundleReadiness({
      publishingBlocked,
      warningActive: true
    }),
    release_attestation: buildReleaseAttestationReadiness({
      publishingBlocked,
      warningActive: true
    }),
    release_signature_artifacts: buildReleaseSignatureArtifactsReadiness({
      publishingBlocked,
      warningActive: true,
      env
    }),
    release_promotion_preflight: buildReleasePromotionPreflight({
      packageJson,
      publishingBlocked,
      warningActive: true,
      env
    }),
    binary_release_readiness: buildBinaryReleaseReadiness({ warningActive: true, env }),
    registry_publish_readiness: buildRegistryPublishReadiness({
      packageJson,
      publishingBlocked,
      warningActive: true,
      env
    }),
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
        gate_id: 'binary_artifact_smoke',
        command: 'pnpm run test:binary',
        required: true
      },
      {
        gate_id: 'native_binary_artifacts',
        command: 'pnpm run test:native-binary',
        required: true
      },
      {
        gate_id: 'release_candidate_bundle_smoke',
        command: 'pnpm run test:release-bundle',
        required: true
      },
      {
        gate_id: 'release_promotion_preflight',
        command: 'pnpm run test:release-promotion',
        required: true
      },
      {
        gate_id: 'release_signature_artifacts',
        command: 'pnpm run test:release-signatures',
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

export function writeReleasePromotionPreflight({
  output = DEFAULT_RELEASE_PROMOTION_PREFLIGHT_OUTPUT,
  cwd = process.cwd(),
  env = process.env
} = {}) {
  const root = path.resolve(cwd);
  const artifactPath = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_PROMOTION_PREFLIGHT_OUTPUT);
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const artifact = buildReleasePromotionPreflight({
    packageJson,
    publishingBlocked: packageJson.private === true,
    warningActive: true,
    env
  });

  mkdirSync(path.dirname(artifactPath), { recursive: true });
  writeFileSync(artifactPath, `${JSON.stringify(artifact, null, 2)}\n`);

  return {
    ok: true,
    artifact_path: artifactPath,
    artifact
  };
}

function posixLauncherContent() {
  return [
    '#!/usr/bin/env sh',
    'set -eu',
    'SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)',
    'SOURCE_ROOT="${DIVINITY_BINARY_SOURCE_ROOT:-$(CDPATH= cd "$SCRIPT_DIR/../.." && pwd)}"',
    'exec node "$SOURCE_ROOT/apps/cli/src/index.mjs" "$@"',
    ''
  ].join('\n');
}

function windowsLauncherContent() {
  return [
    '@echo off',
    'setlocal',
    'if "%DIVINITY_BINARY_SOURCE_ROOT%"=="" (',
    '  set "SOURCE_ROOT=%~dp0\\..\\.."',
    ') else (',
    '  set "SOURCE_ROOT=%DIVINITY_BINARY_SOURCE_ROOT%"',
    ')',
    'node "%SOURCE_ROOT%\\apps\\cli\\src\\index.mjs" %*',
    ''
  ].join('\r\n');
}

function launcherKind(target) {
  return target.platform === 'win32' ? 'windows_cmd' : 'posix_shell';
}

function launcherContent(target) {
  return launcherKind(target) === 'windows_cmd' ? windowsLauncherContent() : posixLauncherContent();
}

export function writeReleaseBinaryArtifacts({
  output = DEFAULT_RELEASE_BINARY_OUTPUT,
  cwd = process.cwd()
} = {}) {
  const root = path.resolve(cwd);
  const outputDirectory = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_BINARY_OUTPUT);
  mkdirSync(outputDirectory, { recursive: true });

  const artifacts = BINARY_RELEASE_TARGETS.map(target => {
    const content = launcherContent(target);
    const artifactPath = path.join(outputDirectory, target.filename);
    writeFileSync(artifactPath, content);
    if (launcherKind(target) === 'posix_shell') chmodSync(artifactPath, 0o755);
    const bytes = statSync(artifactPath).size;
    return {
      ...target,
      path: target.filename,
      launcher_kind: launcherKind(target),
      artifact_type: 'node_launcher',
      native_binary: false,
      status: 'generated',
      bytes,
      sha256: sha256Bytes(readFileSync(artifactPath))
    };
  });

  const checksumPath = path.join(outputDirectory, 'SHA256SUMS');
  writeFileSync(
    checksumPath,
    `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.filename}`).join('\n')}\n`
  );

  const manifest = {
    format: RELEASE_BINARY_ARTIFACTS_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: 'generated',
    artifact_type: 'node_launcher',
    native_binary: false,
    public_download_ready: false,
    binary_name: 'divinity',
    output_directory: DEFAULT_RELEASE_BINARY_OUTPUT.split(path.sep).join('/'),
    checksums_file: 'SHA256SUMS',
    checksum_algorithm: 'sha256',
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: 'Generated artifacts are local Node launchers for release-candidate smoke checks; signed native binary downloads are still blocked by release gates.',
    artifacts
  };

  const manifestPath = path.join(outputDirectory, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    ok: true,
    output_directory: outputDirectory,
    checksum_path: checksumPath,
    manifest_path: manifestPath,
    manifest
  };
}

function nativeBinaryBuildRequest({ outputDirectory }) {
  return {
    format: 'divinity.release_native_binary_build_request.v1',
    output_directory: outputDirectory,
    binary_name: 'divinity',
    targets: NATIVE_BINARY_RELEASE_TARGETS
  };
}

function safeRelativeOutputPath(outputDirectory, artifactPath) {
  const normalized = cleanString(artifactPath).replace(/\\/g, '/');
  if (!normalized || path.isAbsolute(normalized) || normalized.split('/').includes('..')) {
    throw new Error(`native binary build returned an unsafe artifact path: ${artifactPath}`);
  }
  const absolutePath = path.resolve(outputDirectory, normalized);
  const relativePath = normalizedRelativePath(outputDirectory, absolutePath);
  if (relativePath.startsWith('../') || relativePath === '..') {
    throw new Error(`native binary build returned an artifact outside the output directory: ${artifactPath}`);
  }
  return {
    relativePath,
    absolutePath
  };
}

function runNativeBinaryBuildCommand({ outputDirectory, command, commandArgs }) {
  const output = execFileSync(command, commandArgs, {
    input: `${JSON.stringify(nativeBinaryBuildRequest({ outputDirectory }))}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const response = JSON.parse(output || '{}');
  if (response.ok !== true || !Array.isArray(response.artifacts)) {
    throw new Error('native binary build command did not return an artifact list');
  }
  return response;
}

function nativeBinaryArtifactEntries({ outputDirectory, buildResponse }) {
  const artifactsByTarget = new Map(
    buildResponse.artifacts.map(artifact => [`${artifact.platform}/${artifact.arch}`, artifact])
  );
  return NATIVE_BINARY_RELEASE_TARGETS.map(target => {
    const artifact = artifactsByTarget.get(`${target.platform}/${target.arch}`);
    if (!artifact) {
      throw new Error(`native binary build did not return ${target.platform}/${target.arch}`);
    }
    if (artifact.native_binary !== true || artifact.artifact_type !== 'native_binary') {
      throw new Error(`native binary build returned a non-native artifact for ${target.platform}/${target.arch}`);
    }
    if (cleanString(artifact.filename) !== target.filename) {
      throw new Error(`native binary build returned an unexpected filename for ${target.platform}/${target.arch}`);
    }
    const { relativePath, absolutePath } = safeRelativeOutputPath(outputDirectory, artifact.path);
    const bytes = statSync(absolutePath).size;
    return {
      platform: target.platform,
      arch: target.arch,
      filename: target.filename,
      path: relativePath,
      artifact_type: 'native_binary',
      native_binary: true,
      status: 'generated',
      public_download_status: 'blocked',
      bytes,
      sha256: sha256Absolute(absolutePath)
    };
  });
}

function nativeBinaryArtifactBlockers({ packageJson }) {
  return [
    ...(packageJson.private === true ? ['package_private'] : []),
    'non_production_warning',
    'signing_blocked'
  ];
}

export function writeReleaseNativeBinaryArtifacts({
  output = DEFAULT_RELEASE_NATIVE_BINARY_OUTPUT,
  cwd = process.cwd(),
  env = process.env
} = {}) {
  const root = path.resolve(cwd);
  const outputDirectory = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_NATIVE_BINARY_OUTPUT);
  const buildConfiguration = buildNativeBinaryBuildConfiguration({ env });
  if (buildConfiguration.status !== 'configured') {
    throw new Error(buildConfiguration.reason);
  }

  mkdirSync(outputDirectory, { recursive: true });
  const buildResponse = runNativeBinaryBuildCommand({
    outputDirectory,
    command: cleanString(env[NATIVE_BINARY_BUILD_COMMAND_ENV]),
    commandArgs: parseNativeBinaryBuildCommandArgs({ env })
  });
  const artifacts = nativeBinaryArtifactEntries({ outputDirectory, buildResponse });

  const checksumPath = path.join(outputDirectory, 'SHA256SUMS');
  writeFileSync(
    checksumPath,
    `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.path}`).join('\n')}\n`
  );

  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const manifest = {
    format: RELEASE_NATIVE_BINARY_ARTIFACTS_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: 'generated',
    artifact_type: 'native_binary',
    native_binary: true,
    public_download_ready: false,
    binary_name: 'divinity',
    output_directory: DEFAULT_RELEASE_NATIVE_BINARY_OUTPUT.split(path.sep).join('/'),
    checksums_file: 'SHA256SUMS',
    checksum_algorithm: 'sha256',
    signing_required: true,
    signature_status: 'unsigned',
    build_configuration: buildNativeBinaryBuildPipeline({ env }),
    blockers: nativeBinaryArtifactBlockers({ packageJson }),
    redacts_local_paths: true,
    redacts_build_command: true,
    redacts_signing_secrets: true,
    reason: 'Generated native binary artifacts are local release-candidate outputs only; public downloads remain blocked by release gates and signing.',
    artifacts
  };

  const manifestPath = path.join(outputDirectory, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    ok: true,
    output_directory: outputDirectory,
    checksum_path: checksumPath,
    manifest_path: manifestPath,
    manifest
  };
}

function bundleArtifactEntry({ bundleDirectory, filePath, artifactId, artifactKind, extra = {} }) {
  return {
    artifact_id: artifactId,
    artifact_kind: artifactKind,
    path: normalizedRelativePath(bundleDirectory, filePath),
    bytes: statSync(filePath).size,
    sha256: sha256Absolute(filePath),
    ...extra
  };
}

function packPackageTarball({ cwd, outputDirectory, npmCommand }) {
  mkdirSync(outputDirectory, { recursive: true });
  const output = execFileSync(npmCommand, ['pack', '--json', '--pack-destination', outputDirectory], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
  const result = JSON.parse(output);
  if (!Array.isArray(result) || result.length !== 1 || !result[0]?.filename) {
    throw new Error('npm pack did not return exactly one package tarball');
  }
  return {
    filename: result[0].filename,
    name: result[0].name || '',
    version: result[0].version || '',
    file_count: Array.isArray(result[0].files) ? result[0].files.length : 0,
    tarball_path: path.join(outputDirectory, result[0].filename)
  };
}

function attestationSubject(artifact) {
  return {
    artifact_id: artifact.artifact_id,
    artifact_kind: artifact.artifact_kind,
    path: artifact.path,
    bytes: artifact.bytes,
    sha256: artifact.sha256
  };
}

function buildReleaseAttestation({
  packageJson,
  releaseArtifact,
  releaseArtifactEntry,
  subjects,
  blockers
}) {
  return {
    format: RELEASE_ATTESTATION_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: 'generated',
    predicate_type: 'divinity.release_candidate_bundle.provenance.v1',
    public_release_ready: false,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true
    },
    source_provenance: releaseArtifact.source_provenance,
    release_metadata: {
      path: releaseArtifactEntry.path,
      sha256: releaseArtifactEntry.sha256,
      bytes: releaseArtifactEntry.bytes,
      format: releaseArtifact.format
    },
    build: {
      build_type: 'local_release_candidate_bundle',
      package_manager: packageJson.packageManager || '',
      node_engine: packageJson.engines?.node || '',
      commands: [
        'pnpm run release:artifacts',
        'npm pack --json --pack-destination package',
        'pnpm run release:binary',
        'pnpm run release:bundle'
      ]
    },
    signing: {
      required: true,
      status: 'blocked',
      blockers,
      redacts_signing_secrets: true
    },
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    subject_count: subjects.length,
    subjects
  };
}

export function writeReleaseCandidateBundle({
  output = DEFAULT_RELEASE_BUNDLE_OUTPUT,
  cwd = process.cwd(),
  npmCommand = defaultNpmCommand()
} = {}) {
  const root = path.resolve(cwd);
  const outputDirectory = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_BUNDLE_OUTPUT);
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  mkdirSync(outputDirectory, { recursive: true });

  const releaseArtifactPath = path.join(outputDirectory, 'release-artifacts.json');
  const releaseArtifact = buildReleaseArtifactsManifest({ cwd: root });
  writeFileSync(releaseArtifactPath, `${JSON.stringify(releaseArtifact, null, 2)}\n`);

  const packageDirectory = path.join(outputDirectory, 'package');
  const packResult = packPackageTarball({ cwd: root, outputDirectory: packageDirectory, npmCommand });

  const binaryResult = writeReleaseBinaryArtifacts({
    cwd: root,
    output: path.join(outputDirectory, 'binary')
  });

  const releaseArtifactEntry = bundleArtifactEntry({
    bundleDirectory: outputDirectory,
    filePath: releaseArtifactPath,
    artifactId: 'release_artifacts_manifest',
    artifactKind: 'release_artifacts_manifest'
  });
  const initialArtifacts = [
    releaseArtifactEntry,
    bundleArtifactEntry({
      bundleDirectory: outputDirectory,
      filePath: packResult.tarball_path,
      artifactId: 'package_tarball',
      artifactKind: 'package_tarball',
      extra: {
        package_name: packResult.name,
        package_version: packResult.version,
        package_file_count: packResult.file_count
      }
    }),
    bundleArtifactEntry({
      bundleDirectory: outputDirectory,
      filePath: binaryResult.manifest_path,
      artifactId: 'binary_artifacts_manifest',
      artifactKind: 'binary_artifacts_manifest'
    }),
    bundleArtifactEntry({
      bundleDirectory: outputDirectory,
      filePath: binaryResult.checksum_path,
      artifactId: 'binary_checksums',
      artifactKind: 'checksum_manifest'
    }),
    ...binaryResult.manifest.artifacts.map(artifact => bundleArtifactEntry({
      bundleDirectory: outputDirectory,
      filePath: path.join(outputDirectory, 'binary', artifact.filename),
      artifactId: `binary_launcher_${artifact.platform}_${artifact.arch}`,
      artifactKind: 'binary_launcher',
      extra: {
        platform: artifact.platform,
        arch: artifact.arch,
        native_binary: false
      }
    }))
  ].sort((left, right) => left.path.localeCompare(right.path));

  const blockers = releaseBundleBlockers({
    publishingBlocked: packageJson.private === true,
    warningActive: true
  });
  const attestationPath = path.join(outputDirectory, 'attestation.json');
  const attestation = buildReleaseAttestation({
    packageJson,
    releaseArtifact,
    releaseArtifactEntry,
    subjects: initialArtifacts.map(attestationSubject),
    blockers
  });
  writeFileSync(attestationPath, `${JSON.stringify(attestation, null, 2)}\n`);

  const artifacts = [
    ...initialArtifacts,
    bundleArtifactEntry({
      bundleDirectory: outputDirectory,
      filePath: attestationPath,
      artifactId: 'release_attestation',
      artifactKind: 'release_attestation'
    })
  ].sort((left, right) => left.path.localeCompare(right.path));

  const checksumPath = path.join(outputDirectory, 'SHA256SUMS');
  writeFileSync(
    checksumPath,
    `${artifacts.map(artifact => `${artifact.sha256}  ${artifact.path}`).join('\n')}\n`
  );

  const manifestWithoutChecksum = {
    format: RELEASE_CANDIDATE_BUNDLE_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: 'generated',
    public_release_ready: false,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true
    },
    output_directory: DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/'),
    checksums_file: 'SHA256SUMS',
    checksum_algorithm: 'sha256',
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    blockers,
    release_gates: [
      'pnpm run test:package-tarball',
      'pnpm run test:binary',
      'pnpm run test:release-artifacts',
      'pnpm run test:release-bundle'
    ],
    reason: 'This bundle is for release-candidate review only; public package and signed native binary distribution remain blocked by release gates.',
    artifacts
  };

  const manifestPath = path.join(outputDirectory, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifestWithoutChecksum, null, 2)}\n`);

  const bundleChecksums = bundleArtifactEntry({
    bundleDirectory: outputDirectory,
    filePath: checksumPath,
    artifactId: 'bundle_checksums',
    artifactKind: 'checksum_manifest'
  });
  const manifest = {
    ...manifestWithoutChecksum,
    artifacts: [...manifestWithoutChecksum.artifacts, bundleChecksums].sort((left, right) => (
      left.artifact_id.localeCompare(right.artifact_id)
    ))
  };
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    ok: true,
    output_directory: outputDirectory,
    checksum_path: checksumPath,
    manifest_path: manifestPath,
    manifest
  };
}

function signableBundleArtifacts(bundleManifest) {
  const signableIds = new Set([
    'release_artifacts_manifest',
    'package_tarball',
    'binary_artifacts_manifest',
    'binary_checksums',
    'release_attestation',
    'bundle_checksums'
  ]);
  return bundleManifest.artifacts
    .filter(artifact => signableIds.has(artifact.artifact_id))
    .sort((left, right) => left.artifact_id.localeCompare(right.artifact_id));
}

function signatureRequest({ artifact, bundleDirectory, signaturePath }) {
  return {
    format: 'divinity.release_signature_request.v1',
    artifact_id: artifact.artifact_id,
    artifact_kind: artifact.artifact_kind,
    input_path: path.join(bundleDirectory, artifact.path),
    signature_path: signaturePath,
    digest_algorithm: 'sha256',
    sha256: artifact.sha256
  };
}

function executeSigningCommand({ artifact, bundleDirectory, signaturePath, command, commandArgs }) {
  const request = signatureRequest({
    artifact,
    bundleDirectory,
    signaturePath
  });
  const output = execFileSync(command, commandArgs, {
    input: `${JSON.stringify(request)}\n`,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe']
  });
  const response = JSON.parse(output || '{}');
  if (response.ok !== true) {
    throw new Error(`release signing command failed for ${artifact.artifact_id}`);
  }
  return {
    signature_algorithm: cleanString(response.signature_algorithm) || 'external'
  };
}

export function writeReleaseSignatureArtifacts({
  output = DEFAULT_RELEASE_SIGNATURE_OUTPUT,
  cwd = process.cwd(),
  env = process.env,
  bundleOutput = DEFAULT_RELEASE_BUNDLE_OUTPUT,
  npmCommand = defaultNpmCommand()
} = {}) {
  const root = path.resolve(cwd);
  const outputDirectory = path.resolve(root, cleanString(output) || DEFAULT_RELEASE_SIGNATURE_OUTPUT);
  const signatureDirectory = path.join(outputDirectory, 'signatures');
  const signingConfiguration = buildSigningConfiguration({ env });
  if (signingConfiguration.status !== 'configured') {
    throw new Error(signingConfiguration.reason);
  }

  const command = cleanString(env[RELEASE_SIGNING_COMMAND_ENV]);
  const commandArgs = parseSigningCommandArgs({ env });
  mkdirSync(signatureDirectory, { recursive: true });

  const bundleResult = writeReleaseCandidateBundle({
    cwd: root,
    output: bundleOutput,
    npmCommand
  });
  const bundleDirectory = bundleResult.output_directory;
  const packageJson = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  const blockers = releaseBundleBlockers({
    publishingBlocked: packageJson.private === true,
    warningActive: true
  });

  const signatures = signableBundleArtifacts(bundleResult.manifest).map(artifact => {
    const signaturePath = path.join(signatureDirectory, `${artifact.artifact_id}.sig`);
    const signingResult = executeSigningCommand({
      artifact,
      bundleDirectory,
      signaturePath,
      command,
      commandArgs
    });
    return {
      artifact_id: artifact.artifact_id,
      artifact_kind: artifact.artifact_kind,
      subject_path: artifact.path,
      subject_sha256: artifact.sha256,
      digest_algorithm: 'sha256',
      signature_path: normalizedRelativePath(outputDirectory, signaturePath),
      signature_algorithm: signingResult.signature_algorithm,
      signature_bytes: statSync(signaturePath).size,
      signature_sha256: sha256Absolute(signaturePath),
      status: 'generated'
    };
  });

  const checksumPath = path.join(outputDirectory, 'SHA256SUMS');
  writeFileSync(
    checksumPath,
    `${signatures.map(signature => `${signature.signature_sha256}  ${signature.signature_path}`).join('\n')}\n`
  );

  const manifest = {
    format: RELEASE_SIGNATURE_ARTIFACTS_FORMAT,
    generated_by: 'packages/release-artifacts',
    status: 'generated',
    public_release_ready: false,
    package: {
      name: packageJson.name,
      version: packageJson.version,
      private: packageJson.private === true
    },
    output_directory: DEFAULT_RELEASE_SIGNATURE_OUTPUT.split(path.sep).join('/'),
    bundle_manifest_path: `${DEFAULT_RELEASE_BUNDLE_OUTPUT.split(path.sep).join('/')}/manifest.json`,
    checksums_file: 'SHA256SUMS',
    checksum_algorithm: 'sha256',
    signing: {
      required: true,
      status: 'generated',
      configuration: redactedSigningConfiguration(signingConfiguration)
    },
    blockers,
    redacts_local_paths: true,
    redacts_signing_secrets: true,
    reason: 'Generated local release-candidate signatures for review only; public package and signed binary distribution remain blocked by release gates.',
    signatures
  };
  const manifestPath = path.join(outputDirectory, 'manifest.json');
  writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  return {
    ok: true,
    output_directory: outputDirectory,
    checksum_path: checksumPath,
    manifest_path: manifestPath,
    manifest
  };
}
