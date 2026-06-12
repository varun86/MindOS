// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/lib/i18n';
import { clearChannelCache } from '@/components/agents/channel-detail/cache';

const navigationMock = vi.hoisted(() => ({
  query: 'tab=channels',
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => (
    <a {...props}>{children}</a>
  ),
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(navigationMock.query),
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'zh' as const,
    setLocale: vi.fn(),
    t: messages.zh,
  }),
}));

async function renderChannels() {
  const AgentsContentChannels = (await import('@/components/agents/AgentsContentChannels')).default;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<AgentsContentChannels />);
    await Promise.resolve();
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  return { host, root };
}

describe('AgentsContentChannels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearChannelCache();
    navigationMock.query = 'tab=channels';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        platforms: [
          {
            platform: 'feishu',
            connected: true,
            botName: 'MindOS Bot',
            capabilities: ['plain-text-format', 'markdown-format', 'thread-routing'],
          },
        ],
      }),
    }));
  });

  it('keeps platform overview cards focused on status instead of internal capability tags', async () => {
    const { host, root } = await renderChannels();

    expect(host.textContent).toContain('平台列表');
    expect(host.textContent).toContain('Feishu');
    expect(host.textContent).toContain('MindOS Bot');
    expect(host.textContent).not.toContain('plain-text-format');
    expect(host.textContent).not.toContain('markdown-format');
    expect(host.textContent).not.toContain('thread-routing');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
