import http from 'http';
import https from 'https';

import { resolveProviderRuntime } from '../../provider-runtime/src/index.mjs';
import { resolveToolsets } from '../../toolsets/src/index.mjs';
import {
  createConfiguredProviderLimitLedger,
  createProviderLimitLedger
} from './limit-ledger.mjs';

export {
  createConfiguredProviderLimitLedger,
  createProviderLimitLedger
};

export const PROVIDER_PROXY_POLICY = {
  allow_public_shared_keys: false,
  allow_limit_bypass: false,
  rotation_mode: 'authorized_failover'
};

const CHAT_RESULT_FORMAT = 'divinity.provider_proxy_chat_result.v1';
const STREAM_RESULT_FORMAT = 'divinity.provider_proxy_stream_result.v1';

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
      : 0,
    limited_until: String(state.limited_until || '').trim(),
    source: String(state.source || '').trim()
  };
}

function mergeLimitStates(...states) {
  const merged = {};
  for (const state of states) {
    if (!state || typeof state !== 'object') continue;
    for (const providerId of Object.keys(state)) {
      const cleanProviderId = String(providerId || '').trim();
      if (!cleanProviderId) continue;
      const next = limitStateFor(state, providerId);
      if (!next.limit_reached) continue;
      const existing = limitStateFor(merged, cleanProviderId);
      if (!existing.limit_reached || next.retry_after_seconds >= existing.retry_after_seconds) {
        merged[cleanProviderId] = {
          limit_reached: true,
          retry_after_seconds: next.retry_after_seconds,
          limited_until: next.limited_until,
          source: next.source
        };
      }
    }
  }
  return merged;
}

function activeLimitStateFromLedger(limitLedger) {
  if (!limitLedger || typeof limitLedger.activeLimitState !== 'function') return {};
  return limitLedger.activeLimitState();
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
  const result = {
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
  if (limitState.limited_until) result.limited_until = limitState.limited_until;
  if (limitState.source) result.limit_source = limitState.source;
  return result;
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

function resultBase(route, toolsetResolution = null, format = CHAT_RESULT_FORMAT) {
  const base = {
    format,
    route
  };
  if (toolsetResolution) base.toolset_resolution = toolsetResolution;
  return base;
}

function blockedChat(route, error, toolsetResolution = null, format = CHAT_RESULT_FORMAT) {
  return {
    ...resultBase(route, toolsetResolution, format),
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

function joinEndpoint(baseUrl, path) {
  return `${String(baseUrl || '').replace(/\/$/, '')}${path}`;
}

function textFromContent(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map(part => {
      if (typeof part === 'string') return part;
      if (typeof part?.text === 'string') return part.text;
      return '';
    })
    .filter(Boolean)
    .join('');
}

function parseJsonObject(value) {
  if (value && typeof value === 'object' && !Array.isArray(value)) return value;
  if (typeof value !== 'string') return {};

  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function argumentKeysFrom(value) {
  return Object.keys(parseJsonObject(value)).sort();
}

function toolCallRequest({ runtime, toolCallId, name, argumentSource }) {
  return {
    format: 'divinity.provider_tool_call_request.v1',
    tool_call_id: String(toolCallId || '').trim(),
    provider_id: runtime.provider_id,
    transport: runtime.transport,
    name: String(name || '').trim(),
    argument_keys: argumentKeysFrom(argumentSource),
    arguments_redacted: true,
    status: 'requires_operator_approval'
  };
}

function toolCallReviewControl(toolCallRequests) {
  return {
    control_id: 'tool_call_review',
    status: 'required',
    reason: 'provider returned tool call requests; execution is not automatic',
    tool_call_ids: toolCallRequests.map(item => item.tool_call_id).filter(Boolean),
    tools: [...new Set(toolCallRequests.map(item => item.name).filter(Boolean))].sort()
  };
}

function withToolCallGovernance(result, toolCallRequests) {
  if (toolCallRequests.length === 0) return result;
  return {
    ...result,
    status: 'requires_action',
    tool_call_requests: toolCallRequests,
    operator_controls: [toolCallReviewControl(toolCallRequests)]
  };
}

function redactedChatMessage(message) {
  if (!message) return null;
  const safeMessage = {
    role: message.role || 'assistant',
    content: message.content ?? null
  };
  const toolCalls = Array.isArray(message.tool_calls) ? message.tool_calls : [];
  if (toolCalls.length > 0) {
    safeMessage.tool_calls = toolCalls.map(call => ({
      id: String(call?.id || '').trim(),
      type: String(call?.type || 'function').trim() || 'function',
      function: {
        name: String(call?.function?.name || '').trim(),
        argument_keys: argumentKeysFrom(call?.function?.arguments),
        arguments_redacted: true
      }
    }));
  }
  return safeMessage;
}

function redactedAnthropicContent(content) {
  if (!Array.isArray(content)) return [];
  return content.map(part => {
    if (part?.type !== 'tool_use') return part;
    return {
      type: 'tool_use',
      id: String(part.id || '').trim(),
      name: String(part.name || '').trim(),
      input_keys: argumentKeysFrom(part.input),
      input_redacted: true
    };
  });
}

function systemPrompt(messages) {
  return messages
    .filter(message => message?.role === 'system')
    .map(message => textFromContent(message.content))
    .filter(Boolean)
    .join('\n\n');
}

function nonSystemMessages(messages) {
  return messages
    .filter(message => message?.role !== 'system')
    .map(message => ({
      role: String(message?.role || 'user'),
      content: message?.content
    }));
}

function resolveCredential(runtime, env) {
  if (!runtime.auth.credential_required) return '';
  const credentialName = runtime.auth.configured_env_vars[0];
  return String(env[credentialName] || '').trim();
}

function normalizedToolsetSelection({ toolsets = null, enabled_toolsets = null, disabled_toolsets = [] } = {}) {
  const source = toolsets && typeof toolsets === 'object' ? toolsets : {};
  return {
    enabled_toolsets: Array.isArray(enabled_toolsets)
      ? enabled_toolsets
      : Array.isArray(source.enabled)
        ? source.enabled
        : null,
    disabled_toolsets: Array.isArray(disabled_toolsets)
      ? disabled_toolsets
      : Array.isArray(source.disabled)
        ? source.disabled
        : []
  };
}

function missingProviderCapabilityChecks(toolsetResolution) {
  return toolsetResolution.provider_capability_checks.filter(check => check.status === 'missing');
}

function missingProviderCapabilityError(missingChecks) {
  const capabilities = [...new Set(missingChecks.map(check => check.capability))].sort();
  return `provider missing required tool capability: ${capabilities.join(', ')}`;
}

function transportHeaders(runtime, credential) {
  const headers = {
    'content-type': 'application/json',
    connection: 'close'
  };

  if (runtime.transport === 'anthropic_messages') {
    headers['anthropic-version'] = '2023-06-01';
    if (credential) headers['x-api-key'] = credential;
    return headers;
  }

  if (credential) headers.authorization = `Bearer ${credential}`;
  return headers;
}

function anthropicEndpoint(runtime) {
  const baseUrl = String(runtime.base_url || '').replace(/\/$/, '');
  return joinEndpoint(baseUrl, baseUrl.endsWith('/v1') ? '/messages' : '/v1/messages');
}

function buildTransportRequest({ runtime, requestedModel, messages, outputTokens, temperature, stream = false }) {
  const model = String(requestedModel || runtime.model || '').trim();
  const numericTemperature = Number(temperature);

  if (runtime.transport === 'chat_completions') {
    const body = { model, messages };
    if (outputTokens) body.max_completion_tokens = outputTokens;
    if (Number.isFinite(numericTemperature)) body.temperature = numericTemperature;
    if (stream) body.stream = true;
    return {
      endpoint: joinEndpoint(runtime.base_url, '/chat/completions'),
      body,
      model
    };
  }

  if (runtime.transport === 'anthropic_messages') {
    const body = {
      model,
      messages: nonSystemMessages(messages),
      max_tokens: outputTokens || 1024
    };
    const system = systemPrompt(messages);
    if (system) body.system = system;
    if (Number.isFinite(numericTemperature)) body.temperature = numericTemperature;
    if (stream) body.stream = true;
    return {
      endpoint: anthropicEndpoint(runtime),
      body,
      model
    };
  }

  if (runtime.transport === 'codex_responses') {
    const body = {
      model,
      input: nonSystemMessages(messages)
    };
    const instructions = systemPrompt(messages);
    if (instructions) body.instructions = instructions;
    if (outputTokens) body.max_output_tokens = outputTokens;
    if (Number.isFinite(numericTemperature)) body.temperature = numericTemperature;
    if (stream) body.stream = true;
    return {
      endpoint: joinEndpoint(runtime.base_url, '/responses'),
      body,
      model
    };
  }

  throw new Error(`unsupported transport for provider proxy chat execution: ${runtime.transport}`);
}

function normalizeTransportResult({ runtime, payload, response, model, route, toolsetResolution }) {
  if (runtime.transport === 'chat_completions') {
    const choice = Array.isArray(payload.choices) ? payload.choices[0] : {};
    const rawMessage = choice?.message || null;
    const toolCalls = Array.isArray(rawMessage?.tool_calls) ? rawMessage.tool_calls : [];
    const toolCallRequests = toolCalls.map(call => toolCallRequest({
      runtime,
      toolCallId: call?.id,
      name: call?.function?.name,
      argumentSource: call?.function?.arguments
    }));
    const message = redactedChatMessage(rawMessage);
    return withToolCallGovernance({
      ...resultBase(route, toolsetResolution),
      status: 'completed',
      provider_id: runtime.provider_id,
      model: payload.model || model,
      transport: runtime.transport,
      upstream_status: response.status,
      response_id: payload.id || '',
      message,
      output_text: textFromContent(message?.content),
      finish_reason: choice?.finish_reason || '',
      usage: payload.usage || null
    }, toolCallRequests);
  }

  if (runtime.transport === 'anthropic_messages') {
    const content = Array.isArray(payload.content) ? payload.content : [];
    const toolCallRequests = content
      .filter(part => part?.type === 'tool_use')
      .map(part => toolCallRequest({
        runtime,
        toolCallId: part.id,
        name: part.name,
        argumentSource: part.input
      }));
    const message = {
      role: payload.role || 'assistant',
      content: redactedAnthropicContent(content)
    };
    return withToolCallGovernance({
      ...resultBase(route, toolsetResolution),
      status: 'completed',
      provider_id: runtime.provider_id,
      model: payload.model || model,
      transport: runtime.transport,
      upstream_status: response.status,
      response_id: payload.id || '',
      message,
      output_text: textFromContent(message.content),
      finish_reason: payload.stop_reason || '',
      usage: payload.usage || null
    }, toolCallRequests);
  }

  if (runtime.transport === 'codex_responses') {
    const output = Array.isArray(payload.output) ? payload.output : [];
    const functionCalls = output.filter(item => item?.type === 'function_call');
    const toolCallRequests = functionCalls.map(item => toolCallRequest({
      runtime,
      toolCallId: item.call_id || item.id,
      name: item.name,
      argumentSource: item.arguments
    }));
    const outputMessage = output.find(item => item?.type === 'message') || {};
    const message = {
      role: outputMessage.role || 'assistant',
      content: Array.isArray(outputMessage.content) ? outputMessage.content : []
    };
    return withToolCallGovernance({
      ...resultBase(route, toolsetResolution),
      status: 'completed',
      provider_id: runtime.provider_id,
      model: payload.model || model,
      transport: runtime.transport,
      upstream_status: response.status,
      response_id: payload.id || '',
      message,
      output_text: textFromContent(message.content),
      finish_reason: payload.status || outputMessage.status || '',
      usage: payload.usage || null
    }, toolCallRequests);
  }

  throw new Error(`unsupported transport for provider proxy chat execution: ${runtime.transport}`);
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

function parseSseRecord(record) {
  let event = 'message';
  const dataLines = [];

  for (const rawLine of String(record || '').split(/\r?\n/)) {
    if (!rawLine || rawLine.startsWith(':')) continue;
    const separatorIndex = rawLine.indexOf(':');
    const field = separatorIndex === -1 ? rawLine : rawLine.slice(0, separatorIndex);
    let value = separatorIndex === -1 ? '' : rawLine.slice(separatorIndex + 1);
    if (value.startsWith(' ')) value = value.slice(1);
    if (field === 'event') event = value || 'message';
    if (field === 'data') dataLines.push(value);
  }

  if (dataLines.length === 0) return null;
  const data = dataLines.join('\n');
  if (data.trim() === '[DONE]') {
    return { event, data, payload: null, done: true };
  }

  let payload = null;
  try {
    payload = JSON.parse(data);
  } catch {
    payload = null;
  }
  return { event, data, payload, done: false };
}

async function postSse(url, body, headers = {}, signal, onEvent = () => {}) {
  const parsedUrl = new URL(url);
  const client = parsedUrl.protocol === 'https:' ? https : http;
  const requestBody = JSON.stringify(body);
  const requestHeaders = {
    ...headers,
    'content-length': Buffer.byteLength(requestBody)
  };

  return await new Promise((resolve, reject) => {
    let settled = false;
    let req;

    const finishReject = error => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', abortRequest);
      reject(error);
      if (req) req.destroy();
    };

    const finishResolve = value => {
      if (settled) return;
      settled = true;
      if (signal) signal.removeEventListener('abort', abortRequest);
      resolve(value);
      if (req) req.destroy();
    };

    const abortRequest = () => finishReject(new Error('provider proxy request aborted'));

    req = client.request(parsedUrl, {
      method: 'POST',
      headers: requestHeaders,
      agent: false
    }, res => {
      const responseHeaders = {
        get: name => res.headers[String(name || '').toLowerCase()]
      };
      let rawBody = '';
      let buffer = '';
      const ok = res.statusCode >= 200 && res.statusCode < 300;

      res.setEncoding('utf8');
      res.on('data', chunk => {
        if (!ok) {
          rawBody += chunk;
          return;
        }

        buffer += chunk;
        let separatorMatch = buffer.match(/\r?\n\r?\n/);
        while (separatorMatch) {
          const record = buffer.slice(0, separatorMatch.index);
          buffer = buffer.slice(separatorMatch.index + separatorMatch[0].length);
          const event = parseSseRecord(record);
          if (event && !event.done) {
            try {
              onEvent(event);
            } catch (error) {
              finishReject(error);
              return;
            }
          }
          separatorMatch = buffer.match(/\r?\n\r?\n/);
        }
      });

      res.on('end', () => {
        if (settled) return;
        if (!ok) {
          let payload = {};
          try {
            payload = rawBody ? JSON.parse(rawBody) : {};
          } catch {
            payload = {};
          }
          finishResolve({ ok, status: res.statusCode, headers: responseHeaders, payload });
          return;
        }

        const remaining = buffer.trim();
        if (remaining) {
          const event = parseSseRecord(remaining);
          if (event && !event.done) {
            try {
              onEvent(event);
            } catch (error) {
              finishReject(error);
              return;
            }
          }
        }

        finishResolve({ ok, status: res.statusCode, headers: responseHeaders, payload: {} });
      });
    });

    req.on('error', finishReject);
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

function createStreamState(runtime, model) {
  return {
    provider_id: runtime.provider_id,
    transport: runtime.transport,
    model,
    responseId: '',
    finishReason: '',
    outputText: '',
    usage: null,
    streamEvents: [],
    eventCounts: {},
    toolCalls: new Map()
  };
}

function emitNormalizedStreamEvent(state, event, onEvent) {
  state.streamEvents.push(event);
  state.eventCounts[event.type] = (state.eventCounts[event.type] || 0) + 1;
  if (typeof onEvent === 'function') onEvent(event);
}

function mergeUsage(existing, next) {
  if (!next || typeof next !== 'object' || Array.isArray(next)) return existing;
  return { ...(existing || {}), ...next };
}

function trackedToolCall(state, key) {
  const cleanKey = String(key || '').trim() || `tool:${state.toolCalls.size}`;
  if (!state.toolCalls.has(cleanKey)) {
    state.toolCalls.set(cleanKey, {
      toolCallId: '',
      name: '',
      arguments: ''
    });
  }
  return state.toolCalls.get(cleanKey);
}

function applyToolCallMetadata(toolCall, { toolCallId = '', name = '', argumentSource = null } = {}) {
  const cleanToolCallId = String(toolCallId || '').trim();
  const cleanName = String(name || '').trim();
  if (cleanToolCallId) toolCall.toolCallId = cleanToolCallId;
  if (cleanName) toolCall.name = cleanName;
  if (typeof argumentSource === 'string') toolCall.arguments += argumentSource;
  if (argumentSource && typeof argumentSource === 'object' && !Array.isArray(argumentSource)) {
    const keys = Object.keys(argumentSource);
    if (keys.length > 0) toolCall.arguments += JSON.stringify(argumentSource);
  }
}

function emitTextDelta(state, text, onEvent) {
  const cleanText = String(text || '');
  if (!cleanText) return;
  state.outputText += cleanText;
  emitNormalizedStreamEvent(state, {
    type: 'text_delta',
    provider_id: state.provider_id,
    transport: state.transport,
    text: cleanText
  }, onEvent);
}

function emitToolCallDelta(state, toolCall, onEvent) {
  emitNormalizedStreamEvent(state, {
    type: 'tool_call_delta',
    provider_id: state.provider_id,
    transport: state.transport,
    tool_call_id: toolCall.toolCallId,
    name: toolCall.name,
    arguments_redacted: true
  }, onEvent);
}

function emitRedactedReasoningDelta(state, onEvent) {
  emitNormalizedStreamEvent(state, {
    type: 'redacted_reasoning_delta',
    provider_id: state.provider_id,
    transport: state.transport,
    redacted: true
  }, onEvent);
}

function normalizeChatCompletionStreamPayload({ runtime, payload, state, onEvent }) {
  if (payload?.id) state.responseId = payload.id;
  if (payload?.model) state.model = payload.model;
  state.usage = mergeUsage(state.usage, payload?.usage);

  const choices = Array.isArray(payload?.choices) ? payload.choices : [];
  for (const choice of choices) {
    if (choice?.finish_reason) state.finishReason = choice.finish_reason;
    const delta = choice?.delta || {};
    emitTextDelta(state, delta.content, onEvent);

    const toolCalls = Array.isArray(delta.tool_calls) ? delta.tool_calls : [];
    for (const call of toolCalls) {
      const key = `chat:${choice?.index || 0}:${call?.index || 0}`;
      const toolCall = trackedToolCall(state, key);
      applyToolCallMetadata(toolCall, {
        toolCallId: call?.id,
        name: call?.function?.name,
        argumentSource: call?.function?.arguments
      });
      emitToolCallDelta(state, toolCall, onEvent);
    }
  }
}

function normalizeAnthropicStreamPayload({ event, payload, state, onEvent }) {
  const type = payload?.type || event;

  if (type === 'message_start') {
    const message = payload?.message || {};
    if (message.id) state.responseId = message.id;
    if (message.model) state.model = message.model;
    if (message.stop_reason) state.finishReason = message.stop_reason;
    state.usage = mergeUsage(state.usage, message.usage);
    return;
  }

  if (type === 'message_delta') {
    if (payload?.delta?.stop_reason) state.finishReason = payload.delta.stop_reason;
    state.usage = mergeUsage(state.usage, payload?.usage);
    return;
  }

  if (type === 'content_block_start' && payload?.content_block?.type === 'tool_use') {
    const toolCall = trackedToolCall(state, `anthropic:${payload.index || 0}`);
    applyToolCallMetadata(toolCall, {
      toolCallId: payload.content_block.id,
      name: payload.content_block.name,
      argumentSource: payload.content_block.input
    });
    emitToolCallDelta(state, toolCall, onEvent);
    return;
  }

  if (type !== 'content_block_delta') return;

  const delta = payload?.delta || {};
  if (delta.type === 'text_delta') {
    emitTextDelta(state, delta.text, onEvent);
    return;
  }

  if (delta.type === 'input_json_delta') {
    const toolCall = trackedToolCall(state, `anthropic:${payload.index || 0}`);
    applyToolCallMetadata(toolCall, {
      argumentSource: delta.partial_json
    });
    emitToolCallDelta(state, toolCall, onEvent);
    return;
  }

  if (delta.type === 'thinking_delta' || delta.type === 'signature_delta') {
    emitRedactedReasoningDelta(state, onEvent);
  }
}

function normalizeResponsesStreamPayload({ event, payload, state, onEvent }) {
  const type = payload?.type || event;
  const response = payload?.response || null;
  if (response) {
    if (response.id) state.responseId = response.id;
    if (response.model) state.model = response.model;
    if (response.status) state.finishReason = response.status;
    state.usage = mergeUsage(state.usage, response.usage);
  }

  if (type === 'response.output_text.delta') {
    emitTextDelta(state, payload?.delta, onEvent);
    return;
  }

  if (type === 'response.output_item.added' && payload?.item?.type === 'function_call') {
    const key = `responses:${payload.output_index || payload.item.id || payload.item.call_id || 0}`;
    const toolCall = trackedToolCall(state, key);
    applyToolCallMetadata(toolCall, {
      toolCallId: payload.item.call_id || payload.item.id,
      name: payload.item.name,
      argumentSource: payload.item.arguments
    });
    emitToolCallDelta(state, toolCall, onEvent);
    return;
  }

  if (type === 'response.function_call_arguments.delta') {
    const key = `responses:${payload.output_index || payload.item_id || 0}`;
    const toolCall = trackedToolCall(state, key);
    applyToolCallMetadata(toolCall, {
      argumentSource: payload.delta
    });
    emitToolCallDelta(state, toolCall, onEvent);
    return;
  }

  if (type === 'response.function_call_arguments.done' && payload?.item?.type === 'function_call') {
    const key = `responses:${payload.output_index || payload.item.id || payload.item.call_id || 0}`;
    const toolCall = trackedToolCall(state, key);
    toolCall.arguments = '';
    applyToolCallMetadata(toolCall, {
      toolCallId: payload.item.call_id || payload.item.id,
      name: payload.item.name,
      argumentSource: payload.item.arguments
    });
    emitToolCallDelta(state, toolCall, onEvent);
  }
}

function normalizeStreamPayload({ runtime, event, payload, state, onEvent }) {
  if (!payload || typeof payload !== 'object') return;

  if (runtime.transport === 'chat_completions') {
    normalizeChatCompletionStreamPayload({ runtime, payload, state, onEvent });
    return;
  }

  if (runtime.transport === 'anthropic_messages') {
    normalizeAnthropicStreamPayload({ event, payload, state, onEvent });
    return;
  }

  if (runtime.transport === 'codex_responses') {
    normalizeResponsesStreamPayload({ event, payload, state, onEvent });
  }
}

function streamToolCallRequests(runtime, state) {
  return [...state.toolCalls.values()]
    .filter(toolCall => toolCall.toolCallId || toolCall.name)
    .map(toolCall => toolCallRequest({
      runtime,
      toolCallId: toolCall.toolCallId,
      name: toolCall.name,
      argumentSource: toolCall.arguments
    }));
}

export function planProviderProxyRoute({
  candidates = ['openrouter'],
  env = process.env,
  limit_state = {},
  limit_ledger = null,
  rotation_intent = 'reliability',
  requested_model = ''
} = {}) {
  const candidateList = normalizedCandidates(candidates);
  const effectiveLimitState = mergeLimitStates(activeLimitStateFromLedger(limit_ledger), limit_state);
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

    const limitState = limitStateFor(effectiveLimitState, candidate.provider_id);
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

function prepareProviderProxyChat({
  candidates = ['openrouter'],
  env = process.env,
  limit_state = {},
  limit_ledger = null,
  rotation_intent = 'reliability',
  requested_model = '',
  messages = [],
  max_completion_tokens = 0,
  max_output_tokens = 0,
  request_budget = {},
  toolsets = null,
  enabled_toolsets = null,
  disabled_toolsets = [],
  temperature
} = {}, { stream = false, resultFormat = CHAT_RESULT_FORMAT } = {}) {
  const route = planProviderProxyRoute({
    candidates,
    env,
    limit_state,
    limit_ledger,
    rotation_intent,
    requested_model
  });

  if (route.status !== 'ready') {
    return {
      ok: false,
      result: blockedChat(route, route.error || 'provider route is not ready', null, resultFormat)
    };
  }

  if (!Array.isArray(messages) || messages.length === 0) {
    return {
      ok: false,
      result: blockedChat(route, 'messages must be a non-empty array', null, resultFormat)
    };
  }

  const runtime = route.selected_provider_runtime;
  if (unsafeCredentialedEndpointOverride(runtime)) {
    return {
      ok: false,
      result: blockedChat(route, 'credentialed provider base_url overrides are not allowed for chat execution', null, resultFormat)
    };
  }

  let toolsetResolution;
  try {
    const toolsetSelection = normalizedToolsetSelection({ toolsets, enabled_toolsets, disabled_toolsets });
    toolsetResolution = resolveToolsets({
      enabled_toolsets: toolsetSelection.enabled_toolsets,
      disabled_toolsets: toolsetSelection.disabled_toolsets,
      provider_runtime: runtime
    });
  } catch (error) {
    return {
      ok: false,
      result: blockedChat(route, error.message, null, resultFormat)
    };
  }

  const missingChecks = missingProviderCapabilityChecks(toolsetResolution);
  if (missingChecks.length > 0) {
    return {
      ok: false,
      result: blockedChat(route, missingProviderCapabilityError(missingChecks), toolsetResolution, resultFormat)
    };
  }

  const maxPromptChars = positiveInteger(request_budget.max_prompt_chars);
  if (maxPromptChars && promptCharacterCount(messages) > maxPromptChars) {
    return {
      ok: false,
      result: blockedChat(route, 'prompt budget exceeded', toolsetResolution, resultFormat)
    };
  }

  const requestedOutputTokens = positiveInteger(max_output_tokens) || positiveInteger(max_completion_tokens);
  const budgetOutputTokens = positiveInteger(request_budget.max_output_tokens) || positiveInteger(request_budget.max_completion_tokens);
  if (budgetOutputTokens && requestedOutputTokens > budgetOutputTokens) {
    return {
      ok: false,
      result: blockedChat(route, 'completion token budget exceeded', toolsetResolution, resultFormat)
    };
  }

  const credential = resolveCredential(runtime, env);
  if (runtime.auth.credential_required && !credential) {
    return {
      ok: false,
      result: blockedChat(route, 'configured credential is not available', toolsetResolution, resultFormat)
    };
  }

  let request;
  try {
    request = buildTransportRequest({
      runtime,
      requestedModel: requested_model,
      messages,
      outputTokens: requestedOutputTokens || budgetOutputTokens || 0,
      temperature,
      stream
    });
  } catch (error) {
    return {
      ok: false,
      result: blockedChat(route, error.message, toolsetResolution, resultFormat)
    };
  }

  return {
    ok: true,
    route,
    runtime,
    toolsetResolution,
    credential,
    request
  };
}

export async function executeProviderProxyChat(options = {}) {
  const {
    limit_ledger = null,
    signal
  } = options;
  const prepared = prepareProviderProxyChat(options);
  if (!prepared.ok) return prepared.result;

  const {
    route,
    runtime,
    toolsetResolution,
    credential,
    request
  } = prepared;

  let response;
  let payload;
  try {
    response = await postJson(request.endpoint, request.body, transportHeaders(runtime, credential), signal);
    payload = response.payload;
  } catch (error) {
    return {
      ...resultBase(route, toolsetResolution),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      error: error.message
    };
  }

  if (response.status === 429) {
    const retryAfter = retryAfterSeconds(response.headers);
    const limitLedgerRecord = limit_ledger && typeof limit_ledger.recordLimit === 'function'
      ? limit_ledger.recordLimit({
        provider_id: runtime.provider_id,
        retry_after_seconds: retryAfter
      })
      : null;
    const result = {
      ...resultBase(route, toolsetResolution),
      status: 'limited',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      upstream_status: response.status,
      retry_after_seconds: retryAfter,
      error: upstreamErrorStatus(response.status)
    };
    if (limitLedgerRecord) result.limit_ledger_record = limitLedgerRecord;
    return result;
  }

  if (!response.ok) {
    return {
      ...resultBase(route, toolsetResolution),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      upstream_status: response.status,
      error: upstreamErrorStatus(response.status)
    };
  }

  return normalizeTransportResult({ runtime, payload, response, model: request.model, route, toolsetResolution });
}

export async function executeProviderProxyChatStream(options = {}) {
  const {
    limit_ledger = null,
    signal,
    on_event = null
  } = options;
  const prepared = prepareProviderProxyChat(options, {
    stream: true,
    resultFormat: STREAM_RESULT_FORMAT
  });
  if (!prepared.ok) return prepared.result;

  const {
    route,
    runtime,
    toolsetResolution,
    credential,
    request
  } = prepared;
  const state = createStreamState(runtime, request.model);

  let response;
  try {
    response = await postSse(
      request.endpoint,
      request.body,
      transportHeaders(runtime, credential),
      signal,
      streamEvent => normalizeStreamPayload({
        runtime,
        event: streamEvent.event,
        payload: streamEvent.payload,
        state,
        onEvent: on_event
      })
    );
  } catch (error) {
    return {
      ...resultBase(route, toolsetResolution, STREAM_RESULT_FORMAT),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      error: error.message
    };
  }

  if (response.status === 429) {
    const retryAfter = retryAfterSeconds(response.headers);
    const limitLedgerRecord = limit_ledger && typeof limit_ledger.recordLimit === 'function'
      ? limit_ledger.recordLimit({
        provider_id: runtime.provider_id,
        retry_after_seconds: retryAfter
      })
      : null;
    const result = {
      ...resultBase(route, toolsetResolution, STREAM_RESULT_FORMAT),
      status: 'limited',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      upstream_status: response.status,
      retry_after_seconds: retryAfter,
      error: upstreamErrorStatus(response.status)
    };
    if (limitLedgerRecord) result.limit_ledger_record = limitLedgerRecord;
    return result;
  }

  if (!response.ok) {
    return {
      ...resultBase(route, toolsetResolution, STREAM_RESULT_FORMAT),
      status: 'failed',
      provider_id: runtime.provider_id,
      model: request.model,
      transport: runtime.transport,
      upstream_status: response.status,
      error: upstreamErrorStatus(response.status)
    };
  }

  const toolCallRequests = streamToolCallRequests(runtime, state);
  return withToolCallGovernance({
    ...resultBase(route, toolsetResolution, STREAM_RESULT_FORMAT),
    status: 'completed',
    provider_id: runtime.provider_id,
    model: state.model || request.model,
    transport: runtime.transport,
    upstream_status: response.status,
    response_id: state.responseId,
    output_text: state.outputText,
    finish_reason: state.finishReason,
    usage: state.usage,
    stream_events: state.streamEvents,
    event_counts: state.eventCounts
  }, toolCallRequests);
}
