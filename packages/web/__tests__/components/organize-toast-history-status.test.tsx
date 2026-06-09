// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
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

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
}));

const STORAGE_KEY = 'mindos:organize-history';

describe('OrganizeToast history status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('records a partial history entry when any organize change failed', async () => {
    const OrganizeToast = (await import('@/components/OrganizeToast')).default;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    const aiOrganize = {
      phase: 'done',
      stageHint: null,
      changes: [
        { action: 'create', path: 'Knowledge/ok.md', ok: true, undone: false },
        { action: 'create', path: 'Knowledge/fail.md', ok: false, undone: false },
      ],
      sourceFileNames: ['capture.md'],
      source: 'inbox-organize',
      durationMs: 1200,
      summary: '',
      error: '',
      hasAnyUndoable: false,
      canUndo: () => false,
      undoOne: vi.fn(),
      undoAll: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
      start: vi.fn(),
    };

    await act(async () => {
      root.render(
        <OrganizeToast
          aiOrganize={aiOrganize as React.ComponentProps<typeof OrganizeToast>['aiOrganize']}
          onDismiss={vi.fn()}
          onCancel={vi.fn()}
        />,
      );
      await new Promise(r => setTimeout(r, 0));
    });

    const history = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    expect(history[0]?.status).toBe('partial');
    expect(history[0]?.files).toHaveLength(2);

    await act(async () => {
      root.unmount();
    });
  });

  it('uses the running-state close button to cancel the active organize run', async () => {
    const OrganizeToast = (await import('@/components/OrganizeToast')).default;
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const onCancel = vi.fn();
    const onDismiss = vi.fn();

    const aiOrganize = {
      phase: 'organizing',
      stageHint: { stage: 'thinking' },
      changes: [],
      sourceFileNames: ['capture.md'],
      source: 'inbox-organize',
      durationMs: undefined,
      summary: '',
      error: '',
      hasAnyUndoable: false,
      canUndo: () => false,
      undoOne: vi.fn(),
      undoAll: vi.fn(),
      abort: vi.fn(),
      reset: vi.fn(),
      start: vi.fn(),
    };

    await act(async () => {
      root.render(
        <OrganizeToast
          aiOrganize={aiOrganize as React.ComponentProps<typeof OrganizeToast>['aiOrganize']}
          onDismiss={onDismiss}
          onCancel={onCancel}
        />,
      );
      await new Promise(r => setTimeout(r, 0));
    });

    const cancelButton = host.querySelector<HTMLButtonElement>('button[aria-label="Cancel"]');
    expect(cancelButton).not.toBeNull();

    await act(async () => {
      cancelButton?.click();
    });

    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });
});
