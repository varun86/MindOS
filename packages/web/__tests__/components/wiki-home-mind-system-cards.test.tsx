// @vitest-environment jsdom
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WikiHomeContent from '@/components/WikiHomeContent';
import type { MindSystemSlot } from '@/lib/mind-system';
import type { BuiltInMindSystemSpaceRecord } from '@/lib/space-records';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mindSystemSlots: MindSystemSlot[] = [
  {
    key: 'dao',
    systemId: 'MIND_DAO',
    label: '道',
    path: 'MIND_DAO',
    role: 'world-model',
    order: 10,
    enabled: true,
  },
  {
    key: 'fa',
    systemId: 'MIND_FA',
    label: '法',
    path: 'MIND_FA',
    role: 'principles',
    order: 20,
    enabled: true,
  },
  {
    key: 'shu',
    systemId: 'MIND_SHU',
    label: '术',
    path: 'MIND_SHU',
    role: 'methods',
    order: 30,
    enabled: true,
  },
  {
    key: 'qi',
    systemId: 'MIND_QI',
    label: '器',
    path: 'MIND_QI',
    role: 'tools-assets',
    order: 40,
    enabled: true,
  },
];

const assistantIds: Record<MindSystemSlot['key'], [string, string]> = {
  dao: ['daily-signal', 'decision-synthesizer'],
  fa: ['rule-keeper', 'boundary-reviewer'],
  shu: ['method-organizer', 'checklist-builder'],
  qi: ['tool-inventory', 'resource-auditor'],
};

function mindSystemRecords(
  overrides: Partial<Record<MindSystemSlot['key'], Partial<BuiltInMindSystemSpaceRecord>>> = {},
): BuiltInMindSystemSpaceRecord[] {
  return mindSystemSlots.map(slot => ({
    kind: 'builtin-mind-system',
    slot,
    fileCount: 0,
    description: '',
    assistantSummary: {
      assistants: assistantIds[slot.key].map((id, index) => ({
        id,
        schedule: { mode: slot.key === 'dao' && index === 0 ? 'daily' : 'manual' },
      })),
      draftCount: 0,
      instructionReady: true,
    },
    ...overrides[slot.key],
  }));
}

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
      root.render(<WikiHomeContent spaces={[]} recent={[]} mindSystemSpaces={mindSystemRecords()} />);
    });

    for (const slot of mindSystemSlots) {
      const card = host.querySelector<HTMLAnchorElement>(`a[href="/view/${slot.path}"]`);
      expect(card, `${slot.key} card`).not.toBeNull();
      expect(card?.textContent).toContain(slot.label);
    }
  });

  it('keeps the homepage Search button free of visible shortcut hints', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<WikiHomeContent spaces={[]} recent={[]} mindSystemSpaces={mindSystemRecords()} />);
    });

    const searchButton = host.querySelector('button[aria-label="Search"]');
    expect(searchButton).not.toBeNull();
    expect(searchButton?.textContent).not.toContain('⌘K');
  });

  it('uses Chinese framed theme-color icons for the four Mind System cards', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<WikiHomeContent spaces={[]} recent={[]} mindSystemSpaces={mindSystemRecords()} />);
    });

    for (const slot of mindSystemSlots) {
      const card = host.querySelector<HTMLAnchorElement>(`[data-mind-system-card="${slot.key}"]`);
      const icon = host.querySelector<HTMLElement>(`[data-mind-system-icon="${slot.key}"]`);

      expect(card?.className).toContain('rounded-lg');
      expect(card?.className).toContain('hover:border-[var(--amber)]/35');
      expect(icon?.textContent).toBe(slot.label);
      expect(icon?.className).toContain('h-9 w-9');
      expect(icon?.className).toContain('border-[var(--amber)]/35');
      expect(icon?.className).toContain('bg-[var(--amber-subtle)]');
    }
  });

  it('keeps Mind System homepage copy concise and card descriptions to one visual line', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(<WikiHomeContent spaces={[]} recent={[]} mindSystemSpaces={mindSystemRecords()} />);
    });

    const sectionDesc = host.querySelector<HTMLElement>('[data-mind-system-home-desc]');
    const daoDesc = host.querySelector<HTMLElement>('[data-mind-system-card-desc="dao"]');

    expect(sectionDesc?.textContent).toBe('Organize your knowledge with four built-in spaces.');
    expect(sectionDesc?.textContent).not.toContain('.mindos');
    expect(sectionDesc?.textContent).not.toContain('module registry');
    expect(daoDesc?.className).toContain('truncate');
    expect(daoDesc?.textContent).toBe('Values, direction, long-term judgment');
  });

  it('shows compact assistant counts without assistant internals or file status', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(
        <WikiHomeContent
          spaces={[]}
          recent={[]}
          mindSystemSpaces={mindSystemRecords({
            dao: {
              assistantSummary: {
                assistants: [
                  { id: 'daily-signal', schedule: { mode: 'daily' } },
                  { id: 'decision-synthesizer', schedule: { mode: 'manual' } },
                ],
                draftCount: 2,
                instructionReady: true,
              },
            },
          })}
        />,
      );
    });

    const daoCard = host.querySelector<HTMLElement>('[data-mind-system-card="dao"]');
    const summary = host.querySelector<HTMLElement>('[data-mind-system-card-assistant-summary="dao"]');

    expect(summary?.textContent).toContain('Assistants');
    expect(summary?.textContent).toContain('2');
    expect(daoCard?.textContent).not.toContain('Daily signal curator');
    expect(daoCard?.textContent).not.toContain('Decision synthesizer');
    expect(daoCard?.textContent).not.toContain('2 assistants');
    expect(daoCard?.textContent).not.toContain('2 drafts');
    expect(daoCard?.textContent).not.toContain('Instruction ready');
    expect(daoCard?.textContent).not.toContain('Instruction missing');
    expect(host.querySelector('[data-mind-system-home-assistant-icon="daily-signal"]')).toBeNull();
    expect(host.querySelector('[data-mind-system-home-assistant-icon="decision-synthesizer"]')).toBeNull();
    expect(host.querySelector('[data-mind-system-run-once="dao"]')).toBeNull();
  });

  it('hides missing instruction state on homepage cards', async () => {
    await act(async () => {
      root = createRoot(host);
      root.render(
        <WikiHomeContent
          spaces={[]}
          recent={[]}
          mindSystemSpaces={mindSystemRecords({
            dao: {
              assistantSummary: {
                assistants: [
                  { id: 'daily-signal', schedule: { mode: 'daily' } },
                  { id: 'decision-synthesizer', schedule: { mode: 'manual' } },
                ],
                draftCount: 0,
                instructionReady: false,
              },
            },
          })}
        />,
      );
    });

    const daoCard = host.querySelector<HTMLElement>('[data-mind-system-card="dao"]');

    expect(daoCard?.textContent).not.toContain('Instruction missing');
    expect(daoCard?.textContent).not.toContain('Instruction ready');
  });
});
