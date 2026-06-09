// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { messages } from '@/lib/i18n';
import type { SettingsData } from '@/components/settings/types';

const mockApiFetch = vi.hoisted(() => vi.fn());

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(),
    t: messages.en,
  }),
}));

vi.mock('@/components/settings/AppearanceTab', () => ({ AppearanceTab: () => null }));
vi.mock('@/components/settings/KnowledgeTab', () => ({ KnowledgeTab: () => null }));
vi.mock('@/components/settings/SyncTab', () => ({ SyncTab: () => null }));
vi.mock('@/components/settings/McpTab', () => ({ McpTab: () => null }));
vi.mock('@/components/settings/PluginsTab', () => ({ PluginsTab: () => null }));
vi.mock('@/components/settings/UpdateTab', () => ({ UpdateTab: () => null }));
vi.mock('@/components/settings/UninstallTab', () => ({ UninstallTab: () => null }));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

function makeSettings(): SettingsData {
  return {
    ai: {
      activeProvider: 'p_openai01',
      providers: [
        {
          id: 'p_openai01',
          name: 'OpenAI',
          protocol: 'openai',
          apiKey: '',
          model: 'gpt-5.4',
          baseUrl: '',
        },
      ],
    },
    agent: {},
    mindRoot: '/tmp/mind',
    envOverrides: {},
  };
}

describe('Settings AI provider switching', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockReturnValue({
        matches: false,
        media: '(prefers-color-scheme: dark)',
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('saves a newly selected provider from the real AI settings tab', async () => {
    const SettingsContent = (await import('@/components/settings/SettingsContent')).default;
    const postBodies: Array<Record<string, any>> = [];
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/settings' && !opts?.method) return Promise.resolve(makeSettings());
      if (url === '/api/settings' && opts?.method === 'POST') {
        postBodies.push(JSON.parse(String(opts.body)));
        return Promise.resolve({});
      }
      throw new Error(`Unexpected apiFetch call: ${url}`);
    });

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<SettingsContent visible initialTab="ai" variant="panel" />);
      await Promise.resolve();
      await Promise.resolve();
    });
    vi.clearAllTimers();
    postBodies.length = 0;

    const anthropicButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Anthropic')) as HTMLButtonElement | undefined;
    expect(anthropicButton).toBeTruthy();

    await act(async () => {
      anthropicButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postBodies).toHaveLength(1);
    const savedAi = postBodies[0].ai;
    const selected = savedAi.providers.find((provider: { id: string }) => provider.id === savedAi.activeProvider);
    expect(selected).toMatchObject({
      name: 'Anthropic',
      protocol: 'anthropic',
      model: 'claude-sonnet-4-6',
    });
    expect(savedAi.providers.map((provider: { protocol: string }) => provider.protocol)).toEqual(['openai', 'anthropic']);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
