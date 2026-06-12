// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/lib/i18n';

const navigationMock = vi.hoisted(() => ({
  query: 'tab=channels&platform=feishu',
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

async function renderChannelsView() {
  const IMChannelsView = (await import('@/components/panels/IMChannelsView')).default;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<IMChannelsView />);
    await new Promise(resolve => setTimeout(resolve, 0));
  });

  return { host, root };
}

describe('IMChannelsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.query = 'tab=channels&platform=feishu';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        platforms: [
          { platform: 'feishu', connected: true, capabilities: ['text', 'markdown'] },
        ],
      }),
    }));
  });

  it('renders the sidebar channel list as compact status cards', async () => {
    const { host, root } = await renderChannelsView();

    const links = Array.from(host.querySelectorAll<HTMLAnchorElement>('a[href*="tab=channels&platform="]'));
    expect(links).toHaveLength(8);
    expect(host.textContent).toContain('频道');
    expect(host.textContent).toContain('1 已连接');

    const feishu = links.find(link => link.getAttribute('href')?.includes('platform=feishu'));
    expect(feishu).toBeTruthy();
    expect(feishu?.getAttribute('aria-current')).toBe('page');
    expect(feishu?.textContent).toContain('Feishu');
    expect(feishu?.className).toContain('rounded-xl');
    expect(feishu?.className).toContain('min-h-14');
    expect(feishu?.innerHTML).toContain('aria-label="已连接"');

    expect(host.innerHTML).not.toContain('rounded-sm');

    await act(async () => {
      root.unmount();
    });
    host.remove();
  });
});
