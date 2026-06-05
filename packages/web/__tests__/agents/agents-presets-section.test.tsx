// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

import AgentsPresetsSection from '@/components/agents/AgentsPresetsSection';
import { getPresetStorageKey } from '@/components/agents/builtin-agent-presets';
import { messages } from '@/lib/i18n';

vi.mock('next/link', () => ({
  default: ({ children, ...props }: any) => <a {...props}>{children}</a>,
}));

vi.mock('@/lib/toast', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('AgentsPresetsSection', () => {
  beforeEach(() => {
    localStorage.clear();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('shows every run surface for the selected built-in agent', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AgentsPresetsSection copy={messages.en.agentsContent.presets} />);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('Review all pending captures');
    expect(host.textContent).toContain('Retry failed organize run');
    expect(host.textContent).toContain('Open from Inbox panel');

    await act(async () => {
      root.unmount();
    });
  });

  it('loads a saved prompt draft without marking it as unsaved', async () => {
    localStorage.setItem(getPresetStorageKey('inbox-agent'), 'Use a tighter review policy.');

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AgentsPresetsSection copy={messages.en.agentsContent.presets} />);
      await new Promise(r => setTimeout(r, 0));
    });

    const promptTab = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Prompt'));

    await act(async () => {
      promptTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    const textarea = host.querySelector('textarea');
    const saveButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Save draft'));
    const resetButton = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Reset'));

    expect(textarea?.value).toBe('Use a tighter review policy.');
    expect(host.textContent).toContain('Custom draft');
    expect(host.textContent).not.toContain('Unsaved changes');
    expect(saveButton?.hasAttribute('disabled')).toBe(true);
    expect(resetButton?.hasAttribute('disabled')).toBe(false);

    await act(async () => {
      root.unmount();
    });
  });

  it('keeps resources behind an explicit section instead of crowding the overview', async () => {
    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<AgentsPresetsSection copy={messages.en.agentsContent.presets} />);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('Runtime contract');
    expect(host.textContent).toContain('Run surfaces');
    expect(host.textContent).not.toContain('read_inbox');
    expect(host.textContent).not.toContain('workflow-to-skill');

    const resourcesTab = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Resources'));

    await act(async () => {
      resourcesTab!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await new Promise(r => setTimeout(r, 0));
    });

    expect(host.textContent).toContain('read_inbox');
    expect(host.textContent).toContain('workflow-to-skill');
    expect(host.textContent).toContain('Inbox files');

    await act(async () => {
      root.unmount();
    });
  });
});
