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
    window.history.replaceState(null, '', '/capture');
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

  it('opens as a focused capture page instead of a crowded queue dashboard', async () => {
    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('Capture to Inbox');
    expect(host.textContent).toContain('New capture');
    expect(host.textContent).not.toContain('Capture anythingCapture anything');
    expect(host.querySelector('textarea')?.getAttribute('placeholder')).toContain('Paste or drop anything here');
    expect(host.textContent).toContain('Attach');
    expect(host.textContent).toContain('Capture to Inbox');
    expect(host.textContent).toContain('Next action');
    expect(host.textContent).toContain('Save only');
    expect(host.textContent).not.toContain('Suggested: Save only');
    expect(host.textContent).not.toContain('Choose intent');
    expect(host.textContent).toContain('AI stays off during capture');
    expect(host.textContent).toContain('Detected');
    expect(host.textContent).toContain('Documents');
    expect(host.textContent).toContain('Tables');
    expect(host.textContent).toContain('Screenshots');
    expect(host.textContent).not.toContain('Inbox Queue');
    expect(host.textContent).not.toContain('Triage plan');
    expect(host.textContent).not.toContain('Run AI Organize');
    expect(Array.from(host.querySelectorAll('button'))
      .some(button => button.textContent?.trim() === 'AI Organize')).toBe(false);
    expect(host.textContent).not.toContain('agent-memory-notes');
    expect(host.textContent).not.toContain('Capture sources');
    expect(host.textContent).not.toContain('WeChat');
    expect(host.textContent).not.toContain('Web clipper');
    expect(host.textContent).not.toContain('Current item');

    await act(async () => {
      root.unmount();
    });
  });

  it('moves queue, current item, and AI routing behind the Queue tab', async () => {
    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    const queueTab = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Queue'));
    expect(queueTab).not.toBeNull();

    await act(async () => {
      queueTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('Inbox Queue');
    expect(host.textContent).toContain('Triage plan');
    expect(host.textContent).toContain('Run AI Organize');
    expect(Array.from(host.querySelectorAll('button'))
      .some(button => button.textContent?.trim() === 'AI Organize')).toBe(true);
    expect(host.textContent).toContain('agent-memory-notes');
    expect(host.textContent).toContain('Current item');
    expect(host.textContent).toContain('Review before write');
    expect(host.textContent).toContain('Undo record');

    await act(async () => {
      root.unmount();
    });
  });

  it('saves pasted text as an Inbox markdown capture', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/settings') {
        return { ok: true, json: async () => ({ ai: { activeProvider: '', providers: [] } }) };
      }
      if (url === '/api/inbox' && init?.method === 'POST') {
        return { ok: true, json: async () => ({ saved: [{ original: 'capture.md', path: 'Inbox/capture.md' }], skipped: [] }) };
      }
      return { ok: true, json: async () => ({ files: [] }) };
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

    const intentButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Save only'));
    expect(intentButton).not.toBeNull();

    await act(async () => {
      intentButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    const judgmentOption = Array.from(document.body.querySelectorAll('button[role="option"]'))
      .find(button => button.textContent?.includes('Extract judgment'));
    expect(judgmentOption).not.toBeNull();

    await act(async () => {
      judgmentOption!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
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

  it('keeps the visible attach control wired to the file input without extra source shortcuts', async () => {
    const InboxView = (await import('@/components/InboxView')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxView />);
      await new Promise(r => setTimeout(r, 0));
    });

    const textarea = host.querySelector('textarea');
    const fileInput = host.querySelector('input[type="file"]') as HTMLInputElement | null;
    expect(textarea).not.toBeNull();
    expect(fileInput).not.toBeNull();

    const fileClickSpy = vi.spyOn(fileInput!, 'click').mockImplementation(() => undefined);

    const attachButton = Array.from(host.querySelectorAll('button'))
      .find(item => item.textContent?.includes('Attach'));
    expect(attachButton).not.toBeNull();

    await act(async () => {
      attachButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(fileClickSpy).toHaveBeenCalledTimes(1);

    await act(async () => {
      root.unmount();
    });
  });

  it('turns a pasted URL into a composer chip and captures it with the same primary action', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === '/api/settings') {
        return { ok: true, json: async () => ({ ai: { activeProvider: '', providers: [] } }) };
      }
      if (url === '/api/inbox/clip') {
        return { ok: true, json: async () => ({ title: 'Example Article' }) };
      }
      return { ok: true, json: async () => ({ files: [] }) };
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
