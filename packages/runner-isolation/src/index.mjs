import path from 'path';

export const RUNNER_ISOLATION_PROFILES = [
  {
    profile_id: 'workspace_snapshot',
    kind: 'workspace',
    description: 'Execute from a per-run workspace snapshot or shallow Git clone managed by Divinity Code.',
    requires_runtime: false,
    runtime: null,
    image: null,
    network: 'host_default',
    workspace_mount: null,
    shell_interpolation: false
  },
  {
    profile_id: 'container_sandbox',
    kind: 'container',
    description: 'Execute constrained commands inside a Docker container with the run workspace bind-mounted at /workspace.',
    requires_runtime: true,
    runtime: 'docker',
    image: 'node:22-bookworm-slim',
    network: 'none',
    workspace_mount: '/workspace',
    shell_interpolation: false
  }
];

function cloneProfile(profile) {
  return { ...profile };
}

export function publicRunnerIsolationProfiles() {
  return RUNNER_ISOLATION_PROFILES.map(cloneProfile);
}

export function resolveRunnerIsolationProfile({ profile_id } = {}) {
  return cloneProfile(
    RUNNER_ISOLATION_PROFILES.find(profile => profile.profile_id === profile_id)
      || RUNNER_ISOLATION_PROFILES[0]
  );
}

export function createContainerCommandPlan({ workspacePath, command, profile_id = 'container_sandbox' } = {}) {
  if (!Array.isArray(command) || command.length === 0 || command.some(part => typeof part !== 'string' || part.length === 0)) {
    throw new Error('command must be a non-empty argv array');
  }

  const profile = resolveRunnerIsolationProfile({ profile_id });
  if (profile.kind !== 'container') {
    throw new Error(`runner isolation profile is not container-backed: ${profile.profile_id}`);
  }

  const source = path.resolve(workspacePath || process.cwd());
  const target = profile.workspace_mount;
  const mount = `type=bind,source=${source},target=${target}`;

  return {
    profile_id: profile.profile_id,
    runtime: profile.runtime,
    image: profile.image,
    network: profile.network,
    workdir: target,
    workspace_mount: {
      source,
      target,
      mode: 'rw'
    },
    command: [...command],
    argv: [
      profile.runtime,
      'run',
      '--rm',
      '--network',
      profile.network,
      '--mount',
      mount,
      '-w',
      target,
      profile.image,
      ...command
    ],
    shell_interpolation: false
  };
}
