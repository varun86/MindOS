import { describe, expect, it } from 'vitest';
import { resolveAskCompatMode } from '@/lib/agent/ask-compat';

describe('resolveAskCompatMode', () => {
  it('tries streaming first for agent runs against OpenAI-compatible custom base URLs', () => {
    expect(resolveAskCompatMode({
      askMode: 'agent',
      provider: 'openai',
      baseUrl: 'https://lumina.tripo3d.com/v1',
    })).toBeUndefined();
  });

  it('does not force non-streaming for normal chat on the same base URL', () => {
    expect(resolveAskCompatMode({
      askMode: 'chat',
      provider: 'openai',
      baseUrl: 'https://lumina.tripo3d.com/v1',
    })).toBeUndefined();
  });

  it('keeps an existing cached compatibility mode for all ask modes', () => {
    expect(resolveAskCompatMode({
      askMode: 'agent',
      provider: 'openai',
      baseUrl: 'https://proxy.example/v1',
      cachedMode: 'non-streaming',
    })).toBe('non-streaming');
  });
});
