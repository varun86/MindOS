/**
 * Client-side mirror of "can an agent turn run?" using GET /api/settings payload.
 * Must stay aligned with server `effectiveAiConfig()` provider + key resolution.
 */
import { PROVIDER_PRESETS, isProviderId, getApiKeyEnvVar } from './agent/providers';
import { type Provider } from './custom-endpoints';
import type { ProviderId } from './agent/providers';

export type SettingsJsonForAi = {
  ai?: {
    activeProvider?: string;
    providers?: Provider[];
  };
  envOverrides?: Partial<Record<string, boolean>>;
  envValues?: Partial<Record<string, string>>;
};

function providerFromProtocol(protocol: ProviderId): Provider {
  const preset = PROVIDER_PRESETS[protocol];
  return {
    id: protocol,
    name: preset.name,
    protocol,
    apiKey: '',
    model: preset.defaultModel,
    baseUrl: preset.fixedBaseUrl ?? '',
  };
}

export function isAiConfiguredForAgentTurn(data: SettingsJsonForAi, providerOverride?: string | null): boolean {
  const providers = data.ai?.providers ?? [];
  const activeId = data.ai?.activeProvider;
  const env = data.envOverrides ?? {};
  const envProvider = data.envValues?.AI_PROVIDER;

  const targetId = providerOverride || activeId;
  let current = targetId
    ? providers.find(p => p.id === targetId || p.protocol === targetId)
    : providers[0];

  if (!current && targetId && isProviderId(targetId)) {
    current = providerFromProtocol(targetId);
  }

  if (!current && envProvider && isProviderId(envProvider)) {
    current = providerFromProtocol(envProvider);
  }

  if (!current) {
    current = providerFromProtocol('anthropic');
  }
  if (!current) return false;

  // Has API key directly
  if (current.apiKey && current.apiKey.length > 0) return true;

  // Has env var override
  const envVar = isProviderId(current.protocol) ? getApiKeyEnvVar(current.protocol) : undefined;
  if (envVar && env[envVar]) return true;

  // Has fallback key (e.g. Ollama)
  const preset = isProviderId(current.protocol) ? PROVIDER_PRESETS[current.protocol] : undefined;
  if (preset?.apiKeyFallback) return true;

  return false;
}
