// @vitest-environment jsdom
import React, { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRoot } from 'react-dom/client';
import { getActiveSessionId, resetSession } from '@/lib/ask-session-store';
import { setMessages } from '@/lib/ask-run-store';

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({ locale: 'en' as const }),
}));

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function render(element: React.ReactElement) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(element);
  });
  return {
    host,
    async cleanup() {
      await act(async () => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('Studio Project UI', () => {
  beforeEach(() => {
    localStorage.clear();
    mockPush.mockClear();
  });

  it('renders the Studio page as a Project-first surface', async () => {
    const StudioContent = (await import('@/components/studio/StudioContent')).default;
    const view = await render(<StudioContent />);

    expect(view.host.textContent).toContain('New Project');
    expect(view.host.textContent).not.toContain('Recent Projects');
    expect(view.host.textContent).toContain('Projects carry context');
    expect(view.host.textContent).toContain('Launch Practice');
    expect(view.host.textContent).not.toContain('Start from a setup');
    expect(view.host.textContent).not.toContain('Suggested setup');
    expect(view.host.querySelector('[data-content-page-shell="studio"]')?.className).toContain('workbench-content-page');

    const launchLink = view.host.querySelector<HTMLAnchorElement>('a[href="/studio/launch-practice"]');
    expect(launchLink).not.toBeNull();
    expect(view.host.querySelector('a[href="/chat/new"]')).toBeNull();

    await view.cleanup();
  });

  it('renders Project detail with historical Sessions and Project defaults', async () => {
    const StudioProjectContent = (await import('@/components/studio/StudioProjectContent')).default;
    const view = await render(<StudioProjectContent projectId="launch-practice" />);

    expect(view.host.textContent).toContain('Launch Practice');
    expect(view.host.textContent).toContain('Overview');
    expect(view.host.textContent).toContain('Directory');
    expect(view.host.textContent).toContain('Goal');
    expect(view.host.textContent).toContain('Progress');
    expect(view.host.textContent).toContain('Session history');
    expect(view.host.textContent).toContain('Launch brief review');
    expect(view.host.textContent).toContain('Product Strategy');
    expect(view.host.textContent).toContain('Research Kit');
    expect(view.host.textContent).toContain('Session drafts');
    expect(view.host.querySelector('input[placeholder="Search title, artifact, or summary"]')).not.toBeNull();
    expect(view.host.querySelector('select')).not.toBeNull();
    expect(view.host.querySelector('[data-stable-row-trailing]')).not.toBeNull();

    const newSession = view.host.querySelector<HTMLAnchorElement>('a[href="/chat/new?projectId=launch-practice"]');
    expect(newSession).not.toBeNull();

    await view.cleanup();
  });

  it('filters Project Sessions by agent without changing the row chrome contract', async () => {
    const StudioProjectContent = (await import('@/components/studio/StudioProjectContent')).default;
    const view = await render(<StudioProjectContent projectId="launch-practice" />);

    const filter = view.host.querySelector('select') as HTMLSelectElement | null;
    expect(filter).not.toBeNull();

    await act(async () => {
      filter!.value = 'codex';
      filter!.dispatchEvent(new Event('change', { bubbles: true }));
    });

    expect(view.host.textContent).toContain('Launch brief review');
    expect(view.host.textContent).not.toContain('Pricing evidence pass');
    expect(view.host.querySelectorAll('[data-stable-row-trailing]')).toHaveLength(1);

    await view.cleanup();
  });

  it('shows real Project-scoped Chat sessions before seed fallback sessions', async () => {
    resetSession({ projectId: 'launch-practice' });
    const id = getActiveSessionId();
    expect(id).toBeTruthy();
    setMessages(id!, [
      { role: 'user', content: 'Prepare the investor launch memo', timestamp: Date.now() },
      { role: 'assistant', content: 'Drafted launch memo outline with source gaps.', timestamp: Date.now() },
    ], { skipPersist: true });

    const StudioProjectContent = (await import('@/components/studio/StudioProjectContent')).default;
    const view = await render(<StudioProjectContent projectId="launch-practice" />);

    expect(view.host.textContent).toContain('Prepare the investor launch memo');
    expect(view.host.textContent).toContain('Drafted launch memo outline with source gaps.');
    expect(view.host.textContent).toContain('Chat session');
    expect(view.host.querySelector<HTMLAnchorElement>(`a[href="/chat/${encodeURIComponent(id!)}"]`)).not.toBeNull();

    await view.cleanup();
  });

  it('shows a recoverable state for unknown Project routes', async () => {
    const StudioProjectContent = (await import('@/components/studio/StudioProjectContent')).default;
    const view = await render(<StudioProjectContent projectId="missing-project" />);

    expect(view.host.textContent).toContain('Project not found');
    expect(view.host.querySelector<HTMLAnchorElement>('a[href="/studio"]')).not.toBeNull();

    await view.cleanup();
  });
});
