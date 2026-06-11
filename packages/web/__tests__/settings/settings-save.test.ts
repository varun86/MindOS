import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SettingsData } from '@/components/settings/types';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

import { buildSettingsSaveBody, saveSettingsDocument, saveSettingsPatch } from '@/components/settings/settings-save';

function makeSettings(): SettingsData {
  return {
    ai: {
      activeProvider: 'openai',
      providers: [{ id: 'openai', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' }],
    },
    agent: { maxSteps: 8 },
    embedding: { enabled: false, provider: 'local', baseUrl: '', apiKey: '', model: '' },
    embeddingStatus: { enabled: false, ready: false, building: false, docCount: 0 },
    webSearch: { provider: 'disabled', exaApiKey: '', perplexityApiKey: '', geminiApiKey: '' },
    mindRoot: '/tmp/mind',
    allowNetworkAccess: undefined,
    port: 4567,
    mcpPort: 8567,
    skillPaths: { enableAgentsDir: true, custom: ['/tmp/skills'] },
    connectionMode: { cli: true, mcp: false },
    envOverrides: { OPENAI_API_KEY: true },
    envValues: { OPENAI_API_KEY: 'sk-test' },
  };
}

describe('settings save helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('builds the parent-owned settings save body without child-owned runtime fields', () => {
    expect(buildSettingsSaveBody(makeSettings())).toEqual({
      ai: {
        activeProvider: 'openai',
        providers: [{ id: 'openai', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' }],
      },
      agent: { maxSteps: 8 },
      embedding: { enabled: false, provider: 'local', baseUrl: '', apiKey: '', model: '' },
      webSearch: { provider: 'disabled', exaApiKey: '', perplexityApiKey: '', geminiApiKey: '' },
      mindRoot: '/tmp/mind',
      webPassword: undefined,
      authToken: undefined,
      allowNetworkAccess: false,
    });
  });

  it('posts a complete settings document through the shared endpoint contract', async () => {
    mockApiFetch.mockResolvedValueOnce({});

    await saveSettingsDocument(makeSettings());

    expect(mockApiFetch).toHaveBeenCalledWith('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(buildSettingsSaveBody(makeSettings())),
    });
  });

  it('posts partial settings patches through the same endpoint contract', async () => {
    mockApiFetch.mockResolvedValueOnce({});

    await saveSettingsPatch({ mcpPort: 8781 });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mcpPort: 8781 }),
    });
  });
});
