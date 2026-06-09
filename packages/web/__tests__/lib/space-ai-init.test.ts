import { beforeEach, describe, expect, it, vi } from 'vitest';
import { checkAiAvailable, consumeSpaceAiInitStream, findSpaceAiInitStreamError } from '@/lib/space-ai-init';

function streamFrom(chunks: string[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(new TextEncoder().encode(chunk));
      controller.close();
    },
  });
}

describe('space AI init stream handling', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
  });

  it('uses the active provider from the current settings payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai: {
          activeProvider: 'p_openai01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    }));

    await expect(checkAiAvailable()).resolves.toBe(true);
  });

  it('uses provider env fallback from the current settings payload', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
          ],
        },
        envOverrides: { ANTHROPIC_API_KEY: true },
      }),
    }));

    await expect(checkAiAvailable()).resolves.toBe(true);
  });

  it('checks an explicit provider override even when the active provider has no key', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        ai: {
          activeProvider: 'p_anthro01',
          providers: [
            { id: 'p_anthro01', name: 'Anthropic', protocol: 'anthropic', apiKey: '', model: 'claude-sonnet-4-6', baseUrl: '' },
            { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
          ],
        },
        envOverrides: {},
      }),
    }));

    await expect(checkAiAvailable('p_openai01')).resolves.toBe(true);
  });

  it('detects MindOS SSE error events', () => {
    expect(findSpaceAiInitStreamError('data:{"type":"error","message":"No API key"}\n\n'))
      .toBe('No API key');
  });

  it('throws while draining a failed init stream', async () => {
    await expect(consumeSpaceAiInitStream(streamFrom([
      'data:{"type":"text_delta","delta":"Starting"}\n',
      'data:{"type":"error","message":"Model failed"}\n\n',
    ]))).rejects.toThrow('Model failed');
  });

  it('ignores malformed non-error stream lines', async () => {
    await expect(consumeSpaceAiInitStream(streamFrom([
      'data:{bad json}\n',
      'data:{"type":"done"}\n',
    ]))).resolves.toBeUndefined();
  });
});
