// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import AskFab from '@/components/AskFab';

const navState = vi.hoisted(() => ({
  pathname: '/wiki',
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(),
    t: { ask: { fabLabel: 'Ask MindOS' } },
  }),
}));

function renderFab(askPanelOpen: boolean): { host: HTMLDivElement; root: Root } {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<AskFab onToggle={vi.fn()} askPanelOpen={askPanelOpen} />);
  });

  return { host, root };
}

describe('AskFab visibility', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
    navState.pathname = '/wiki';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('is visible on content pages when the Ask panel is closed', () => {
    const { host, root } = renderFab(false);
    const button = host.querySelector('button');

    expect(button?.className).toContain('opacity-100');
    expect(button?.className).not.toContain('pointer-events-none');

    act(() => root.unmount());
  });

  it('hides while the Ask panel or desktop popup is already open', () => {
    const { host, root } = renderFab(true);
    const button = host.querySelector('button');

    expect(button?.className).toContain('opacity-0');
    expect(button?.className).toContain('pointer-events-none');

    act(() => root.unmount());
  });

  it('stays hidden on the home page because the inline chat is already present', () => {
    navState.pathname = '/';
    const { host, root } = renderFab(false);
    const button = host.querySelector('button');

    expect(button?.className).toContain('opacity-0');
    expect(button?.className).toContain('pointer-events-none');

    act(() => root.unmount());
  });
});
