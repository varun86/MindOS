import { describe, expect, it } from 'vitest';
import { restoreAiSettingsFromEnvironment } from '@/components/settings/ai-env-restore';

describe('restoreAiSettingsFromEnvironment', () => {
  it('keeps provider entries editable while clearing env-backed API keys', () => {
    const restored = restoreAiSettingsFromEnvironment({
      ai: {
        activeProvider: 'p_openai01',
        providers: [
          {
            id: 'p_openai01',
            name: 'OpenAI',
            protocol: 'openai',
            apiKey: 'sk-manual',
            model: 'gpt-5.4',
            baseUrl: 'https://proxy.example/v1',
          },
          {
            id: 'p_anthropic01',
            name: 'Anthropic',
            protocol: 'anthropic',
            apiKey: 'sk-ant-manual',
            model: 'claude-sonnet-4-6',
            baseUrl: '',
          },
        ],
      },
      envOverrides: {
        AI_PROVIDER: true,
        OPENAI_API_KEY: true,
      },
      envValues: {
        AI_PROVIDER: 'openai',
      },
    });

    expect(restored.activeProvider).toBe('p_openai01');
    expect(restored.providers).toHaveLength(2);
    expect(restored.providers[0]).toEqual({
      id: 'p_openai01',
      name: 'OpenAI',
      protocol: 'openai',
      apiKey: '',
      model: 'gpt-5.4',
      baseUrl: 'https://proxy.example/v1',
    });
    expect(restored.providers[1]?.apiKey).toBe('sk-ant-manual');
  });

  it('switches to the provider selected by AI_PROVIDER when present', () => {
    const restored = restoreAiSettingsFromEnvironment({
      ai: {
        activeProvider: 'p_openai01',
        providers: [
          { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          { id: 'p_anthropic01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
        ],
      },
      envOverrides: { AI_PROVIDER: true, ANTHROPIC_API_KEY: true },
      envValues: { AI_PROVIDER: 'anthropic' },
    });

    expect(restored.activeProvider).toBe('p_anthropic01');
    expect(restored.providers.find(provider => provider.id === 'p_anthropic01')?.apiKey).toBe('');
  });
});
