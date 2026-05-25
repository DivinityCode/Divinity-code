export const PROVIDER_TRANSPORTS = [
  'chat_completions',
  'anthropic_messages',
  'codex_responses'
];

export const LLM_PROVIDERS = [
  {
    provider_id: 'openrouter',
    display_name: 'OpenRouter',
    transport: 'chat_completions',
    base_url: 'https://openrouter.ai/api/v1',
    auth_modes: ['api_key'],
    credential_env_vars: ['OPENROUTER_API_KEY'],
    supports_custom_base_url: true,
    default_model: 'openai/gpt-4o-mini',
    capabilities: ['chat', 'tool_calls', 'model_catalog', 'aggregator'],
    source: 'hermes_runtime_provider_reference'
  },
  {
    provider_id: 'anthropic',
    display_name: 'Anthropic',
    transport: 'anthropic_messages',
    base_url: 'https://api.anthropic.com',
    auth_modes: ['api_key', 'oauth_token'],
    credential_env_vars: ['ANTHROPIC_API_KEY', 'ANTHROPIC_TOKEN', 'CLAUDE_CODE_OAUTH_TOKEN'],
    supports_custom_base_url: true,
    default_model: 'claude-sonnet-4.5',
    capabilities: ['chat', 'tool_calls', 'prompt_cache'],
    source: 'hermes_runtime_provider_reference'
  },
  {
    provider_id: 'openai_api',
    display_name: 'OpenAI API',
    transport: 'codex_responses',
    base_url: 'https://api.openai.com/v1',
    auth_modes: ['api_key'],
    credential_env_vars: ['OPENAI_API_KEY'],
    supports_custom_base_url: true,
    default_model: 'gpt-5.1',
    capabilities: ['chat', 'tool_calls', 'responses_api'],
    source: 'hermes_runtime_provider_reference'
  },
  {
    provider_id: 'google_gemini',
    display_name: 'Google Gemini',
    transport: 'chat_completions',
    base_url: 'https://generativelanguage.googleapis.com/v1beta/openai',
    auth_modes: ['api_key'],
    credential_env_vars: ['GOOGLE_API_KEY', 'GEMINI_API_KEY'],
    supports_custom_base_url: false,
    default_model: 'google/gemini-2.5-flash',
    capabilities: ['chat', 'tool_calls', 'vision'],
    source: 'hermes_runtime_provider_reference'
  },
  {
    provider_id: 'custom_openai_compatible',
    display_name: 'Custom OpenAI-Compatible Endpoint',
    transport: 'chat_completions',
    base_url: '',
    auth_modes: ['api_key', 'none'],
    credential_env_vars: ['CUSTOM_LLM_API_KEY'],
    supports_custom_base_url: true,
    default_model: '',
    capabilities: ['chat', 'tool_calls', 'local_endpoint'],
    source: 'user_config'
  }
];

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
  const noKeyLocal = provider.provider_id === 'custom_openai_compatible' && isLocalBaseUrl(resolvedBaseUrl);
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
    const credentialRequired = provider.provider_id !== 'custom_openai_compatible';
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
