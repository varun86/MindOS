// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { messages } from '@/lib/i18n';
import type { SettingsData } from '@/components/settings/types';

const mockApiFetch = vi.hoisted(() => vi.fn());
const mockToast = vi.hoisted(() => {
  const fn = vi.fn();
  return Object.assign(fn, {
    success: vi.fn(),
    error: vi.fn(),
  });
});

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

vi.mock('@/lib/toast', () => ({
  toast: mockToast,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(),
    t: messages.en,
  }),
}));

function makeSettings(embedding: SettingsData['embedding']): SettingsData {
  return {
    ai: {
      activeProvider: 'p_openai',
      providers: [
        { id: 'p_openai', name: 'OpenAI', protocol: 'openai', apiKey: '', model: 'gpt-5.5', baseUrl: '' },
      ],
    },
    agent: {},
    embedding,
    embeddingStatus: { enabled: !!embedding?.enabled, ready: false, building: false, docCount: 0 },
    mindRoot: '/tmp/mind',
    envOverrides: {},
  };
}

async function flushPromises() {
  await Promise.resolve();
  await Promise.resolve();
}

describe('EmbeddingSearchCard', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    host.remove();
    vi.useRealTimers();
  });

  it('enables local search with a usable default model', async () => {
    const { EmbeddingSearchCard } = await import('@/components/settings/ai/EmbeddingSearchCard');
    const setData = vi.fn();
    const data = makeSettings({ enabled: false, provider: 'local', baseUrl: '', apiKey: '', model: '' });

    await act(async () => {
      root.render(<EmbeddingSearchCard data={data} setData={setData} t={messages.en} />);
    });

    const toggle = host.querySelector('button[role="switch"]') as HTMLButtonElement | null;
    expect(toggle).toBeTruthy();

    await act(async () => {
      toggle?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const updater = setData.mock.calls.at(-1)?.[0] as (current: SettingsData | null) => SettingsData | null;
    const next = updater(data);
    expect(next?.embedding).toMatchObject({
      enabled: true,
      provider: 'local',
      model: 'Xenova/bge-small-zh-v1.5',
    });
  });

  it('merges embedding updates against the latest settings state', async () => {
    const { EmbeddingSearchCard } = await import('@/components/settings/ai/EmbeddingSearchCard');
    const setData = vi.fn();
    const data = makeSettings({
      enabled: true,
      provider: 'api',
      baseUrl: 'https://old.example/v1',
      apiKey: 'old-key',
      model: 'old-model',
    });

    await act(async () => {
      root.render(<EmbeddingSearchCard data={data} setData={setData} t={messages.en} />);
    });

    const siliconFlow = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim().startsWith('SiliconFlow')) as HTMLButtonElement | undefined;
    expect(siliconFlow).toBeTruthy();

    await act(async () => {
      siliconFlow?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    const updater = setData.mock.calls.at(-1)?.[0] as (current: SettingsData | null) => SettingsData | null;
    const latest = makeSettings({
      enabled: true,
      provider: 'api',
      baseUrl: 'https://fresh.example/v1',
      apiKey: 'fresh-key',
      model: 'fresh-model',
    });
    const next = updater(latest);
    expect(next?.embedding).toMatchObject({
      enabled: true,
      provider: 'api',
      baseUrl: 'https://api.siliconflow.cn/v1',
      apiKey: 'fresh-key',
      model: 'BAAI/bge-m3',
    });
  });

  it('checks and polls the selected local model instead of the default model', async () => {
    const { EmbeddingSearchCard } = await import('@/components/settings/ai/EmbeddingSearchCard');
    const selectedModel = 'Xenova/all-MiniLM-L6-v2';
    const setData = vi.fn();
    let statusChecks = 0;
    mockApiFetch.mockImplementation((url: string, opts?: RequestInit) => {
      if (url === '/api/embedding' && !opts?.method) {
        return Promise.resolve({
          downloaded: false,
          defaultModel: 'Xenova/bge-small-zh-v1.5',
          models: [
            { id: 'Xenova/bge-small-zh-v1.5', label: 'BGE Small ZH (33MB)', lang: 'zh+en' },
            { id: selectedModel, label: 'MiniLM L6 (23MB)', lang: 'en' },
          ],
        });
      }
      if (url === '/api/embedding' && opts?.method === 'POST') {
        const body = JSON.parse(String(opts.body));
        if (body.action === 'status') {
          statusChecks += 1;
          return Promise.resolve({ downloading: statusChecks > 1, downloaded: statusChecks > 1, error: null });
        }
        if (body.action === 'download') return Promise.resolve({ ok: true });
      }
      throw new Error(`Unexpected apiFetch call: ${url}`);
    });

    await act(async () => {
      root.render(
        <EmbeddingSearchCard
          data={makeSettings({ enabled: true, provider: 'local', baseUrl: '', apiKey: '', model: selectedModel })}
          setData={setData}
          t={messages.en}
        />,
      );
      await flushPromises();
    });

    const initialStatusCall = mockApiFetch.mock.calls.find(([, opts]) => {
      if ((opts as RequestInit | undefined)?.method !== 'POST') return false;
      return JSON.parse(String((opts as RequestInit).body)).action === 'status';
    });
    expect(JSON.parse(String((initialStatusCall?.[1] as RequestInit).body))).toMatchObject({
      action: 'status',
      model: selectedModel,
    });

    const downloadButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Download Model')) as HTMLButtonElement | undefined;
    expect(downloadButton).toBeTruthy();

    await act(async () => {
      downloadButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await flushPromises();
    });

    await act(async () => {
      vi.advanceTimersByTime(3000);
      await flushPromises();
    });

    const postBodies = mockApiFetch.mock.calls
      .filter(([, opts]) => (opts as RequestInit | undefined)?.method === 'POST')
      .map(([, opts]) => JSON.parse(String((opts as RequestInit).body)));
    expect(postBodies).toContainEqual({ action: 'download', model: selectedModel });
    expect(postBodies).toContainEqual({ action: 'status', model: selectedModel });
    expect(mockToast.success).toHaveBeenCalledTimes(1);
    expect(mockToast).not.toHaveBeenCalled();
  });
});
