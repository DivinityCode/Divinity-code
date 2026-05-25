import { readFileSync } from 'fs';

export const PROVIDER_TRANSPORTS = [
  'chat_completions',
  'anthropic_messages',
  'codex_responses'
];

const PROVIDER_CATALOG_URL = new URL('../providers.v1.json', import.meta.url);

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
}

export function loadProviderCatalog({ catalogUrl = PROVIDER_CATALOG_URL } = {}) {
  const catalog = JSON.parse(readFileSync(catalogUrl, 'utf8'));
  const providers = Array.isArray(catalog.providers) ? catalog.providers : [];
  for (const provider of providers) assertProvider(provider);
  return providers;
}

export const LLM_PROVIDERS = loadProviderCatalog();

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

export function publicLlmProviders() {
  return LLM_PROVIDERS.map(cloneProvider);
}

export function providerById(providerId) {
  const normalized = String(providerId || '').trim();
  const provider = LLM_PROVIDERS.find(candidate => candidate.provider_id === normalized);
  return provider ? cloneProvider(provider) : null;
}

export function resolveProviderRuntime({
  provider_id = 'openrouter',
  model = '',
  base_url = '',
  env = process.env
} = {}) {
  const provider = LLM_PROVIDERS.find(candidate => candidate.provider_id === String(provider_id || '').trim());
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

export function providerCredentialReadiness({ env = process.env } = {}) {
  const providers = LLM_PROVIDERS.map(provider => {
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
