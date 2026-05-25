import { readFileSync } from 'fs';

export const PROVIDER_SECRET_REFS_FORMAT = 'divinity.provider_secret_refs.v1';
export const PROVIDER_SECRET_READINESS_FORMAT = 'divinity.provider_secret_readiness.v1';
export const PROVIDER_SECRET_REFS_PATH_ENV = 'DIVINITY_PROVIDER_SECRET_REFS_PATH';

const RAW_CREDENTIAL_FIELD_NAMES = new Set([
  'api_key',
  'apikey',
  'credential',
  'credentials',
  'key',
  'password',
  'secret',
  'token',
  'value'
]);
const ALLOWED_MANIFEST_FIELDS = new Set([
  'format',
  'providers'
]);
const ALLOWED_PROVIDER_FIELDS = new Set([
  'provider_id',
  'secret_ref',
  'credential_env_var'
]);
const DANGEROUS_SOURCE_PATTERN = /public.*shared.*key|shared.*public.*key|shared_key|bypass|evade|circumvent|no[-_\s]?signup/i;
const PROVIDER_ID_PATTERN = /^[a-z0-9][a-z0-9_:-]*$/;
const SECRET_REF_PATTERN = /^secret:\/\/[A-Za-z0-9][A-Za-z0-9._~:/-]*$/;
const ENV_VAR_PATTERN = /^[A-Z_][A-Z0-9_]*$/;

function cleanString(value) {
  return String(value || '').trim();
}

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function pathFrom({ path = '', env = process.env } = {}) {
  return cleanString(path || env[PROVIDER_SECRET_REFS_PATH_ENV]);
}

function assertNoRawCredentialFields(value, path = 'provider secret refs manifest') {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoRawCredentialFields(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;

  for (const [key, nestedValue] of Object.entries(value)) {
    if (RAW_CREDENTIAL_FIELD_NAMES.has(key)) {
      throw new Error(`${path} must not include raw credential field ${key}`);
    }
    assertNoRawCredentialFields(nestedValue, `${path}.${key}`);
  }
}

function assertNoDangerousText(value, label) {
  if (DANGEROUS_SOURCE_PATTERN.test(cleanString(value))) {
    throw new Error(`${label} uses a forbidden source: public shared keys and limit bypass sources are not allowed`);
  }
}

function assertNoDangerousManifestText(value, path = 'provider secret refs manifest') {
  if (typeof value === 'string') {
    assertNoDangerousText(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoDangerousManifestText(item, `${path}[${index}]`));
    return;
  }
  if (!isPlainObject(value)) return;
  for (const [key, nestedValue] of Object.entries(value)) {
    assertNoDangerousManifestText(nestedValue, `${path}.${key}`);
  }
}

function normalizedProviderEntry(entry, index) {
  if (!isPlainObject(entry)) {
    throw new Error(`provider secret ref entry ${index} must be an object`);
  }
  for (const key of Object.keys(entry)) {
    if (!ALLOWED_PROVIDER_FIELDS.has(key)) {
      throw new Error(`provider secret ref entry ${index} has unsupported field ${key}`);
    }
  }

  const providerId = cleanString(entry.provider_id);
  const secretRef = cleanString(entry.secret_ref);
  const credentialEnvVar = cleanString(entry.credential_env_var);

  if (!PROVIDER_ID_PATTERN.test(providerId)) {
    throw new Error(`provider secret ref entry ${index} has invalid provider_id`);
  }
  if (!SECRET_REF_PATTERN.test(secretRef)) {
    throw new Error(`provider secret ref entry ${index} has invalid secret_ref`);
  }
  if (!ENV_VAR_PATTERN.test(credentialEnvVar)) {
    throw new Error(`provider secret ref entry ${index} has invalid credential_env_var`);
  }

  assertNoDangerousText(providerId, `provider secret ref ${providerId}`);
  assertNoDangerousText(secretRef, `provider secret ref ${providerId}`);
  assertNoDangerousText(credentialEnvVar, `provider secret ref ${providerId}`);

  return {
    provider_id: providerId,
    secret_ref: secretRef,
    credential_env_var: credentialEnvVar
  };
}

function normalizedManifest(manifest) {
  if (!isPlainObject(manifest)) {
    throw new Error('provider secret refs manifest must be an object');
  }
  assertNoRawCredentialFields(manifest);
  assertNoDangerousManifestText(manifest);
  for (const key of Object.keys(manifest)) {
    if (!ALLOWED_MANIFEST_FIELDS.has(key)) {
      throw new Error(`provider secret refs manifest has unsupported field ${key}`);
    }
  }
  if (manifest.format !== PROVIDER_SECRET_REFS_FORMAT) {
    throw new Error(`provider secret refs manifest must use format ${PROVIDER_SECRET_REFS_FORMAT}`);
  }

  const providers = Array.isArray(manifest.providers) ? manifest.providers : [];
  const normalizedProviders = providers.map(normalizedProviderEntry);
  const seenProviderIds = new Set();
  for (const provider of normalizedProviders) {
    if (seenProviderIds.has(provider.provider_id)) {
      throw new Error(`duplicate provider secret ref for ${provider.provider_id}`);
    }
    seenProviderIds.add(provider.provider_id);
  }

  return {
    format: PROVIDER_SECRET_REFS_FORMAT,
    providers: normalizedProviders
  };
}

export function loadProviderSecretRefs(options = {}) {
  const configuredPath = pathFrom(options);
  if (!configuredPath) {
    return {
      format: PROVIDER_SECRET_REFS_FORMAT,
      providers: []
    };
  }
  return normalizedManifest(JSON.parse(readFileSync(configuredPath, 'utf8')));
}

export function providerSecretReadiness({ env = process.env, path = '', secretRefsPath = '' } = {}) {
  const configuredPath = pathFrom({ path: secretRefsPath || path, env });
  const manifest = loadProviderSecretRefs({ path: configuredPath, env });
  const providers = manifest.providers.map(provider => ({
    provider_id: provider.provider_id,
    secret_ref: provider.secret_ref,
    credential_env_var: provider.credential_env_var,
    credential_configured: Boolean(cleanString(env[provider.credential_env_var]))
  }));

  return {
    format: PROVIDER_SECRET_READINESS_FORMAT,
    manifest_configured: Boolean(configuredPath),
    any_configured: providers.some(provider => provider.credential_configured),
    providers
  };
}

export function createProviderCredentialResolver({ env = process.env, path = '', secretRefsPath = '' } = {}) {
  const manifest = loadProviderSecretRefs({ path: secretRefsPath || path, env });
  const providersById = new Map(manifest.providers.map(provider => [provider.provider_id, provider]));

  function entryFor(runtime) {
    return providersById.get(cleanString(runtime?.provider_id)) || null;
  }

  function credentialFor(entry) {
    return entry ? cleanString(env[entry.credential_env_var]) : '';
  }

  return {
    configuredSecretRefs(runtime) {
      const entry = entryFor(runtime);
      return credentialFor(entry) ? [entry.secret_ref] : [];
    },
    resolveCredential(runtime) {
      return credentialFor(entryFor(runtime));
    }
  };
}
