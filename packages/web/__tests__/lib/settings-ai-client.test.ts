import { describe, expect, it } from 'vitest';
import { isAiConfiguredForAgentTurn } from '@/lib/settings-ai-client';

describe('isAiConfiguredForAgentTurn', () => {
  it('returns true when anthropic file key is set', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: 'sk-ant-test', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    ).toBe(true);
  });

  it('returns true when anthropic env override only', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: { ANTHROPIC_API_KEY: true },
      }),
    ).toBe(true);
  });

  it('returns false when anthropic selected but no key anywhere', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    ).toBe(false);
  });

  it('uses provider override instead of the active provider when provided', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }, 'p_openai01'),
    ).toBe(true);
  });

  it('returns true when openai provider and openai key set', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_openai01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    ).toBe(true);
  });

  it('returns true for openai env only', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          activeProvider: 'p_openai01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: { OPENAI_API_KEY: true },
      }),
    ).toBe(true);
  });

  it('treats missing provider as first entry fallback (error path)', () => {
    expect(
      isAiConfiguredForAgentTurn({
        ai: {
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    ).toBe(false);
  });
});
