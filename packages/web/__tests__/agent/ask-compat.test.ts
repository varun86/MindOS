import { describe, expect, it } from 'vitest';
import { resolveAskCompatMode } from '@/lib/agent/ask-compat';

describe('resolveAskCompatMode', () => {
  it('does not force non-streaming for agent runs on custom base URLs', () => {
    expect(resolveAskCompatMode({
      provider: 'openai',
      baseUrl: 'https://lumina.tripo3d.com/v1',
    })).toBeUndefined();
  });

  it('keeps an existing cached compatibility mode for agent requests', () => {
    expect(resolveAskCompatMode({
      provider: 'openai',
      baseUrl: 'https://proxy.example/v1',
      cachedMode: 'non-streaming',
    })).toBe('non-streaming');
  });
});
