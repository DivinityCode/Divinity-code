import assert from 'assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
  createConfiguredProviderSecretStoreAdapter,
  createProviderCredentialResolver,
  createHostedProviderSecretStoreAdapter,
  loadProviderSecretRefs,
  providerSecretReadiness,
  storeProviderSecret
} from '../packages/provider-secrets/src/index.mjs';

const tmpRoot = mkdtempSync(path.join(tmpdir(), 'divinity-provider-secret-refs-'));

function writeManifest(name, payload) {
  const manifestPath = path.join(tmpRoot, name);
  writeFileSync(manifestPath, JSON.stringify(payload, null, 2));
  return manifestPath;
}

try {
  const secretRef = 'secret://divinity/providers/hosted-secret-mock/api-key';
  const manifestPath = writeManifest('provider-secret-refs.json', {
    format: 'divinity.provider_secret_refs.v1',
    providers: [
      {
        provider_id: 'hosted_secret_mock',
        secret_ref: secretRef,
        credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY'
      }
    ]
  });

  const manifest = loadProviderSecretRefs({ path: manifestPath });
  assert.equal(manifest.format, 'divinity.provider_secret_refs.v1');
  assert.deepEqual(manifest.providers, [
    {
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY'
    }
  ]);

  const readiness = providerSecretReadiness({
    env: {
      DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
      HOSTED_SECRET_MOCK_API_KEY: 'hosted-secret-value'
    }
  });
  assert.equal(readiness.format, 'divinity.provider_secret_readiness.v1');
  assert.equal(readiness.manifest_configured, true);
  assert.equal(readiness.store_configured, false);
  assert.equal(readiness.store_backend_id, 'local_file');
  assert.equal(readiness.store_backend_kind, 'local_file');
  assert.equal(readiness.any_configured, true);
  assert.deepEqual(readiness.providers, [
    {
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
      credential_configured: true,
      credential_source: 'environment'
    }
  ]);
  assert.equal(JSON.stringify(readiness).includes('hosted-secret-value'), false);

  const emptyReadiness = providerSecretReadiness({ env: {} });
  assert.equal(emptyReadiness.format, 'divinity.provider_secret_readiness.v1');
  assert.equal(emptyReadiness.manifest_configured, false);
  assert.equal(emptyReadiness.store_configured, false);
  assert.equal(emptyReadiness.store_backend_id, 'local_file');
  assert.equal(emptyReadiness.store_backend_kind, 'local_file');
  assert.equal(emptyReadiness.any_configured, false);
  assert.deepEqual(emptyReadiness.providers, []);

  const runtime = {
    provider_id: 'hosted_secret_mock',
    auth: {
      credential_env_vars: ['UNSET_HOSTED_SECRET_MOCK_API_KEY'],
      configured_env_vars: []
    }
  };

  const storePath = path.join(tmpRoot, 'provider-secret-store.json');
  const storeKey = 'test-store-key-material';
  const storeSecret = 'store-secret-value';
  const storeRecord = storeProviderSecret({
    env: {
      DIVINITY_PROVIDER_SECRET_STORE_PATH: storePath,
      DIVINITY_PROVIDER_SECRET_STORE_KEY: storeKey
    },
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: storeSecret,
    actor: 'operator@example.com',
    reason: 'Authorized provider onboarding',
    updated_at: '2026-05-26T08:00:00.000Z'
  });
  assert.equal(storeRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(storeRecord.provider_id, 'hosted_secret_mock');
  assert.equal(storeRecord.secret_ref, secretRef);
  assert.equal(storeRecord.credential_env_var, 'HOSTED_SECRET_MOCK_API_KEY');
  assert.equal(storeRecord.encrypted, true);
  assert.equal(storeRecord.store_backend_id, 'local_file');
  assert.equal(storeRecord.store_backend_kind, 'local_file');
  assert.equal(storeRecord.updated_by, 'operator@example.com');
  assert.equal(storeRecord.reason, 'Authorized provider onboarding');
  assert.equal(JSON.stringify(storeRecord).includes(storeSecret), false);
  assert.equal(readFileSync(storePath, 'utf8').includes(storeSecret), false);

  const storeReadiness = providerSecretReadiness({
    env: {
      DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
      DIVINITY_PROVIDER_SECRET_STORE_PATH: storePath,
      DIVINITY_PROVIDER_SECRET_STORE_KEY: storeKey
    }
  });
  assert.equal(storeReadiness.store_configured, true);
  assert.equal(storeReadiness.store_backend_id, 'local_file');
  assert.equal(storeReadiness.store_backend_kind, 'local_file');
  assert.equal(storeReadiness.any_configured, true);
  assert.deepEqual(storeReadiness.providers, [
    {
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
      credential_configured: true,
      credential_source: 'store'
    }
  ]);
  assert.equal(JSON.stringify(storeReadiness).includes(storeSecret), false);

  const storeResolver = createProviderCredentialResolver({
    env: {
      DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
      DIVINITY_PROVIDER_SECRET_STORE_PATH: storePath,
      DIVINITY_PROVIDER_SECRET_STORE_KEY: storeKey
    }
  });
  assert.deepEqual(storeResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(storeResolver.resolveCredential(runtime), storeSecret);

  const hostedAdapter = createHostedProviderSecretStoreAdapter({
    backend_id: 'hosted_operator_mock'
  });
  const hostedRecord = storeProviderSecret({
    env: {},
    secret_store_adapter: hostedAdapter,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'hosted-adapter-secret',
    actor: 'operator@example.com',
    reason: 'Authorized hosted provider onboarding',
    updated_at: '2026-05-26T09:00:00.000Z'
  });
  assert.equal(hostedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(hostedRecord.store_backend_id, 'hosted_operator_mock');
  assert.equal(hostedRecord.store_backend_kind, 'hosted_operator');
  assert.equal(hostedRecord.provider_id, 'hosted_secret_mock');
  assert.equal(JSON.stringify(hostedRecord).includes('hosted-adapter-secret'), false);

  const hostedReadiness = providerSecretReadiness({
    env: { DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath },
    secret_store_adapter: hostedAdapter
  });
  assert.equal(hostedReadiness.store_configured, true);
  assert.equal(hostedReadiness.store_backend_id, 'hosted_operator_mock');
  assert.equal(hostedReadiness.store_backend_kind, 'hosted_operator');
  assert.equal(hostedReadiness.providers[0].credential_source, 'store');

  const hostedResolver = createProviderCredentialResolver({
    env: { DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath },
    secret_store_adapter: hostedAdapter
  });
  assert.deepEqual(hostedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(hostedResolver.resolveCredential(runtime), 'hosted-adapter-secret');

  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: { DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'hosted_memory' }
    }),
    /test-only provider secret store backend/
  );
  const configuredHostedAdapter = createConfiguredProviderSecretStoreAdapter({
    env: {
      DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'hosted_memory',
      DIVINITY_ENABLE_TEST_SECRET_STORE_BACKEND: '1'
    }
  });
  assert.equal(configuredHostedAdapter.backend_id, 'hosted_memory');
  assert.equal(configuredHostedAdapter.backend_kind, 'hosted_operator');

  const managedCommandStorePath = path.join(tmpRoot, 'managed-command-store.json');
  const managedCommandEnv = {
    DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
    DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'external_command',
    DIVINITY_PROVIDER_SECRET_STORE_COMMAND: process.execPath,
    DIVINITY_PROVIDER_SECRET_STORE_COMMAND_ARGS: JSON.stringify([
      path.resolve('tests/fixtures/provider-secret-store-command.mjs')
    ]),
    DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: managedCommandStorePath
  };
  const managedCommandRecord = storeProviderSecret({
    env: managedCommandEnv,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'managed-command-secret',
    actor: 'operator@example.com',
    reason: 'Authorized managed secret command onboarding',
    updated_at: '2026-05-26T10:00:00.000Z'
  });
  assert.equal(managedCommandRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(managedCommandRecord.store_backend_id, 'external_command');
  assert.equal(managedCommandRecord.store_backend_kind, 'managed_command');
  assert.equal(managedCommandRecord.algorithm, 'managed-by-external-command');
  assert.equal(JSON.stringify(managedCommandRecord).includes('managed-command-secret'), false);

  const managedCommandReadiness = providerSecretReadiness({
    env: managedCommandEnv
  });
  assert.equal(managedCommandReadiness.store_configured, true);
  assert.equal(managedCommandReadiness.store_backend_id, 'external_command');
  assert.equal(managedCommandReadiness.store_backend_kind, 'managed_command');
  assert.equal(managedCommandReadiness.providers[0].credential_configured, true);
  assert.equal(managedCommandReadiness.providers[0].credential_source, 'store');
  assert.equal(JSON.stringify(managedCommandReadiness).includes('managed-command-secret'), false);

  const managedCommandResolver = createProviderCredentialResolver({
    env: managedCommandEnv
  });
  assert.deepEqual(managedCommandResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(managedCommandResolver.resolveCredential(runtime), 'managed-command-secret');
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...managedCommandEnv,
        DIVINITY_PROVIDER_SECRET_STORE_COMMAND: 'node'
      }
    }).configuredSecretRefs(),
    /absolute executable path/
  );
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...managedCommandEnv,
        DIVINITY_PROVIDER_SECRET_STORE_COMMAND_ARGS: '"--eval"'
      }
    }).configuredSecretRefs(),
    /JSON array of strings/
  );

  const awsManagedStorePath = path.join(tmpRoot, 'aws-managed-store.json');
  const awsManagedSecretId = 'arn:aws:secretsmanager:eu-west-1:111122223333:secret:divinity/openrouter';
  const awsManagedEnv = {
    DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
    DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'aws_secrets_manager',
    DIVINITY_AWS_SECRETS_MANAGER_COMMAND: process.execPath,
    DIVINITY_AWS_SECRETS_MANAGER_COMMAND_ARGS: JSON.stringify([
      path.resolve('tests/fixtures/provider-secret-store-command.mjs')
    ]),
    DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS: JSON.stringify({
      [secretRef]: awsManagedSecretId
    }),
    DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: awsManagedStorePath
  };
  const awsManagedRecord = storeProviderSecret({
    env: awsManagedEnv,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'aws-managed-secret-value',
    actor: 'operator@example.com',
    reason: 'Authorized AWS Secrets Manager onboarding',
    updated_at: '2026-05-26T11:00:00.000Z'
  });
  assert.equal(awsManagedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(awsManagedRecord.store_backend_id, 'aws_secrets_manager');
  assert.equal(awsManagedRecord.store_backend_kind, 'managed_secret_store');
  assert.equal(awsManagedRecord.algorithm, 'managed-by-aws-secrets-manager');
  assert.equal(JSON.stringify(awsManagedRecord).includes('aws-managed-secret-value'), false);
  assert.equal(JSON.stringify(awsManagedRecord).includes(awsManagedSecretId), false);

  const awsManagedReadiness = providerSecretReadiness({
    env: awsManagedEnv
  });
  assert.equal(awsManagedReadiness.store_configured, true);
  assert.equal(awsManagedReadiness.store_backend_id, 'aws_secrets_manager');
  assert.equal(awsManagedReadiness.store_backend_kind, 'managed_secret_store');
  assert.equal(awsManagedReadiness.providers[0].credential_configured, true);
  assert.equal(awsManagedReadiness.providers[0].credential_source, 'store');
  assert.equal(JSON.stringify(awsManagedReadiness).includes('aws-managed-secret-value'), false);
  assert.equal(JSON.stringify(awsManagedReadiness).includes(awsManagedSecretId), false);

  const awsManagedResolver = createProviderCredentialResolver({
    env: awsManagedEnv
  });
  assert.deepEqual(awsManagedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(awsManagedResolver.resolveCredential(runtime), 'aws-managed-secret-value');
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...awsManagedEnv,
        DIVINITY_AWS_SECRETS_MANAGER_COMMAND: 'aws'
      }
    }).configuredSecretRefs(),
    /absolute executable path/
  );
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...awsManagedEnv,
        DIVINITY_AWS_SECRETS_MANAGER_SECRET_IDS: '{}'
      }
    }).configuredSecretRefs(),
    /secret id mapping/
  );

  const gcpManagedStorePath = path.join(tmpRoot, 'gcp-managed-store.json');
  const gcpManagedSecretId = 'projects/divinity-test/secrets/openrouter-api-key/versions/latest';
  const gcpManagedEnv = {
    DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
    DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'gcp_secret_manager',
    DIVINITY_GCP_SECRET_MANAGER_COMMAND: process.execPath,
    DIVINITY_GCP_SECRET_MANAGER_COMMAND_ARGS: JSON.stringify([
      path.resolve('tests/fixtures/provider-secret-store-command.mjs')
    ]),
    DIVINITY_GCP_SECRET_MANAGER_SECRET_IDS: JSON.stringify({
      [secretRef]: gcpManagedSecretId
    }),
    DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: gcpManagedStorePath
  };
  const gcpManagedRecord = storeProviderSecret({
    env: gcpManagedEnv,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'gcp-managed-secret-value',
    actor: 'operator@example.com',
    reason: 'Authorized GCP Secret Manager onboarding',
    updated_at: '2026-05-26T12:00:00.000Z'
  });
  assert.equal(gcpManagedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(gcpManagedRecord.store_backend_id, 'gcp_secret_manager');
  assert.equal(gcpManagedRecord.store_backend_kind, 'managed_secret_store');
  assert.equal(gcpManagedRecord.algorithm, 'managed-by-gcp-secret-manager');
  assert.equal(JSON.stringify(gcpManagedRecord).includes('gcp-managed-secret-value'), false);
  assert.equal(JSON.stringify(gcpManagedRecord).includes(gcpManagedSecretId), false);

  const gcpManagedReadiness = providerSecretReadiness({
    env: gcpManagedEnv
  });
  assert.equal(gcpManagedReadiness.store_configured, true);
  assert.equal(gcpManagedReadiness.store_backend_id, 'gcp_secret_manager');
  assert.equal(gcpManagedReadiness.store_backend_kind, 'managed_secret_store');
  assert.equal(gcpManagedReadiness.providers[0].credential_configured, true);
  assert.equal(gcpManagedReadiness.providers[0].credential_source, 'store');
  assert.equal(JSON.stringify(gcpManagedReadiness).includes('gcp-managed-secret-value'), false);
  assert.equal(JSON.stringify(gcpManagedReadiness).includes(gcpManagedSecretId), false);

  const gcpManagedResolver = createProviderCredentialResolver({
    env: gcpManagedEnv
  });
  assert.deepEqual(gcpManagedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(gcpManagedResolver.resolveCredential(runtime), 'gcp-managed-secret-value');
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...gcpManagedEnv,
        DIVINITY_GCP_SECRET_MANAGER_COMMAND: 'gcloud'
      }
    }).configuredSecretRefs(),
    /absolute executable path/
  );
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...gcpManagedEnv,
        DIVINITY_GCP_SECRET_MANAGER_SECRET_IDS: '{}'
      }
    }).configuredSecretRefs(),
    /secret id mapping/
  );

  const azureManagedStorePath = path.join(tmpRoot, 'azure-managed-store.json');
  const azureManagedSecretId = 'https://divinity-test.vault.azure.net/secrets/openrouter-api-key';
  const azureManagedEnv = {
    DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
    DIVINITY_PROVIDER_SECRET_STORE_BACKEND: 'azure_key_vault',
    DIVINITY_AZURE_KEY_VAULT_COMMAND: process.execPath,
    DIVINITY_AZURE_KEY_VAULT_COMMAND_ARGS: JSON.stringify([
      path.resolve('tests/fixtures/provider-secret-store-command.mjs')
    ]),
    DIVINITY_AZURE_KEY_VAULT_SECRET_IDS: JSON.stringify({
      [secretRef]: azureManagedSecretId
    }),
    DIVINITY_TEST_MANAGED_SECRET_STORE_PATH: azureManagedStorePath
  };
  const azureManagedRecord = storeProviderSecret({
    env: azureManagedEnv,
    provider_id: 'hosted_secret_mock',
    secret_ref: secretRef,
    credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
    secret_value: 'azure-managed-secret-value',
    actor: 'operator@example.com',
    reason: 'Authorized Azure Key Vault onboarding',
    updated_at: '2026-05-26T13:00:00.000Z'
  });
  assert.equal(azureManagedRecord.format, 'divinity.provider_secret_store_record.v1');
  assert.equal(azureManagedRecord.store_backend_id, 'azure_key_vault');
  assert.equal(azureManagedRecord.store_backend_kind, 'managed_secret_store');
  assert.equal(azureManagedRecord.algorithm, 'managed-by-azure-key-vault');
  assert.equal(JSON.stringify(azureManagedRecord).includes('azure-managed-secret-value'), false);
  assert.equal(JSON.stringify(azureManagedRecord).includes(azureManagedSecretId), false);

  const azureManagedReadiness = providerSecretReadiness({
    env: azureManagedEnv
  });
  assert.equal(azureManagedReadiness.store_configured, true);
  assert.equal(azureManagedReadiness.store_backend_id, 'azure_key_vault');
  assert.equal(azureManagedReadiness.store_backend_kind, 'managed_secret_store');
  assert.equal(azureManagedReadiness.providers[0].credential_configured, true);
  assert.equal(azureManagedReadiness.providers[0].credential_source, 'store');
  assert.equal(JSON.stringify(azureManagedReadiness).includes('azure-managed-secret-value'), false);
  assert.equal(JSON.stringify(azureManagedReadiness).includes(azureManagedSecretId), false);

  const azureManagedResolver = createProviderCredentialResolver({
    env: azureManagedEnv
  });
  assert.deepEqual(azureManagedResolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(azureManagedResolver.resolveCredential(runtime), 'azure-managed-secret-value');
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...azureManagedEnv,
        DIVINITY_AZURE_KEY_VAULT_COMMAND: 'az'
      }
    }).configuredSecretRefs(),
    /absolute executable path/
  );
  assert.throws(
    () => createConfiguredProviderSecretStoreAdapter({
      env: {
        ...azureManagedEnv,
        DIVINITY_AZURE_KEY_VAULT_SECRET_IDS: '{}'
      }
    }).configuredSecretRefs(),
    /secret id mapping/
  );

  assert.throws(
    () => storeProviderSecret({
      env: {
        DIVINITY_PROVIDER_SECRET_STORE_PATH: path.join(tmpRoot, 'missing-key-store.json')
      },
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
      secret_value: 'missing-key-secret',
      actor: 'operator@example.com',
      reason: 'Authorized provider onboarding'
    }),
    /provider secret store key is required/
  );
  assert.throws(
    () => storeProviderSecret({
      env: {
        DIVINITY_PROVIDER_SECRET_STORE_PATH: path.join(tmpRoot, 'missing-actor-store.json'),
        DIVINITY_PROVIDER_SECRET_STORE_KEY: storeKey
      },
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
      secret_value: 'missing-actor-secret',
      reason: 'Authorized provider onboarding'
    }),
    /actor is required/
  );

  const resolver = createProviderCredentialResolver({
    env: {
      DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
      HOSTED_SECRET_MOCK_API_KEY: 'hosted-secret-value'
    }
  });

  assert.deepEqual(resolver.configuredSecretRefs(runtime), [secretRef]);
  assert.equal(resolver.resolveCredential(runtime), 'hosted-secret-value');
  assert.equal(JSON.stringify({ refs: resolver.configuredSecretRefs(runtime) }).includes('hosted-secret-value'), false);

  const missingEnvResolver = createProviderCredentialResolver({
    env: { DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath }
  });
  assert.deepEqual(missingEnvResolver.configuredSecretRefs(runtime), []);
  assert.equal(missingEnvResolver.resolveCredential(runtime), '');

  const emptyResolver = createProviderCredentialResolver({ env: {} });
  assert.deepEqual(emptyResolver.configuredSecretRefs(runtime), []);
  assert.equal(emptyResolver.resolveCredential(runtime), '');

  const rawSecretPath = writeManifest('raw-secret.json', {
    format: 'divinity.provider_secret_refs.v1',
    providers: [
      {
        provider_id: 'raw_secret_mock',
        secret_ref: 'secret://divinity/providers/raw-secret-mock/api-key',
        credential_env_var: 'RAW_SECRET_MOCK_API_KEY',
        api_key: 'must-not-appear-in-manifest'
      }
    ]
  });
  assert.throws(
    () => loadProviderSecretRefs({ path: rawSecretPath }),
    /raw credential field api_key/
  );

  const bypassPath = writeManifest('bypass-secret-ref.json', {
    format: 'divinity.provider_secret_refs.v1',
    providers: [
      {
        provider_id: 'bypass_mock',
        secret_ref: 'secret://divinity/providers/bypass-mock/api-key',
        credential_env_var: 'BYPASS_MOCK_API_KEY'
      }
    ]
  });
  assert.throws(
    () => loadProviderSecretRefs({ path: bypassPath }),
    /public shared keys and limit bypass sources are not allowed/
  );

  const sharedKeySourcePath = writeManifest('shared-key-source.json', {
    format: 'divinity.provider_secret_refs.v1',
    source: 'public shared key pool',
    providers: []
  });
  assert.throws(
    () => loadProviderSecretRefs({ path: sharedKeySourcePath }),
    /public shared keys and limit bypass sources are not allowed/
  );

  const duplicatePath = writeManifest('duplicate.json', {
    format: 'divinity.provider_secret_refs.v1',
    providers: [
      {
        provider_id: 'duplicate_mock',
        secret_ref: 'secret://divinity/providers/duplicate-mock/api-key',
        credential_env_var: 'DUPLICATE_MOCK_API_KEY'
      },
      {
        provider_id: 'duplicate_mock',
        secret_ref: 'secret://divinity/providers/duplicate-mock/other-key',
        credential_env_var: 'DUPLICATE_MOCK_OTHER_API_KEY'
      }
    ]
  });
  assert.throws(
    () => loadProviderSecretRefs({ path: duplicatePath }),
    /duplicate provider secret ref/
  );

  console.log(JSON.stringify({ ok: true, test: 'provider-secret-refs' }));
} finally {
  rmSync(tmpRoot, { recursive: true, force: true });
}
