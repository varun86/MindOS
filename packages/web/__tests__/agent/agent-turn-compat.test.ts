import { describe, expect, it } from 'vitest';
import { resolveAgentTurnCompatMode } from '@/lib/agent/agent-turn-compat';

describe('resolveAgentTurnCompatMode', () => {
  it('does not force non-streaming for agent runs on custom base URLs', () => {
    expect(resolveAgentTurnCompatMode({
      provider: 'openai',
      baseUrl: 'https://lumina.tripo3d.com/v1',
    })).toBeUndefined();
  });

  it('keeps an existing cached compatibility mode for agent requests', () => {
    expect(resolveAgentTurnCompatMode({
      provider: 'openai',
      baseUrl: 'https://proxy.example/v1',
      cachedMode: 'non-streaming',
    })).toBe('non-streaming');
  });
});
