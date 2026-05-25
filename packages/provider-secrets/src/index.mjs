import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'fs';
import path from 'path';

export const PROVIDER_SECRET_REFS_FORMAT = 'divinity.provider_secret_refs.v1';
export const PROVIDER_SECRET_READINESS_FORMAT = 'divinity.provider_secret_readiness.v1';
export const PROVIDER_SECRET_STORE_FORMAT = 'divinity.provider_secret_store.v1';
export const PROVIDER_SECRET_REFS_PATH_ENV = 'DIVINITY_PROVIDER_SECRET_REFS_PATH';
export const PROVIDER_SECRET_STORE_PATH_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_PATH';
export const PROVIDER_SECRET_STORE_KEY_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_KEY';
export const PROVIDER_SECRET_STORE_BACKEND_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_BACKEND';

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

function storePathFrom({ storePath = '', env = process.env } = {}) {
  return cleanString(storePath || env[PROVIDER_SECRET_STORE_PATH_ENV]);
}

function storeKeyFrom({ storeKey = '', env = process.env } = {}) {
  return cleanString(storeKey || env[PROVIDER_SECRET_STORE_KEY_ENV]);
}

function storeBackendFrom({ env = process.env, storeBackend = '' } = {}) {
  return cleanString(storeBackend || env[PROVIDER_SECRET_STORE_BACKEND_ENV] || 'local_file');
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

function providerEntryFromFields({
  provider_id,
  secret_ref,
  credential_env_var
}) {
  return normalizedProviderEntry({ provider_id, secret_ref, credential_env_var }, 0);
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

function emptyStore() {
  return {
    format: PROVIDER_SECRET_STORE_FORMAT,
    secrets: []
  };
}

function assertBase64(value, label) {
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(cleanString(value))) {
    throw new Error(`${label} must be base64`);
  }
}

function normalizedStoreRecord(record, index) {
  if (!isPlainObject(record)) {
    throw new Error(`provider secret store record ${index} must be an object`);
  }
  const allowedFields = new Set([
    'provider_id',
    'secret_ref',
    'credential_env_var',
    'algorithm',
    'iv',
    'ciphertext',
    'auth_tag',
    'updated_at',
    'updated_by',
    'reason'
  ]);
  for (const key of Object.keys(record)) {
    if (!allowedFields.has(key)) {
      throw new Error(`provider secret store record ${index} has unsupported field ${key}`);
    }
  }
  const provider = normalizedProviderEntry({
    provider_id: record.provider_id,
    secret_ref: record.secret_ref,
    credential_env_var: record.credential_env_var
  }, index);
  const algorithm = cleanString(record.algorithm);
  if (algorithm !== 'aes-256-gcm') {
    throw new Error(`provider secret store record ${index} has unsupported algorithm`);
  }
  assertBase64(record.iv, `provider secret store record ${index} iv`);
  assertBase64(record.ciphertext, `provider secret store record ${index} ciphertext`);
  assertBase64(record.auth_tag, `provider secret store record ${index} auth_tag`);
  const updatedAt = cleanString(record.updated_at);
  const updatedBy = cleanString(record.updated_by);
  const reason = cleanString(record.reason);
  if (!updatedAt) throw new Error(`provider secret store record ${index} missing updated_at`);
  if (!updatedBy) throw new Error(`provider secret store record ${index} missing updated_by`);
  if (!reason) throw new Error(`provider secret store record ${index} missing reason`);
  return {
    ...provider,
    algorithm,
    iv: cleanString(record.iv),
    ciphertext: cleanString(record.ciphertext),
    auth_tag: cleanString(record.auth_tag),
    updated_at: updatedAt,
    updated_by: updatedBy,
    reason
  };
}

function normalizedStore(store) {
  if (!isPlainObject(store)) {
    throw new Error('provider secret store must be an object');
  }
  if (store.format !== PROVIDER_SECRET_STORE_FORMAT) {
    throw new Error(`provider secret store must use format ${PROVIDER_SECRET_STORE_FORMAT}`);
  }
  const secrets = Array.isArray(store.secrets) ? store.secrets.map(normalizedStoreRecord) : [];
  return {
    format: PROVIDER_SECRET_STORE_FORMAT,
    secrets
  };
}

export function loadProviderSecretStore({ env = process.env, storePath = '' } = {}) {
  const configuredStorePath = storePathFrom({ storePath, env });
  if (!configuredStorePath || !existsSync(configuredStorePath)) return emptyStore();
  return normalizedStore(JSON.parse(readFileSync(configuredStorePath, 'utf8')));
}

function derivedStoreKey({ env = process.env, storeKey = '' } = {}) {
  const keyMaterial = storeKeyFrom({ storeKey, env });
  if (!keyMaterial) throw new Error('provider secret store key is required');
  return createHash('sha256').update(keyMaterial).digest();
}

function encryptSecret(secretValue, key) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(secretValue, 'utf8'),
    cipher.final()
  ]);
  return {
    algorithm: 'aes-256-gcm',
    iv: iv.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
    auth_tag: cipher.getAuthTag().toString('base64')
  };
}

function decryptSecret(record, key) {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.auth_tag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(record.ciphertext, 'base64')),
    decipher.final()
  ]).toString('utf8');
}

function publicStoreRecord(record, adapter) {
  return {
    format: 'divinity.provider_secret_store_record.v1',
    provider_id: record.provider_id,
    secret_ref: record.secret_ref,
    credential_env_var: record.credential_env_var,
    store_backend_id: adapter.backend_id,
    store_backend_kind: adapter.backend_kind,
    encrypted: true,
    algorithm: record.algorithm,
    updated_at: record.updated_at,
    updated_by: record.updated_by,
    reason: record.reason
  };
}

function writeSecretStore(storePath, store) {
  mkdirSync(path.dirname(storePath), { recursive: true });
  const tmpPath = `${storePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(tmpPath, JSON.stringify(store, null, 2));
  renameSync(tmpPath, storePath);
}

export function createLocalProviderSecretStoreAdapter({ env = process.env } = {}) {
  const adapter = {
    backend_id: 'local_file',
    backend_kind: 'local_file',
    storeConfigured() {
      return Boolean(storePathFrom({ env }) && storeKeyFrom({ env }));
    },
    configuredSecretRefs() {
      if (!adapter.storeConfigured()) return new Set();
      return new Set(loadProviderSecretStore({ env }).secrets.map(secret => secret.secret_ref));
    },
    resolveSecret(secretRef) {
      if (!adapter.storeConfigured()) return '';
      const configuredStorePath = storePathFrom({ env });
      const configuredStoreKey = storeKeyFrom({ env });
      const store = loadProviderSecretStore({ env, storePath: configuredStorePath });
      const record = store.secrets.find(secret => secret.secret_ref === secretRef);
      if (!record) return '';
      return decryptSecret(record, derivedStoreKey({ env, storeKey: configuredStoreKey }));
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      const configuredStorePath = storePathFrom({ env });
      if (!configuredStorePath) throw new Error('provider secret store path is required');
      const key = derivedStoreKey({ env });
      const encrypted = encryptSecret(secret_value, key);
      const record = {
        ...provider,
        ...encrypted,
        updated_at,
        updated_by: actor,
        reason
      };
      const store = loadProviderSecretStore({ env, storePath: configuredStorePath });
      const nextSecrets = store.secrets.filter(secret => secret.secret_ref !== provider.secret_ref);
      nextSecrets.push(record);
      nextSecrets.sort((left, right) => left.secret_ref.localeCompare(right.secret_ref));
      writeSecretStore(configuredStorePath, {
        format: PROVIDER_SECRET_STORE_FORMAT,
        secrets: nextSecrets
      });
      return publicStoreRecord(record, adapter);
    }
  };
  return adapter;
}

export function createHostedProviderSecretStoreAdapter({ backend_id = 'hosted_memory' } = {}) {
  const secrets = new Map();
  const backendId = cleanString(backend_id) || 'hosted_memory';

  return {
    backend_id: backendId,
    backend_kind: 'hosted_operator',
    storeConfigured() {
      return true;
    },
    configuredSecretRefs() {
      return new Set(secrets.keys());
    },
    resolveSecret(secretRef) {
      return cleanString(secrets.get(secretRef));
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      secrets.set(provider.secret_ref, secret_value);
      const record = {
        ...provider,
        algorithm: 'managed-by-hosted-store',
        updated_at,
        updated_by: actor,
        reason
      };
      return publicStoreRecord(record, this);
    }
  };
}

export function createConfiguredProviderSecretStoreAdapter({ env = process.env } = {}) {
  const backend = storeBackendFrom({ env });
  if (backend === 'local_file') {
    return createLocalProviderSecretStoreAdapter({ env });
  }
  if (backend === 'hosted_memory') {
    return createHostedProviderSecretStoreAdapter({ backend_id: backend });
  }
  throw new Error(`unsupported provider secret store backend: ${backend}`);
}

export function storeProviderSecret({
  env = process.env,
  storePath = '',
  storeKey = '',
  provider_id = '',
  secret_ref = '',
  credential_env_var = '',
  secret_value = '',
  actor = '',
  reason = '',
  updated_at = new Date().toISOString(),
  secret_store_adapter = null
} = {}) {
  const provider = providerEntryFromFields({ provider_id, secret_ref, credential_env_var });
  const secretValue = cleanString(secret_value);
  const updatedBy = cleanString(actor);
  const cleanReason = cleanString(reason);
  if (!secretValue) throw new Error('secret_value is required');
  if (!updatedBy) throw new Error('actor is required');
  if (!cleanReason) throw new Error('reason is required');
  assertNoDangerousText(cleanReason, `provider secret store reason for ${provider.provider_id}`);

  const adapter = secret_store_adapter || createConfiguredProviderSecretStoreAdapter({
    env: {
      ...env,
      ...(storePath ? { [PROVIDER_SECRET_STORE_PATH_ENV]: storePath } : {}),
      ...(storeKey ? { [PROVIDER_SECRET_STORE_KEY_ENV]: storeKey } : {})
    }
  });
  return adapter.storeSecret({
    provider,
    secret_value: secretValue,
    actor: updatedBy,
    reason: cleanReason,
    updated_at,
  });
}

function secretStoreRefs({ env = process.env, secret_store_adapter = null } = {}) {
  const adapter = secret_store_adapter || createConfiguredProviderSecretStoreAdapter({ env });
  if (!adapter.storeConfigured()) return new Set();
  return adapter.configuredSecretRefs();
}

function storedCredentialFor(secretRef, { env = process.env, secret_store_adapter = null } = {}) {
  if (secret_store_adapter) {
    return secret_store_adapter.resolveSecret(secretRef);
  }
  const configuredStorePath = storePathFrom({ env });
  const configuredStoreKey = storeKeyFrom({ env });
  if (!configuredStorePath || !configuredStoreKey) return '';
  const store = loadProviderSecretStore({ env, storePath: configuredStorePath });
  const record = store.secrets.find(secret => secret.secret_ref === secretRef);
  if (!record) return '';
  return decryptSecret(record, derivedStoreKey({ env, storeKey: configuredStoreKey }));
}

export function providerSecretReadiness({
  env = process.env,
  path = '',
  secretRefsPath = '',
  secret_store_adapter = null
} = {}) {
  const configuredPath = pathFrom({ path: secretRefsPath || path, env });
  const manifest = loadProviderSecretRefs({ path: configuredPath, env });
  const adapter = secret_store_adapter || createConfiguredProviderSecretStoreAdapter({ env });
  const storeConfigured = adapter.storeConfigured();
  const storeRefs = storeConfigured ? secretStoreRefs({ env, secret_store_adapter: adapter }) : new Set();
  const providers = manifest.providers.map(provider => ({
    provider_id: provider.provider_id,
    secret_ref: provider.secret_ref,
    credential_env_var: provider.credential_env_var,
    credential_configured: storeRefs.has(provider.secret_ref) || Boolean(cleanString(env[provider.credential_env_var])),
    credential_source: storeRefs.has(provider.secret_ref)
      ? 'store'
      : Boolean(cleanString(env[provider.credential_env_var]))
        ? 'environment'
        : 'none'
  }));

  return {
    format: PROVIDER_SECRET_READINESS_FORMAT,
    manifest_configured: Boolean(configuredPath),
    store_configured: storeConfigured,
    store_backend_id: adapter.backend_id,
    store_backend_kind: adapter.backend_kind,
    any_configured: providers.some(provider => provider.credential_configured),
    providers
  };
}

export function createProviderCredentialResolver({
  env = process.env,
  path = '',
  secretRefsPath = '',
  secret_store_adapter = null
} = {}) {
  const manifest = loadProviderSecretRefs({ path: secretRefsPath || path, env });
  const providersById = new Map(manifest.providers.map(provider => [provider.provider_id, provider]));
  const adapter = secret_store_adapter || createConfiguredProviderSecretStoreAdapter({ env });

  function entryFor(runtime) {
    return providersById.get(cleanString(runtime?.provider_id)) || null;
  }

  function credentialFor(entry) {
    if (!entry) return '';
    return storedCredentialFor(entry.secret_ref, { env, secret_store_adapter: adapter }) || cleanString(env[entry.credential_env_var]);
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
