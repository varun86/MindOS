// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import { messages } from '@/lib/i18n';

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    setLocale: vi.fn(),
    t: messages.en,
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

const mockRouterPush = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => '/capture',
}));

describe('InboxView product shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        files: [
          {
            name: 'agent-memory-notes.md',
            path: 'Inbox/agent-memory-notes.md',
            size: 2048,
            modifiedAt: new Date().toISOString(),
            isAging: false,
          },
        ],
      }),
    }));
  });

  it('frames Inbox as capture, queue, and AI routing rather than a plain file list', async () => {
    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('Capture anything');
    expect(host.textContent).toContain('Paste or drop anything here');
    expect(host.textContent).toContain('Attach');
    expect(host.textContent).toContain('Capture to Inbox');
    expect(host.textContent).toContain('Next action');
    expect(host.textContent).toContain('Save only');
    expect(host.textContent).toContain('Suggested');
    expect(host.textContent).not.toContain('Choose intent');
    expect(host.textContent).toContain('Detected');
    expect(host.textContent).toContain('Documents');
    expect(host.textContent).toContain('Tables');
    expect(host.textContent).toContain('Screenshots');
    expect(host.textContent).toContain('Knowledge density');
    expect(host.textContent).toContain('Lifecycle');
    expect(host.textContent).toContain('Inbox Queue');
    expect(host.textContent).toContain('Triage plan');
    expect(host.textContent).toContain('Run AI Organize');
    expect(host.textContent).toContain('agent-memory-notes');

    await act(async () => {
      root.unmount();
    });
  });

  it('saves pasted text as an Inbox markdown capture', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ saved: [{ original: 'capture.md', path: 'Inbox/capture.md' }], skipped: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    const textarea = host.querySelector('textarea');
    expect(textarea).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLTextAreaElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(textarea, 'AI Agent article notes\n\nCapture this.');
      textarea!.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText' }));
      await new Promise(r => setTimeout(r, 0));
    });

    const select = host.querySelector('select');
    expect(select).not.toBeNull();

    await act(async () => {
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLSelectElement.prototype,
        'value',
      )?.set;
      valueSetter?.call(select, 'judgment');
      select!.dispatchEvent(new Event('change', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    const saveButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Capture to Inbox'));
    expect(saveButton).not.toBeNull();

    await act(async () => {
      saveButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/inbox', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('AI Agent article notes'),
    }));
    expect(fetchMock).toHaveBeenCalledWith('/api/inbox', expect.objectContaining({
      body: expect.stringContaining('"captureIntent":"judgment"'),
    }));

    await act(async () => {
      root.unmount();
    });
  });

  it('turns a pasted URL into a composer chip and captures it with the same primary action', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ title: 'Example Article' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ files: [] }),
      });
    vi.stubGlobal('fetch', fetchMock);

    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    const textarea = host.querySelector('textarea');
    expect(textarea).not.toBeNull();

    await act(async () => {
      const pasteEvent = new Event('paste', { bubbles: true });
      Object.defineProperty(pasteEvent, 'clipboardData', {
        value: {
          getData: (type: string) => type === 'text/plain' ? 'https://example.com/article' : '',
          files: [],
        },
      });
      textarea!.dispatchEvent(pasteEvent);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('URL');
    expect(host.textContent).toContain('example.com/article');

    const captureButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Capture to Inbox'));
    expect(captureButton).not.toBeNull();

    await act(async () => {
      captureButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/inbox/clip', expect.objectContaining({
      method: 'POST',
      body: expect.stringContaining('https://example.com/article'),
    }));

    await act(async () => {
      root.unmount();
    });
  });
});
