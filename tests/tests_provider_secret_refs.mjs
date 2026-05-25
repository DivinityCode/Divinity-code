import assert from 'assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';

import {
  createProviderCredentialResolver,
  loadProviderSecretRefs,
  providerSecretReadiness
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
  assert.equal(readiness.any_configured, true);
  assert.deepEqual(readiness.providers, [
    {
      provider_id: 'hosted_secret_mock',
      secret_ref: secretRef,
      credential_env_var: 'HOSTED_SECRET_MOCK_API_KEY',
      credential_configured: true
    }
  ]);
  assert.equal(JSON.stringify(readiness).includes('hosted-secret-value'), false);

  const emptyReadiness = providerSecretReadiness({ env: {} });
  assert.equal(emptyReadiness.format, 'divinity.provider_secret_readiness.v1');
  assert.equal(emptyReadiness.manifest_configured, false);
  assert.equal(emptyReadiness.any_configured, false);
  assert.deepEqual(emptyReadiness.providers, []);

  const resolver = createProviderCredentialResolver({
    env: {
      DIVINITY_PROVIDER_SECRET_REFS_PATH: manifestPath,
      HOSTED_SECRET_MOCK_API_KEY: 'hosted-secret-value'
    }
  });
  const runtime = {
    provider_id: 'hosted_secret_mock',
    auth: {
      credential_env_vars: ['UNSET_HOSTED_SECRET_MOCK_API_KEY'],
      configured_env_vars: []
    }
  };

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
