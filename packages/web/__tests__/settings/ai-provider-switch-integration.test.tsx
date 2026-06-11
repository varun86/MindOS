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

  it('adds providers only through the explicit add form in the real AI settings tab', async () => {
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

    expect(host.textContent).toContain('OpenAI');
    expect(host.textContent).toContain('Add provider');
    expect(host.textContent).not.toContain('Anthropic');

    const addButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Add provider')) as HTMLButtonElement | undefined;
    expect(addButton).toBeTruthy();
    await act(async () => {
      addButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const saveButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent === 'Save') as HTMLButtonElement | undefined;
    expect(saveButton).toBeTruthy();

    await act(async () => {
      saveButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
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
      name: 'OpenAI 2',
      protocol: 'openai',
      model: 'gpt-5.4',
    });
    expect(savedAi.providers.map((provider: { name: string }) => provider.name)).toEqual(['OpenAI', 'OpenAI 2']);

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });

  it('requires confirmation before changing a provider protocol and clearing connection fields', async () => {
    const SettingsContent = (await import('@/components/settings/SettingsContent')).default;
    const postBodies: Array<Record<string, any>> = [];
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/settings' && !opts?.method) {
        return Promise.resolve({
          ...makeSettings(),
          ai: {
            activeProvider: 'p_openai01',
            providers: [
              {
                id: 'p_openai01',
                name: 'OpenAI',
                protocol: 'openai',
                apiKey: 'sk-live',
                model: 'custom-gpt',
                baseUrl: 'https://proxy.example/v1',
              },
            ],
          },
        });
      }
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

    const protocolButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent === 'OpenAI') as HTMLButtonElement | undefined;
    expect(protocolButton).toBeTruthy();

    await act(async () => {
      protocolButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const anthropicOption = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Anthropic') as HTMLButtonElement | undefined;
    expect(anthropicOption).toBeTruthy();

    await act(async () => {
      anthropicOption?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
    });

    expect(host.textContent).toContain("Changing to Anthropic will reset this provider's API key, model, and Base URL.");

    await act(async () => {
      vi.advanceTimersByTime(1000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postBodies).toHaveLength(0);
    expect((host.querySelector('input[type="password"]') as HTMLInputElement | null)?.value).toBe('sk-live');

    const changeButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent === 'Change') as HTMLButtonElement | undefined;
    expect(changeButton).toBeTruthy();

    await act(async () => {
      changeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });
    await act(async () => {
      vi.advanceTimersByTime(800);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(postBodies).toHaveLength(1);
    expect(postBodies[0].ai.providers[0]).toMatchObject({
      id: 'p_openai01',
      name: 'Anthropic',
      protocol: 'anthropic',
      apiKey: '',
      model: 'claude-sonnet-4-6',
      baseUrl: '',
    });

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
