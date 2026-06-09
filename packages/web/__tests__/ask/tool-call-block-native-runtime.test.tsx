// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import ToolCallBlock from '@/components/ask/ToolCallBlock';
import type { ToolCallPart } from '@/lib/types';

function renderToolCall(part: ToolCallPart) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  act(() => {
    root.render(<ToolCallBlock part={part} />);
  });

  return {
    host,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      host.remove();
    },
  };
}

describe('ToolCallBlock native runtime rendering', () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
    (globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('renders Claude Code Bash calls with local approval guidance', () => {
    const view = renderToolCall({
      type: 'tool-call',
      toolCallId: 'tool-claude-bash',
      toolName: 'Bash',
      runtime: 'claude',
      state: 'running',
      input: {
        command: 'mindos file delete "Profile.md"',
        description: 'Delete the profile note',
      },
    });

    expect(view.host.textContent).toContain('Claude Code');
    expect(view.host.textContent).toContain('Bash');
    expect(view.host.textContent).toContain('mindos file delete "Profile.md"');
    expect(view.host.textContent).toContain('Local approval may be required');
    expect(view.host.textContent).toContain('MindOS can approve or deny it here');

    view.cleanup();
  });

  it('renders actionable runtime permission controls', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ ok: true }) });
    vi.stubGlobal('fetch', fetchMock);

    const view = renderToolCall({
      type: 'tool-call',
      toolCallId: 'cmd-1',
      toolName: 'Bash',
      runtime: 'codex',
      state: 'running',
      input: {
        command: 'mindos file delete "Profile.md"',
      },
      runtimePermission: {
        runId: 'run-1',
        requestId: 'perm-1',
        runtime: 'codex',
        status: 'waiting',
        options: [
          { id: 'accept', label: 'Allow once', intent: 'allow' },
          { id: 'decline', label: 'Deny', intent: 'deny' },
        ],
      },
    });

    expect(view.host.textContent).toContain('Codex permission request');
    expect(view.host.textContent).toContain('Allow once');
    expect(view.host.textContent).toContain('Deny');

    const allowButton = Array.from(view.host.querySelectorAll('button'))
      .find((button) => button.textContent?.includes('Allow once'));
    expect(allowButton).toBeTruthy();

    await act(async () => {
      allowButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/ask/runtime-permission', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        runId: 'run-1',
        requestId: 'perm-1',
        decision: 'accept',
      }),
    }));

    view.cleanup();
    vi.unstubAllGlobals();
  });

  it('renders Codex command output in a native runtime card', () => {
    const view = renderToolCall({
      type: 'tool-call',
      toolCallId: 'tool-codex-bash',
      toolName: 'Bash',
      runtime: 'codex',
      state: 'done',
      input: 'mindos search "permission"',
      output: 'Found 3 notes.',
    });

    expect(view.host.textContent).toContain('Codex');
    expect(view.host.textContent).toContain('mindos search "permission"');
    expect(view.host.textContent).toContain('Found 3 notes.');
    expect(view.host.textContent).not.toContain('only mirrors');

    view.cleanup();
  });
});
