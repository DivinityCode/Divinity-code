import http from 'http';
import https from 'https';

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

function promptCharacterCount(messages) {
  return messages.reduce((total, message) => {
    const content = message?.content;
    if (typeof content === 'string') return total + content.length;
    if (Array.isArray(content)) return total + JSON.stringify(content).length;
    return total + String(content || '').length;
  }, 0);
}

function positiveInteger(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function retryAfterSeconds(headers) {
  const value = headers.get('retry-after');
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function resultBase(route) {
  return {
    format: 'divinity.provider_proxy_chat_result.v1',
    route
  };
}

function blockedChat(route, error) {
  return {
    ...resultBase(route),
    status: 'blocked',
    error
  };
}

function upstreamErrorStatus(status) {
  return status === 429 ? 'provider rate limited' : `upstream request failed with status ${status}`;
}

function unsafeCredentialedEndpointOverride(runtime) {
  return runtime.source === 'explicit' && runtime.auth.credential_required;
}

async function postJson(url, body, headers = {}, signal) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;
  const requestBody = JSON.stringify(body);
  const requestHeaders = {
    ...headers,
    'content-length': Buffer.byteLength(requestBody)
  };

  return await new Promise((resolve, reject) => {
    const req = client.request(parsedUrl, {
      method: 'POST',
      headers: requestHeaders,
      agent: false
    }, res => {
      let rawBody = '';
      res.setEncoding('utf8');
      res.on('data', chunk => rawBody += chunk);
      res.on('end', () => {
        let payload = {};
        try {
          payload = rawBody ? JSON.parse(rawBody) : {};
        } catch {
          payload = {};
        }
        if (signal) signal.removeEventListener('abort', abortRequest);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          headers: {
            get: name => res.headers[String(name || '').toLowerCase()]
          },
          payload
        });
        res.destroy();
        req.destroy();
      });
    });

    req.on('error', reject);
    const abortRequest = () => req.destroy(new Error('provider proxy request aborted'));
    if (signal) {
      if (signal.aborted) {
        abortRequest();
        return;
      }
      signal.addEventListener('abort', abortRequest, { once: true });
    }
    req.write(requestBody);
    req.end();
  });
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

export async function executeProviderProxyChat({
  candidates = ['openrouter'],
  env = process.env,
  limit_state = {},
  rotation_intent = 'reliability',
  requested_model = '',
  messages = [],
  max_completion_tokens = 0,
  request_budget = {},
  temperature,
  signal
} = {}) {
  const route = planProviderProxyRoute({
    candidates,
    env,
    limit_state,
    rotation_intent,
    requested_model
  });

  if (route.status !== 'ready') {
    return blockedChat(route, route.error || 'provider route is not ready');
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return blockedChat(route, 'messages must be a non-empty array');
  }

  const runtime = route.selected_provider_runtime;
  if (runtime.transport !== 'chat_completions') {
    return blockedChat(route, `unsupported transport for provider proxy chat execution: ${runtime.transport}`);
  }

  if (unsafeCredentialedEndpointOverride(runtime)) {
    return blockedChat(route, 'credentialed provider base_url overrides are not allowed for chat execution');
  }

  const maxPromptChars = positiveInteger(request_budget.max_prompt_chars);
  if (maxPromptChars && promptCharacterCount(messages) > maxPromptChars) {
    return blockedChat(route, 'prompt budget exceeded');
  }

  const requestedMaxCompletionTokens = positiveInteger(max_completion_tokens);
  const budgetMaxCompletionTokens = positiveInteger(request_budget.max_completion_tokens);
  if (budgetMaxCompletionTokens && requestedMaxCompletionTokens > budgetMaxCompletionTokens) {
    return blockedChat(route, 'completion token budget exceeded');
  }

  const resolvedMaxCompletionTokens = requestedMaxCompletionTokens || budgetMaxCompletionTokens || 0;
  const body = {
    model: String(requested_model || runtime.model || '').trim(),
    messages
  };
  if (resolvedMaxCompletionTokens) body.max_completion_tokens = resolvedMaxCompletionTokens;
  if (Number.isFinite(Number(temperature))) body.temperature = Number(temperature);

  const headers = {
    'content-type': 'application/json',
    connection: 'close'
  };
  if (runtime.auth.credential_required) {
    const credentialName = runtime.auth.configured_env_vars[0];
    const credential = String(env[credentialName] || '').trim();
    if (!credential) {
      return blockedChat(route, 'configured credential is not available');
    }
    headers.authorization = `Bearer ${credential}`;
  }

  const endpoint = `${runtime.base_url.replace(/\/$/, '')}/chat/completions`;
  let response;
  let payload;
  try {
    response = await postJson(endpoint, body, headers, signal);
    payload = response.payload;
  } catch (error) {
    return {
      ...resultBase(route),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: body.model,
      transport: runtime.transport,
      error: error.message
    };
  }

  if (response.status === 429) {
    return {
      ...resultBase(route),
      status: 'limited',
      provider_id: runtime.provider_id,
      model: body.model,
      transport: runtime.transport,
      upstream_status: response.status,
      retry_after_seconds: retryAfterSeconds(response.headers),
      error: upstreamErrorStatus(response.status)
    };
  }

  if (!response.ok) {
    return {
      ...resultBase(route),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: body.model,
      transport: runtime.transport,
      upstream_status: response.status,
      error: upstreamErrorStatus(response.status)
    };
  }

  const choice = Array.isArray(payload.choices) ? payload.choices[0] : {};
  return {
    ...resultBase(route),
    status: 'completed',
    provider_id: runtime.provider_id,
    model: payload.model || body.model,
    transport: runtime.transport,
    upstream_status: response.status,
    response_id: payload.id || '',
    message: choice?.message || null,
    finish_reason: choice?.finish_reason || '',
    usage: payload.usage || null
  };
}
