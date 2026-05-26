import { execFileSync } from 'child_process';
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
export const PROVIDER_SECRET_STORE_TEST_BACKEND_ENV = 'DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND';
export const PROVIDER_SECRET_STORE_COMMAND_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_COMMAND';
export const PROVIDER_SECRET_STORE_COMMAND_ARGS_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_COMMAND_ARGS';
export const PROVIDER_SECRET_STORE_COMMAND_TIMEOUT_MS_ENV = 'DIVINITY_PROVIDER_SECRET_STORE_COMMAND_TIMEOUT_MS';
export const AWS_SECRETS_MANAGER_COMMAND_ENV = 'DIVINITY_AWS_SECRETS_MANAGER_COMMAND';
export const AWS_SECRETS_MANAGER_COMMAND_ARGS_ENV = 'DIVINITY_AWS_SECRETS_MANAGER_COMMAND_ARGS';
export const AWS_SECRETS_MANAGER_TIMEOUT_MS_ENV = 'DIVINITY_AWS_SECRETS_MANAGER_TIMEOUT_MS';
export const AWS_SECRETS_MANAGER_SECRET_IDS_ENV = 'DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS';
export const GCP_SECRET_MANAGER_COMMAND_ENV = 'DIVINITY_GCP_SECRET_MANAGER_COMMAND';
export const GCP_SECRET_MANAGER_COMMAND_ARGS_ENV = 'DIVINITY_GCP_SECRET_MANAGER_COMMAND_ARGS';
export const GCP_SECRET_MANAGER_TIMEOUT_MS_ENV = 'DIVINITY_GCP_SECRET_MANAGER_TIMEOUT_MS';
export const GCP_SECRET_MANAGER_SECRET_IDS_ENV = 'DIVINITY_GCP_SECRET_MANAGER_SECRET_IDS';
export const AZURE_KEY_VAULT_COMMAND_ENV = 'DIVINITY_AZURE_KEY_VAULT_COMMAND';
export const AZURE_KEY_VAULT_COMMAND_ARGS_ENV = 'DIVINITY_AZURE_KEY_VAULT_COMMAND_ARGS';
export const AZURE_KEY_VAULT_TIMEOUT_MS_ENV = 'DIVINITY_AZURE_KEY_VAULT_TIMEOUT_MS';
export const AZURE_KEY_VAULT_SECRET_IDS_ENV = 'DIVINITY_AZURE_KEY_VAULT_SECRET_IDS';
export const HASHICORP_VAULT_COMMAND_ENV = 'DIVINITY_HASHICORP_VAULT_COMMAND';
export const HASHICORP_VAULT_COMMAND_ARGS_ENV = 'DIVINITY_HASHICORP_VAULT_COMMAND_ARGS';
export const HASHICORP_VAULT_TIMEOUT_MS_ENV = 'DIVINITY_HASHICORP_VAULT_TIMEOUT_MS';
export const HASHICORP_VAULT_SECRET_PATHS_ENV = 'DIVINITY_HASHICORP_VAULT_SECRET_PATHS';

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

function storeCommandFrom({ env = process.env } = {}) {
  return cleanString(env[PROVIDER_SECRET_STORE_COMMAND_ENV]);
}

function storeCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[PROVIDER_SECRET_STORE_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${PROVIDER_SECRET_STORE_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${PROVIDER_SECRET_STORE_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function storeCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[PROVIDER_SECRET_STORE_COMMAND_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${PROVIDER_SECRET_STORE_COMMAND_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function awsCommandFrom({ env = process.env } = {}) {
  return cleanString(env[AWS_SECRETS_MANAGER_COMMAND_ENV]);
}

function awsCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[AWS_SECRETS_MANAGER_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${AWS_SECRETS_MANAGER_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${AWS_SECRETS_MANAGER_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function awsCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[AWS_SECRETS_MANAGER_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${AWS_SECRETS_MANAGER_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function awsSecretIdMapFrom({ env = process.env } = {}) {
  const rawMap = cleanString(env[AWS_SECRETS_MANAGER_SECRET_IDS_ENV]);
  if (!rawMap) throw new Error(`${AWS_SECRETS_MANAGER_SECRET_IDS_ENV} secret id mapping is required`);
  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error(`${AWS_SECRETS_MANAGER_SECRET_IDS_ENV} secret id mapping must be a JSON object`);
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${AWS_SECRETS_MANAGER_SECRET_IDS_ENV} secret id mapping must be a non-empty JSON object`);
  }
  const normalized = {};
  for (const [secretRef, secretId] of Object.entries(parsed)) {
    const cleanSecretRef = cleanString(secretRef);
    const cleanSecretId = cleanString(secretId);
    if (!SECRET_REF_PATTERN.test(cleanSecretRef) || !cleanSecretId) {
      throw new Error(`${AWS_SECRETS_MANAGER_SECRET_IDS_ENV} secret id mapping entries must use secret:// refs and non-empty secret ids`);
    }
    normalized[cleanSecretRef] = cleanSecretId;
  }
  return normalized;
}

function gcpCommandFrom({ env = process.env } = {}) {
  return cleanString(env[GCP_SECRET_MANAGER_COMMAND_ENV]);
}

function gcpCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[GCP_SECRET_MANAGER_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${GCP_SECRET_MANAGER_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${GCP_SECRET_MANAGER_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function gcpCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[GCP_SECRET_MANAGER_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${GCP_SECRET_MANAGER_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function gcpSecretIdMapFrom({ env = process.env } = {}) {
  const rawMap = cleanString(env[GCP_SECRET_MANAGER_SECRET_IDS_ENV]);
  if (!rawMap) throw new Error(`${GCP_SECRET_MANAGER_SECRET_IDS_ENV} secret id mapping is required`);
  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error(`${GCP_SECRET_MANAGER_SECRET_IDS_ENV} secret id mapping must be a JSON object`);
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${GCP_SECRET_MANAGER_SECRET_IDS_ENV} secret id mapping must be a non-empty JSON object`);
  }
  const normalized = {};
  for (const [secretRef, secretId] of Object.entries(parsed)) {
    const cleanSecretRef = cleanString(secretRef);
    const cleanSecretId = cleanString(secretId);
    if (!SECRET_REF_PATTERN.test(cleanSecretRef) || !cleanSecretId) {
      throw new Error(`${GCP_SECRET_MANAGER_SECRET_IDS_ENV} secret id mapping entries must use secret:// refs and non-empty secret ids`);
    }
    normalized[cleanSecretRef] = cleanSecretId;
  }
  return normalized;
}

function azureCommandFrom({ env = process.env } = {}) {
  return cleanString(env[AZURE_KEY_VAULT_COMMAND_ENV]);
}

function azureCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[AZURE_KEY_VAULT_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${AZURE_KEY_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${AZURE_KEY_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function azureCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[AZURE_KEY_VAULT_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${AZURE_KEY_VAULT_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function azureSecretIdMapFrom({ env = process.env } = {}) {
  const rawMap = cleanString(env[AZURE_KEY_VAULT_SECRET_IDS_ENV]);
  if (!rawMap) throw new Error(`${AZURE_KEY_VAULT_SECRET_IDS_ENV} secret id mapping is required`);
  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error(`${AZURE_KEY_VAULT_SECRET_IDS_ENV} secret id mapping must be a JSON object`);
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${AZURE_KEY_VAULT_SECRET_IDS_ENV} secret id mapping must be a non-empty JSON object`);
  }
  const normalized = {};
  for (const [secretRef, secretId] of Object.entries(parsed)) {
    const cleanSecretRef = cleanString(secretRef);
    const cleanSecretId = cleanString(secretId);
    if (!SECRET_REF_PATTERN.test(cleanSecretRef) || !cleanSecretId) {
      throw new Error(`${AZURE_KEY_VAULT_SECRET_IDS_ENV} secret id mapping entries must use secret:// refs and non-empty secret ids`);
    }
    normalized[cleanSecretRef] = cleanSecretId;
  }
  return normalized;
}

function vaultCommandFrom({ env = process.env } = {}) {
  return cleanString(env[HASHICORP_VAULT_COMMAND_ENV]);
}

function vaultCommandArgsFrom({ env = process.env } = {}) {
  const rawArgs = cleanString(env[HASHICORP_VAULT_COMMAND_ARGS_ENV]);
  if (!rawArgs) return [];
  let parsed;
  try {
    parsed = JSON.parse(rawArgs);
  } catch {
    throw new Error(`${HASHICORP_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  if (!Array.isArray(parsed) || parsed.some(value => typeof value !== 'string')) {
    throw new Error(`${HASHICORP_VAULT_COMMAND_ARGS_ENV} must be a JSON array of strings`);
  }
  return parsed;
}

function vaultCommandTimeoutFrom({ env = process.env } = {}) {
  const rawTimeout = cleanString(env[HASHICORP_VAULT_TIMEOUT_MS_ENV]);
  if (!rawTimeout) return 5000;
  const timeout = Number(rawTimeout);
  if (!Number.isInteger(timeout) || timeout < 100 || timeout > 30000) {
    throw new Error(`${HASHICORP_VAULT_TIMEOUT_MS_ENV} must be an integer between 100 and 30000`);
  }
  return timeout;
}

function vaultSecretPathMapFrom({ env = process.env } = {}) {
  const rawMap = cleanString(env[HASHICORP_VAULT_SECRET_PATHS_ENV]);
  if (!rawMap) throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping is required`);
  let parsed;
  try {
    parsed = JSON.parse(rawMap);
  } catch {
    throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping must be a JSON object`);
  }
  if (!isPlainObject(parsed) || Object.keys(parsed).length === 0) {
    throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping must be a non-empty JSON object`);
  }
  const normalized = {};
  for (const [secretRef, secretPath] of Object.entries(parsed)) {
    const cleanSecretRef = cleanString(secretRef);
    const cleanSecretPath = cleanString(secretPath);
    if (!SECRET_REF_PATTERN.test(cleanSecretRef) || !cleanSecretPath) {
      throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping entries must use secret:// refs and non-empty Vault paths`);
    }
    normalized[cleanSecretRef] = cleanSecretPath;
  }
  return normalized;
}

function testBackendEnabled({ env = process.env } = {}) {
  return ['1', 'true', 'yes'].includes(cleanString(env[PROVIDER_SECRET_STORE_TEST_BACKEND_ENV]).toLowerCase());
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

function runSecretStoreCommand({ env, action, payload }) {
  const commandPath = storeCommandFrom({ env });
  if (!commandPath) throw new Error(`${PROVIDER_SECRET_STORE_COMMAND_ENV} is required for external_command provider secret store backend`);
  if (!path.isAbsolute(commandPath)) {
    throw new Error(`${PROVIDER_SECRET_STORE_COMMAND_ENV} must be an absolute executable path`);
  }

  const request = {
    action,
    ...payload
  };
  const commandArgs = storeCommandArgsFrom({ env });
  const commandTimeoutMs = storeCommandTimeoutFrom({ env });

  let output;
  try {
    output = execFileSync(commandPath, commandArgs, {
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: commandTimeoutMs,
      maxBuffer: 1024 * 1024,
      env
    });
  } catch {
    throw new Error(`provider secret store command failed for action ${action}`);
  }

  let result;
  try {
    result = JSON.parse(output || '{}');
  } catch {
    throw new Error(`provider secret store command returned invalid JSON for action ${action}`);
  }
  if (result.ok !== true) {
    throw new Error(`provider secret store command failed for action ${action}`);
  }
  return result;
}

export function createExternalCommandProviderSecretStoreAdapter({ env = process.env } = {}) {
  return {
    backend_id: 'external_command',
    backend_kind: 'managed_command',
    storeConfigured() {
      return Boolean(storeCommandFrom({ env }));
    },
    configuredSecretRefs() {
      if (!this.storeConfigured()) return new Set();
      const result = runSecretStoreCommand({
        env,
        action: 'configured_refs',
        payload: {}
      });
      const secretRefs = Array.isArray(result.secret_refs) ? result.secret_refs : [];
      return new Set(secretRefs.map(cleanString).filter(Boolean));
    },
    resolveSecret(secretRef) {
      if (!this.storeConfigured()) return '';
      const result = runSecretStoreCommand({
        env,
        action: 'resolve',
        payload: { secret_ref: cleanString(secretRef) }
      });
      return cleanString(result.secret_value);
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      runSecretStoreCommand({
        env,
        action: 'store',
        payload: {
          provider_id: provider.provider_id,
          secret_ref: provider.secret_ref,
          credential_env_var: provider.credential_env_var,
          secret_value,
          actor,
          reason,
          updated_at
        }
      });
      return publicStoreRecord({
        ...provider,
        algorithm: 'managed-by-external-command',
        updated_at,
        updated_by: actor,
        reason
      }, this);
    }
  };
}

function runAwsSecretStoreCommand({ env, action, payload }) {
  const commandPath = awsCommandFrom({ env });
  if (!commandPath) throw new Error(`${AWS_SECRETS_MANAGER_COMMAND_ENV} is required for aws_secrets_manager provider secret store backend`);
  if (!path.isAbsolute(commandPath)) {
    throw new Error(`${AWS_SECRETS_MANAGER_COMMAND_ENV} must be an absolute executable path`);
  }

  const request = {
    action,
    provider: 'aws_secrets_manager',
    ...payload
  };
  const commandArgs = awsCommandArgsFrom({ env });
  const commandTimeoutMs = awsCommandTimeoutFrom({ env });

  let output;
  try {
    output = execFileSync(commandPath, commandArgs, {
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: commandTimeoutMs,
      maxBuffer: 1024 * 1024,
      env
    });
  } catch {
    throw new Error(`AWS Secrets Manager command failed for action ${action}`);
  }

  let result;
  try {
    result = JSON.parse(output || '{}');
  } catch {
    throw new Error(`AWS Secrets Manager command returned invalid JSON for action ${action}`);
  }
  if (result.ok !== true) {
    throw new Error(`AWS Secrets Manager command failed for action ${action}`);
  }
  return result;
}

export function createAwsSecretsManagerProviderSecretStoreAdapter({ env = process.env } = {}) {
  return {
    backend_id: 'aws_secrets_manager',
    backend_kind: 'managed_secret_store',
    storeConfigured() {
      if (!awsCommandFrom({ env })) return false;
      return Object.keys(awsSecretIdMapFrom({ env })).length > 0;
    },
    configuredSecretRefs() {
      if (!this.storeConfigured()) return new Set();
      const secretIdMap = awsSecretIdMapFrom({ env });
      const allowedSecretRefs = new Set(Object.keys(secretIdMap));
      const result = runAwsSecretStoreCommand({
        env,
        action: 'configured_refs',
        payload: { secret_ids: secretIdMap }
      });
      const secretRefs = Array.isArray(result.secret_refs) ? result.secret_refs : [];
      return new Set(secretRefs.map(cleanString).filter(secretRef => allowedSecretRefs.has(secretRef)));
    },
    resolveSecret(secretRef) {
      if (!this.storeConfigured()) return '';
      const cleanSecretRef = cleanString(secretRef);
      const secretIdMap = awsSecretIdMapFrom({ env });
      const secretId = secretIdMap[cleanSecretRef];
      if (!secretId) return '';
      const result = runAwsSecretStoreCommand({
        env,
        action: 'resolve',
        payload: {
          secret_ref: cleanSecretRef,
          secret_id: secretId
        }
      });
      return cleanString(result.secret_value);
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      const secretIdMap = awsSecretIdMapFrom({ env });
      const secretId = secretIdMap[provider.secret_ref];
      if (!secretId) {
        throw new Error(`${AWS_SECRETS_MANAGER_SECRET_IDS_ENV} secret id mapping is required for ${provider.secret_ref}`);
      }
      runAwsSecretStoreCommand({
        env,
        action: 'store',
        payload: {
          provider_id: provider.provider_id,
          secret_ref: provider.secret_ref,
          secret_id: secretId,
          credential_env_var: provider.credential_env_var,
          secret_value,
          actor,
          reason,
          updated_at
        }
      });
      return publicStoreRecord({
        ...provider,
        algorithm: 'managed-by-aws-secrets-manager',
        updated_at,
        updated_by: actor,
        reason
      }, this);
    }
  };
}

function runGcpSecretStoreCommand({ env, action, payload }) {
  const commandPath = gcpCommandFrom({ env });
  if (!commandPath) throw new Error(`${GCP_SECRET_MANAGER_COMMAND_ENV} is required for gcp_secret_manager provider secret store backend`);
  if (!path.isAbsolute(commandPath)) {
    throw new Error(`${GCP_SECRET_MANAGER_COMMAND_ENV} must be an absolute executable path`);
  }

  const request = {
    action,
    provider: 'gcp_secret_manager',
    ...payload
  };
  const commandArgs = gcpCommandArgsFrom({ env });
  const commandTimeoutMs = gcpCommandTimeoutFrom({ env });

  let output;
  try {
    output = execFileSync(commandPath, commandArgs, {
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: commandTimeoutMs,
      maxBuffer: 1024 * 1024,
      env
    });
  } catch {
    throw new Error(`GCP Secret Manager command failed for action ${action}`);
  }

  let result;
  try {
    result = JSON.parse(output || '{}');
  } catch {
    throw new Error(`GCP Secret Manager command returned invalid JSON for action ${action}`);
  }
  if (result.ok !== true) {
    throw new Error(`GCP Secret Manager command failed for action ${action}`);
  }
  return result;
}

export function createGcpSecretManagerProviderSecretStoreAdapter({ env = process.env } = {}) {
  return {
    backend_id: 'gcp_secret_manager',
    backend_kind: 'managed_secret_store',
    storeConfigured() {
      if (!gcpCommandFrom({ env })) return false;
      return Object.keys(gcpSecretIdMapFrom({ env })).length > 0;
    },
    configuredSecretRefs() {
      if (!this.storeConfigured()) return new Set();
      const secretIdMap = gcpSecretIdMapFrom({ env });
      const allowedSecretRefs = new Set(Object.keys(secretIdMap));
      const result = runGcpSecretStoreCommand({
        env,
        action: 'configured_refs',
        payload: { secret_ids: secretIdMap }
      });
      const secretRefs = Array.isArray(result.secret_refs) ? result.secret_refs : [];
      return new Set(secretRefs.map(cleanString).filter(secretRef => allowedSecretRefs.has(secretRef)));
    },
    resolveSecret(secretRef) {
      if (!this.storeConfigured()) return '';
      const cleanSecretRef = cleanString(secretRef);
      const secretIdMap = gcpSecretIdMapFrom({ env });
      const secretId = secretIdMap[cleanSecretRef];
      if (!secretId) return '';
      const result = runGcpSecretStoreCommand({
        env,
        action: 'resolve',
        payload: {
          secret_ref: cleanSecretRef,
          secret_id: secretId
        }
      });
      return cleanString(result.secret_value);
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      const secretIdMap = gcpSecretIdMapFrom({ env });
      const secretId = secretIdMap[provider.secret_ref];
      if (!secretId) {
        throw new Error(`${GCP_SECRET_MANAGER_SECRET_IDS_ENV} secret id mapping is required for ${provider.secret_ref}`);
      }
      runGcpSecretStoreCommand({
        env,
        action: 'store',
        payload: {
          provider_id: provider.provider_id,
          secret_ref: provider.secret_ref,
          secret_id: secretId,
          credential_env_var: provider.credential_env_var,
          secret_value,
          actor,
          reason,
          updated_at
        }
      });
      return publicStoreRecord({
        ...provider,
        algorithm: 'managed-by-gcp-secret-manager',
        updated_at,
        updated_by: actor,
        reason
      }, this);
    }
  };
}

function runAzureSecretStoreCommand({ env, action, payload }) {
  const commandPath = azureCommandFrom({ env });
  if (!commandPath) throw new Error(`${AZURE_KEY_VAULT_COMMAND_ENV} is required for azure_key_vault provider secret store backend`);
  if (!path.isAbsolute(commandPath)) {
    throw new Error(`${AZURE_KEY_VAULT_COMMAND_ENV} must be an absolute executable path`);
  }

  const request = {
    action,
    provider: 'azure_key_vault',
    ...payload
  };
  const commandArgs = azureCommandArgsFrom({ env });
  const commandTimeoutMs = azureCommandTimeoutFrom({ env });

  let output;
  try {
    output = execFileSync(commandPath, commandArgs, {
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: commandTimeoutMs,
      maxBuffer: 1024 * 1024,
      env
    });
  } catch {
    throw new Error(`Azure Key Vault command failed for action ${action}`);
  }

  let result;
  try {
    result = JSON.parse(output || '{}');
  } catch {
    throw new Error(`Azure Key Vault command returned invalid JSON for action ${action}`);
  }
  if (result.ok !== true) {
    throw new Error(`Azure Key Vault command failed for action ${action}`);
  }
  return result;
}

export function createAzureKeyVaultProviderSecretStoreAdapter({ env = process.env } = {}) {
  return {
    backend_id: 'azure_key_vault',
    backend_kind: 'managed_secret_store',
    storeConfigured() {
      if (!azureCommandFrom({ env })) return false;
      return Object.keys(azureSecretIdMapFrom({ env })).length > 0;
    },
    configuredSecretRefs() {
      if (!this.storeConfigured()) return new Set();
      const secretIdMap = azureSecretIdMapFrom({ env });
      const allowedSecretRefs = new Set(Object.keys(secretIdMap));
      const result = runAzureSecretStoreCommand({
        env,
        action: 'configured_refs',
        payload: { secret_ids: secretIdMap }
      });
      const secretRefs = Array.isArray(result.secret_refs) ? result.secret_refs : [];
      return new Set(secretRefs.map(cleanString).filter(secretRef => allowedSecretRefs.has(secretRef)));
    },
    resolveSecret(secretRef) {
      if (!this.storeConfigured()) return '';
      const cleanSecretRef = cleanString(secretRef);
      const secretIdMap = azureSecretIdMapFrom({ env });
      const secretId = secretIdMap[cleanSecretRef];
      if (!secretId) return '';
      const result = runAzureSecretStoreCommand({
        env,
        action: 'resolve',
        payload: {
          secret_ref: cleanSecretRef,
          secret_id: secretId
        }
      });
      return cleanString(result.secret_value);
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      const secretIdMap = azureSecretIdMapFrom({ env });
      const secretId = secretIdMap[provider.secret_ref];
      if (!secretId) {
        throw new Error(`${AZURE_KEY_VAULT_SECRET_IDS_ENV} secret id mapping is required for ${provider.secret_ref}`);
      }
      runAzureSecretStoreCommand({
        env,
        action: 'store',
        payload: {
          provider_id: provider.provider_id,
          secret_ref: provider.secret_ref,
          secret_id: secretId,
          credential_env_var: provider.credential_env_var,
          secret_value,
          actor,
          reason,
          updated_at
        }
      });
      return publicStoreRecord({
        ...provider,
        algorithm: 'managed-by-azure-key-vault',
        updated_at,
        updated_by: actor,
        reason
      }, this);
    }
  };
}

function runVaultSecretStoreCommand({ env, action, payload }) {
  const commandPath = vaultCommandFrom({ env });
  if (!commandPath) throw new Error(`${HASHICORP_VAULT_COMMAND_ENV} is required for hashicorp_vault provider secret store backend`);
  if (!path.isAbsolute(commandPath)) {
    throw new Error(`${HASHICORP_VAULT_COMMAND_ENV} must be an absolute executable path`);
  }

  const request = {
    action,
    provider: 'hashicorp_vault',
    ...payload
  };
  const commandArgs = vaultCommandArgsFrom({ env });
  const commandTimeoutMs = vaultCommandTimeoutFrom({ env });

  let output;
  try {
    output = execFileSync(commandPath, commandArgs, {
      input: `${JSON.stringify(request)}\n`,
      encoding: 'utf8',
      timeout: commandTimeoutMs,
      maxBuffer: 1024 * 1024,
      env
    });
  } catch {
    throw new Error(`HashiCorp Vault command failed for action ${action}`);
  }

  let result;
  try {
    result = JSON.parse(output || '{}');
  } catch {
    throw new Error(`HashiCorp Vault command returned invalid JSON for action ${action}`);
  }
  if (result.ok !== true) {
    throw new Error(`HashiCorp Vault command failed for action ${action}`);
  }
  return result;
}

export function createHashicorpVaultProviderSecretStoreAdapter({ env = process.env } = {}) {
  return {
    backend_id: 'hashicorp_vault',
    backend_kind: 'managed_secret_store',
    storeConfigured() {
      if (!vaultCommandFrom({ env })) return false;
      return Object.keys(vaultSecretPathMapFrom({ env })).length > 0;
    },
    configuredSecretRefs() {
      if (!this.storeConfigured()) return new Set();
      const secretPathMap = vaultSecretPathMapFrom({ env });
      const allowedSecretRefs = new Set(Object.keys(secretPathMap));
      const result = runVaultSecretStoreCommand({
        env,
        action: 'configured_refs',
        payload: { secret_ids: secretPathMap }
      });
      const secretRefs = Array.isArray(result.secret_refs) ? result.secret_refs : [];
      return new Set(secretRefs.map(cleanString).filter(secretRef => allowedSecretRefs.has(secretRef)));
    },
    resolveSecret(secretRef) {
      if (!this.storeConfigured()) return '';
      const cleanSecretRef = cleanString(secretRef);
      const secretPathMap = vaultSecretPathMapFrom({ env });
      const secretPath = secretPathMap[cleanSecretRef];
      if (!secretPath) return '';
      const result = runVaultSecretStoreCommand({
        env,
        action: 'resolve',
        payload: {
          secret_ref: cleanSecretRef,
          secret_id: secretPath
        }
      });
      return cleanString(result.secret_value);
    },
    storeSecret({
      provider,
      secret_value,
      actor,
      reason,
      updated_at
    }) {
      const secretPathMap = vaultSecretPathMapFrom({ env });
      const secretPath = secretPathMap[provider.secret_ref];
      if (!secretPath) {
        throw new Error(`${HASHICORP_VAULT_SECRET_PATHS_ENV} secret path mapping is required for ${provider.secret_ref}`);
      }
      runVaultSecretStoreCommand({
        env,
        action: 'store',
        payload: {
          provider_id: provider.provider_id,
          secret_ref: provider.secret_ref,
          secret_id: secretPath,
          credential_env_var: provider.credential_env_var,
          secret_value,
          actor,
          reason,
          updated_at
        }
      });
      return publicStoreRecord({
        ...provider,
        algorithm: 'managed-by-hashicorp-vault',
        updated_at,
        updated_by: actor,
        reason
      }, this);
    }
  };
}

export function createConfiguredProviderSecretStoreAdapter({ env = process.env } = {}) {
  const backend = storeBackendFrom({ env });
  if (backend === 'local_file') {
    return createLocalProviderSecretStoreAdapter({ env });
  }
  if (backend === 'hosted_memory') {
    if (!testBackendEnabled({ env })) {
      throw new Error(
        `test-only provider secret store backend hosted_memory requires ${PROVIDER_SECRET_STORE_TEST_BACKEND_ENV}=1; managed hosted secret stores must be injected as approved adapters`
      );
    }
    return createHostedProviderSecretStoreAdapter({ backend_id: backend });
  }
  if (backend === 'external_command') {
    return createExternalCommandProviderSecretStoreAdapter({ env });
  }
  if (backend === 'aws_secrets_manager') {
    return createAwsSecretsManagerProviderSecretStoreAdapter({ env });
  }
  if (backend === 'gcp_secret_manager') {
    return createGcpSecretManagerProviderSecretStoreAdapter({ env });
  }
  if (backend === 'azure_key_vault') {
    return createAzureKeyVaultProviderSecretStoreAdapter({ env });
  }
  if (backend === 'hashicorp_vault') {
    return createHashicorpVaultProviderSecretStoreAdapter({ env });
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
