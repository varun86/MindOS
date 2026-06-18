// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SessionContextDock from '@/components/ask/SessionContextDock';
import type { ChatSession, SessionContextSelection, SessionWorkDir } from '@/lib/types';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const labels = {
  title: 'Context',
  workDir: 'WorkDir',
  spaces: 'Spaces',
  assistants: 'Assistants',
  mindRoot: 'Mind',
  none: 'None',
  locked: 'Locked after first message',
  editWorkDir: 'Set work directory',
  workDirPlaceholder: '/path/to/project',
  workDirBrowse: 'Choose work directory',
  workDirBrowseUnavailable: 'Folder picker is available in the desktop app',
  addSpace: 'Add Space',
  addAssistant: 'Add Assistant',
  searchSpaces: 'Search spaces',
  searchAssistants: 'Search assistants',
  noMatches: 'No matches',
  newSession: 'New',
  removeItem: (label: string) => `Remove ${label}`,
  spacePlaceholder: 'Space path',
  assistantPlaceholder: 'assistant-id',
  applyNextTurn: 'Changes apply to the next message.',
  spacesCount: (n: number) => `${n} space${n === 1 ? '' : 's'}`,
  assistantsCount: (n: number) => `${n} assistant${n === 1 ? '' : 's'}`,
};

function sessionWithSelection(selection: Partial<SessionContextSelection> = {}): ChatSession {
  return {
    id: 'session-1',
    createdAt: 1,
    updatedAt: 1,
    messages: [],
    workDir: { source: 'mind-root', label: 'Mind root' },
    contextSelection: {
      version: 1,
      spaces: [],
      assistants: [],
      ...selection,
    },
  };
}

function mountDock({
  session = sessionWithSelection({
    spaces: [{ path: 'MIND_DAO', label: '道', icon: '道', source: 'manual' }],
    assistants: [{ id: 'daily-signal', name: 'Daily Signal', kind: 'assistant', source: 'manual' }],
  }),
  workDirEditable = true,
  onSetWorkDir = vi.fn(() => true),
  onSetContextSelection = vi.fn(() => true),
}: {
  session?: ChatSession;
  workDirEditable?: boolean;
  onSetWorkDir?: (workDir: SessionWorkDir) => boolean;
  onSetContextSelection?: (selection: SessionContextSelection) => boolean;
} = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(
      <SessionContextDock
        session={session}
        labels={labels}
        workDirEditable={workDirEditable}
        onSetWorkDir={onSetWorkDir}
        onSetContextSelection={onSetContextSelection}
        onNewSession={vi.fn()}
      />,
    );
  });

  return { host, root, onSetWorkDir, onSetContextSelection };
}

describe('SessionContextDock', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('renders a quiet collapsed summary without the legacy Context/None table copy', () => {
    const { host, root } = mountDock();

    expect(host.textContent).toContain('Mind');
    expect(host.textContent).toContain('1 space');
    expect(host.textContent).toContain('1 assistant');
    expect(host.textContent).not.toContain('Context');
    expect(host.textContent).not.toContain('None');
    expect(host.textContent).not.toContain('WorkDir');

    act(() => root.unmount());
  });

  it('adds and removes Spaces through the searchable chip picker', () => {
    const onSetContextSelection = vi.fn(() => true);
    const { host, root } = mountDock({ onSetContextSelection });

    const toggle = host.querySelector('button[aria-label="Context"]') as HTMLButtonElement;
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const addSpace = document.body.querySelector('button[aria-label="Add Space"]') as HTMLButtonElement;
    act(() => {
      addSpace.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const search = document.body.querySelector('input[aria-label="Search spaces"]') as HTMLInputElement;
    act(() => {
      search.value = '术';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const shu = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('术')) as HTMLButtonElement;
    act(() => {
      shu.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSetContextSelection).toHaveBeenCalledWith(expect.objectContaining({
      spaces: expect.arrayContaining([
        expect.objectContaining({ path: 'MIND_SHU', label: '术' }),
      ]),
    }));

    const removeDao = document.body.querySelector('button[aria-label="Remove 道"]') as HTMLButtonElement;
    act(() => {
      removeDao.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSetContextSelection).toHaveBeenLastCalledWith(expect.objectContaining({
      spaces: [],
    }));

    act(() => root.unmount());
  });

  it('adds Assistants through the searchable chip picker', () => {
    const onSetContextSelection = vi.fn(() => true);
    const { host, root } = mountDock({
      session: sessionWithSelection(),
      onSetContextSelection,
    });

    const toggle = host.querySelector('button[aria-label="Context"]') as HTMLButtonElement;
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const addAssistant = document.body.querySelector('button[aria-label="Add Assistant"]') as HTMLButtonElement;
    act(() => {
      addAssistant.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const search = document.body.querySelector('input[aria-label="Search assistants"]') as HTMLInputElement;
    act(() => {
      search.value = 'Inbox';
      search.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const inboxOrganizer = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent?.includes('Inbox Organizer')) as HTMLButtonElement;
    act(() => {
      inboxOrganizer.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(onSetContextSelection).toHaveBeenCalledWith(expect.objectContaining({
      assistants: expect.arrayContaining([
        expect.objectContaining({ id: 'inbox-organizer', name: 'Inbox Organizer' }),
      ]),
    }));

    act(() => root.unmount());
  });

  it('uses icon-only hints for locked WorkDir and next-message apply details', () => {
    const { host, root } = mountDock({ workDirEditable: false });

    const toggle = host.querySelector('button[aria-label="Context"]') as HTMLButtonElement;
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.textContent).not.toContain('Locked after first message');
    expect(document.body.textContent).not.toContain('Changes apply to the next message.');
    expect(document.body.querySelector('[aria-label="Locked after first message"]')).not.toBeNull();
    expect(document.body.querySelector('[aria-label="Changes apply to the next message."]')).not.toBeNull();

    act(() => root.unmount());
  });

  it('collapses the expanded tray when the user clicks outside the context controls', () => {
    const { host, root } = mountDock();
    const outside = document.createElement('button');
    outside.textContent = 'Composer input';
    document.body.appendChild(outside);

    const toggle = host.querySelector('button[aria-label="Context"]') as HTMLButtonElement;
    act(() => {
      toggle.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(document.body.querySelector('button[aria-label="Add Space"]')).not.toBeNull();

    act(() => {
      outside.dispatchEvent(new Event('pointerdown', { bubbles: true }));
    });

    expect(document.body.querySelector('button[aria-label="Add Space"]')).toBeNull();
    expect(toggle.getAttribute('aria-expanded')).toBe('false');

    act(() => root.unmount());
  });
});
