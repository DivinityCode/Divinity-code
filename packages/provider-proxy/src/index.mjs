import { resolveProviderRuntime } from '../../provider-runtime/src/index.mjs';

export const PROVIDER_PROXY_POLICY = {
  allow_public_shared_keys: false,
  allow_limit_bypass: false,
  rotation_mode: 'authorized_failover'
};

function normalizedCandidate(candidate) {
  if (typeof candidate === 'string') {
    return {
      provider_id: candidate.trim(),
      source: 'catalog'
    };
  }

  return {
    provider_id: String(candidate?.provider_id || '').trim(),
    source: String(candidate?.source || 'catalog').trim() || 'catalog',
    model: String(candidate?.model || '').trim(),
    base_url: String(candidate?.base_url || '').trim()
  };
}

function normalizedCandidates(candidates) {
  const source = Array.isArray(candidates) && candidates.length > 0
    ? candidates
    : ['openrouter'];
  return source.map(normalizedCandidate).filter(candidate => candidate.provider_id);
}

function limitStateFor(limitState, providerId) {
  const state = limitState?.[providerId] || {};
  const retryAfterSeconds = Number(state.retry_after_seconds || 0);
  return {
    limit_reached: Boolean(state.limit_reached),
    retry_after_seconds: Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0
      ? retryAfterSeconds
      : 0
  };
}

function blockedRoute(base, error) {
  return {
    ...base,
    status: 'blocked',
    error
  };
}

function isBypassIntent(value) {
  return /bypass|evade|circumvent/i.test(String(value || ''));
}

function isPublicSharedKeySource(value) {
  return /public.*shared.*key|shared.*public.*key|shared_key/i.test(String(value || ''));
}

function publicCandidateResult({ candidate, runtime, limitState }) {
  return {
    provider_id: candidate.provider_id,
    source: candidate.source,
    status: limitState.limit_reached ? 'limited' : 'ready',
    credential_required: runtime.auth.credential_required,
    credential_configured: runtime.auth.credential_configured,
    credential_env_vars: [...runtime.auth.credential_env_vars],
    configured_env_vars: [...runtime.auth.configured_env_vars],
    limit_reached: limitState.limit_reached,
    retry_after_seconds: limitState.retry_after_seconds
  };
}

export function planProviderProxyRoute({
  candidates = ['openrouter'],
  env = process.env,
  limit_state = {},
  rotation_intent = 'reliability',
  requested_model = ''
} = {}) {
  const candidateList = normalizedCandidates(candidates);
  const base = {
    format: 'divinity.provider_proxy_route.v1',
    status: 'blocked',
    policy: { ...PROVIDER_PROXY_POLICY },
    rotation_intent: String(rotation_intent || 'reliability').trim() || 'reliability',
    candidate_results: []
  };

  if (isBypassIntent(base.rotation_intent)) {
    return blockedRoute(base, 'limit bypass is not allowed');
  }

  if (candidateList.some(candidate => isPublicSharedKeySource(candidate.source))) {
    return blockedRoute(base, 'public shared keys are not allowed');
  }

  let sawLimitedProvider = false;
  let sawMissingCredentials = false;

  for (const candidate of candidateList) {
    let runtime;
    try {
      runtime = resolveProviderRuntime({
        provider_id: candidate.provider_id,
        model: candidate.model || requested_model,
        base_url: candidate.base_url,
        env
      });
    } catch (error) {
      base.candidate_results.push({
        provider_id: candidate.provider_id,
        source: candidate.source,
        status: 'blocked',
        error: error.message
      });
      continue;
    }

    if (!runtime.auth.credential_configured) {
      sawMissingCredentials = true;
      base.candidate_results.push({
        provider_id: candidate.provider_id,
        source: candidate.source,
        status: 'missing_credentials',
        credential_required: runtime.auth.credential_required,
        credential_configured: false,
        credential_env_vars: [...runtime.auth.credential_env_vars],
        configured_env_vars: [],
        limit_reached: false,
        retry_after_seconds: 0
      });
      continue;
    }

    const limitState = limitStateFor(limit_state, candidate.provider_id);
    if (limitState.limit_reached) {
      sawLimitedProvider = true;
      base.candidate_results.push(publicCandidateResult({ candidate, runtime, limitState }));
      continue;
    }

    base.candidate_results.push(publicCandidateResult({ candidate, runtime, limitState }));

    return {
      ...base,
      status: 'ready',
      selected_provider_runtime: runtime,
      rotation_reason: sawLimitedProvider ? 'provider_limit_reached' : 'primary_ready'
    };
  }

  if (sawMissingCredentials) {
    return blockedRoute(base, 'no authorized provider with configured credentials is available');
  }

  return blockedRoute(base, 'no authorized provider is available');
}
