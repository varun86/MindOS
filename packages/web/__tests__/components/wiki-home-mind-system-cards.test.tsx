// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WikiHomeContent from '@/components/WikiHomeContent';
import type { MindSystemSlot } from '@/lib/mind-system';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

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
  {
    key: 'shu',
    systemId: 'MIND_SHU',
    label: '术',
    path: 'MIND_SHU',
    role: 'methods',
    order: 30,
    primary: true,
    enabled: true,
  },
  {
    key: 'qi',
    systemId: 'MIND_QI',
    label: '器',
    path: 'MIND_QI',
    role: 'tools-assets',
    order: 40,
    primary: true,
    enabled: true,
  },
];

describe('WikiHomeContent Mind System cards', () => {
  let host: HTMLDivElement;
  let root: Root | null;

  beforeEach(() => {
    localStorage.clear();
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true,
      json: async () => ({ files: [] }),
    })));
    root = null;
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

  it('renders semantic Mind System cards that link to fixed MIND folders', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<WikiHomeContent spaces={[]} recent={[]} mindSystemSlots={mindSystemSlots} />);
    });

    for (const slot of mindSystemSlots) {
      const card = host.querySelector<HTMLAnchorElement>(`a[href="/view/${slot.path}"]`);
      expect(card, `${slot.key} card`).not.toBeNull();
      expect(card?.textContent).toContain(slot.label);
    }
  });
});
