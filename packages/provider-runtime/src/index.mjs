import { readFileSync } from 'fs';

export const PROVIDER_TRANSPORTS = [
  'chat_completions',
  'anthropic_messages',
  'codex_responses'
];

export const DEFAULT_PROVIDER_CATALOG_URL = new URL('../providers.v1.json', import.meta.url);
const DANGEROUS_SOURCE_PATTERN = /public.*shared.*key|shared.*public.*key|shared_key|bypass|evade|circumvent/i;

function assertProvider(provider) {
  const requiredFields = [
    'provider_id',
    'display_name',
    'transport',
    'base_url',
    'auth_modes',
    'credential_env_vars',
    'supports_custom_base_url',
    'default_model',
    'capabilities',
    'source'
  ];
  for (const field of requiredFields) {
    if (!(field in provider)) {
      throw new Error(`provider catalog entry missing ${field}`);
    }
  }
  if (!PROVIDER_TRANSPORTS.includes(provider.transport)) {
    throw new Error(`provider catalog entry has unsupported transport: ${provider.transport}`);
  }
  if (DANGEROUS_SOURCE_PATTERN.test(String(provider.source || ''))) {
    throw new Error(`provider catalog entry ${provider.provider_id} uses a forbidden source: public shared keys and limit bypass sources are not allowed`);
  }
}

function readCatalog(catalogRef, label) {
  const catalog = JSON.parse(readFileSync(catalogRef, 'utf8'));
  if (catalog.format !== 'divinity.llm_provider_catalog.v1') {
    throw new Error(`${label} must use format divinity.llm_provider_catalog.v1`);
  }
  const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
  for (const provider of providers) assertProvider(provider);
  return providers;
}

function overlayPathFrom({ overlayPath = '', env = process.env } = {}) {
  return String(overlayPath || env.DIVINITY_PROVIDER_CATALOG_PATH || '').trim();
}

function mergeProviders(baseProviders, overlayProviders) {
  const byId = new Map();
  for (const provider of baseProviders) byId.set(provider.provider_id, provider);
  for (const provider of overlayProviders) byId.set(provider.provider_id, provider);
  return [...byId.values()];
}

export function loadProviderCatalog({
  catalogUrl = DEFAULT_PROVIDER_CATALOG_URL,
  overlayPath = '',
  env = process.env
} = {}) {
  const baseProviders = readCatalog(catalogUrl, 'provider catalog');
  const configuredOverlayPath = overlayPathFrom({ overlayPath, env });
  if (!configuredOverlayPath) return baseProviders;

  const overlayProviders = readCatalog(configuredOverlayPath, 'provider overlay catalog');
  return mergeProviders(baseProviders, overlayProviders);
}

export const BUILT_IN_LLM_PROVIDERS = loadProviderCatalog({ env: {} });
export const LLM_PROVIDERS = BUILT_IN_LLM_PROVIDERS;

function cloneProvider(provider) {
  return {
    format: 'divinity.llm_provider.v1',
    provider_id: provider.provider_id,
    display_name: provider.display_name,
    transport: provider.transport,
    base_url: provider.base_url,
    auth_modes: [...provider.auth_modes],
    credential_env_vars: [...provider.credential_env_vars],
    supports_custom_base_url: provider.supports_custom_base_url,
    default_model: provider.default_model,
    capabilities: [...provider.capabilities],
    source: provider.source
  };
}

function firstConfiguredEnv(provider, env) {
  return provider.credential_env_vars.filter(name => Boolean(String(env[name] || '').trim()));
}

function isLocalBaseUrl(baseUrl) {
  return /^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|::1)(:|\/|$)/i.test(baseUrl);
}

function isCustomLocalProvider(provider) {
  return String(provider?.provider_id || '').startsWith('custom_');
}

function activeProviders(options = {}) {
  return loadProviderCatalog(options);
}

export function publicLlmProviders(options = {}) {
  return activeProviders(options).map(cloneProvider);
}

export function providerById(providerId, options = {}) {
  const normalized = String(providerId || '').trim();
  const provider = activeProviders(options).find(candidate => candidate.provider_id === normalized);
  return provider ? cloneProvider(provider) : null;
}

export function resolveProviderRuntime({
  provider_id = 'openrouter',
  model = '',
  base_url = '',
  env = process.env,
  overlayPath = ''
} = {}) {
  const provider = activeProviders({ env, overlayPath }).find(candidate => candidate.provider_id === String(provider_id || '').trim());
  if (!provider) {
    throw new Error(`unknown LLM provider: ${provider_id}`);
  }

  const configuredEnvVars = firstConfiguredEnv(provider, env);
  const requestedBaseUrl = String(base_url || '').trim().replace(/\/$/, '');
  const resolvedBaseUrl = requestedBaseUrl || provider.base_url;
  const noKeyLocal = isCustomLocalProvider(provider) && isLocalBaseUrl(resolvedBaseUrl);
  const credentialRequired = !noKeyLocal;
  const credentialConfigured = credentialRequired ? configuredEnvVars.length > 0 : true;

  return {
    format: 'divinity.provider_runtime.v1',
    provider_id: provider.provider_id,
    display_name: provider.display_name,
    transport: provider.transport,
    base_url: resolvedBaseUrl,
    model: String(model || provider.default_model || ''),
    auth: {
      mode: noKeyLocal ? 'none' : provider.auth_modes[0],
      credential_required: credentialRequired,
      credential_configured: credentialConfigured,
      credential_env_vars: [...provider.credential_env_vars],
      configured_env_vars: configuredEnvVars
    },
    capabilities: [...provider.capabilities],
    source: requestedBaseUrl ? 'explicit' : provider.source
  };
}

export function providerCredentialReadiness({ env = process.env, overlayPath = '' } = {}) {
  const providers = activeProviders({ env, overlayPath }).map(provider => {
    const configuredEnvVars = firstConfiguredEnv(provider, env);
    const credentialRequired = !isCustomLocalProvider(provider);
    return {
      provider_id: provider.provider_id,
      display_name: provider.display_name,
      credential_required: credentialRequired,
      credential_configured: credentialRequired ? configuredEnvVars.length > 0 : false,
      credential_env_vars: [...provider.credential_env_vars],
      configured_env_vars: configuredEnvVars
    };
  });

  return {
    format: 'divinity.provider_credential_readiness.v1',
    any_configured: providers.some(provider => provider.credential_configured),
    providers
  };
}
