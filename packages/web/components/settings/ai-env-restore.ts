import { getApiKeyEnvVar, isProviderId } from '@/lib/agent/providers';
import type { AiSettings, SettingsData } from './types';

/**
 * Restore only fields that actually have environment fallbacks.
 * Provider entries stay in place so Settings remains editable after restore.
 */
export function restoreAiSettingsFromEnvironment(data: Pick<SettingsData, 'ai' | 'envOverrides' | 'envValues'>): AiSettings {
  const envOverrides = data.envOverrides ?? {};
  const envProvider = data.envValues?.AI_PROVIDER;
  const targetProtocol = envProvider && isProviderId(envProvider) ? envProvider : undefined;
  const targetProvider = targetProtocol
    ? data.ai.providers.find(provider => provider.protocol === targetProtocol)
    : undefined;

  return {
    activeProvider: targetProvider?.id ?? data.ai.activeProvider,
    providers: data.ai.providers.map(provider => {
      const apiKeyEnv = getApiKeyEnvVar(provider.protocol);
      if (!apiKeyEnv || !envOverrides[apiKeyEnv]) return provider;
      return { ...provider, apiKey: '' };
    }),
  };
}
