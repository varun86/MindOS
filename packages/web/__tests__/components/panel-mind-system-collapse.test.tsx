// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Panel from '@/components/Panel';
import type { MindSystemSlot } from '@/lib/mind-system';
import type { FileNode } from '@/lib/types';

const mockPush = vi.fn();

vi.mock('next/navigation', () => ({
  usePathname: () => '/wiki',
  useRouter: () => ({ push: mockPush }),
}));

vi.mock('@/lib/actions', () => ({
  listTrashAction: vi.fn(async () => []),
}));

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const MIND_SYSTEM_COLLAPSED_KEY = 'mindos.sidebar.mindSystemCollapsed';
const SLOT_LIST_ID = 'mind-system-sidebar-slots';

const mindSystemSlots: MindSystemSlot[] = [
  {
    key: 'dao',
    systemId: 'MIND_DAO',
    label: '道',
    path: 'MIND_DAO',
    role: 'world-model',
    order: 10,
    primary: true,
    enabled: true,
  },
  {
    key: 'fa',
    systemId: 'MIND_FA',
    label: '法',
    path: 'MIND_FA',
    role: 'principles',
    order: 20,
    primary: true,
    enabled: true,
  },
];

const mindSystemFileTree: FileNode[] = [
  {
    type: 'directory',
    name: 'MIND_DAO',
    path: 'MIND_DAO',
    isSpace: true,
    children: [
      { type: 'file', name: 'README.md', path: 'MIND_DAO/README.md', extension: '.md' },
      { type: 'file', name: 'INSTRUCTION.md', path: 'MIND_DAO/INSTRUCTION.md', extension: '.md' },
    ],
  },
  {
    type: 'directory',
    name: 'Projects',
    path: 'Projects',
    children: [
      { type: 'file', name: 'plan.md', path: 'Projects/plan.md', extension: '.md' },
    ],
  },
];

function renderPanel(
  host: HTMLDivElement,
  options: { fileTree?: FileNode[]; slots?: MindSystemSlot[] } = {},
): Root {
  const root = createRoot(host);
  root.render(
    <Panel
      activePanel="files"
      fileTree={options.fileTree ?? []}
      mindSystemSlots={options.slots ?? mindSystemSlots}
      onOpenSyncSettings={() => {}}
    />,
  );
  return root;
}

function getMindSystemToggle(host: HTMLElement): HTMLButtonElement {
  const button = host.querySelector<HTMLButtonElement>(`button[aria-controls="${SLOT_LIST_ID}"]`);
  if (!button) throw new Error('Mind System toggle not found');
  return button;
}

describe('Panel Mind System collapse', () => {
  let host: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    root = null;
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => ({ files: [] }),
    })));
    host = document.createElement('div');
    document.body.appendChild(host);
  });

  afterEach(async () => {
    await act(async () => {
      root?.unmount();
    });
    host.remove();
    vi.unstubAllGlobals();
  });

  it('defaults expanded and toggles the Mind System parent without navigating', async () => {
    await act(async () => {
      root = renderPanel(host);
    });

    const toggle = getMindSystemToggle(host);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(host.querySelector(`#${SLOT_LIST_ID}`)).not.toBeNull();

    await act(async () => {
      toggle.click();
    });

    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector(`#${SLOT_LIST_ID}`)).toBeNull();
    expect(localStorage.getItem(MIND_SYSTEM_COLLAPSED_KEY)).toBe('1');
    expect(mockPush).not.toHaveBeenCalled();
  });

  it('restores the persisted collapsed state', async () => {
    localStorage.setItem(MIND_SYSTEM_COLLAPSED_KEY, '1');

    await act(async () => {
      root = renderPanel(host);
    });

    expect(getMindSystemToggle(host).getAttribute('aria-expanded')).toBe('false');
    expect(host.querySelector(`#${SLOT_LIST_ID}`)).toBeNull();
  });

  it('does not duplicate visible Mind System slots in the ordinary file tree', async () => {
    await act(async () => {
      root = renderPanel(host, { fileTree: mindSystemFileTree });
    });

    expect(host.textContent).toContain('Projects');
    expect(host.textContent).not.toContain('MIND_DAO');
  });

  it('keeps MIND folders in the ordinary file tree when Mind System slots are hidden', async () => {
    await act(async () => {
      root = renderPanel(host, { fileTree: mindSystemFileTree, slots: [] });
    });

    expect(host.textContent).toContain('MIND_DAO');
    expect(host.textContent).toContain('Projects');
  });
});
