// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { messages } from '@/lib/i18n';

const navigationMock = vi.hoisted(() => ({
  pathname: '/wiki',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navigationMock.pathname,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'zh' as const,
    setLocale: vi.fn(),
    t: messages.zh,
  }),
}));

async function renderAskFab(props: { askPanelOpen?: boolean } = {}) {
  const AskFab = (await import('@/components/AskFab')).default;
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => {
    root.render(<AskFab onToggle={vi.fn()} askPanelOpen={props.askPanelOpen ?? false} />);
  });

  const button = host.querySelector('button') as HTMLButtonElement;
  return { host, root, button };
}

describe('AskFab route visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    navigationMock.pathname = '/wiki';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('shows on ordinary content routes when the ask panel is closed', async () => {
    const { host, root, button } = await renderAskFab();

    expect(button.className).toContain('opacity-100');
    expect(button.className).not.toContain('pointer-events-none');

    await act(async () => root.unmount());
    host.remove();
  });

  it('hides on full-page chat routes', async () => {
    navigationMock.pathname = '/chat/session-123';
    const { host, root, button } = await renderAskFab();

    expect(button.className).toContain('opacity-0');
    expect(button.className).toContain('pointer-events-none');

    await act(async () => root.unmount());
    host.remove();
  });
});
