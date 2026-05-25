import assert from 'assert/strict';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
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
