// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { useInboxOrganizeController } from '@/hooks/useInboxOrganizeController';
import type { InboxOrganizeFile } from '@/hooks/useInboxOrganizeController';

const toastError = vi.hoisted(() => vi.fn());

vi.mock('@/lib/toast', () => ({
  toast: {
    error: toastError,
  },
}));

const startMock = vi.fn();
const resultMock = vi.fn();

const aiOrganize = {
  phase: 'idle',
  changes: [],
  start: startMock,
};

const labels = {
  organizeNoAi: 'Configure an AI API key before running the Inbox Agent. Capture still works without AI.',
  organizeFailed: 'Inbox Agent failed.',
};

function InboxOrganizeHarness({ files }: { files: InboxOrganizeFile[] }) {
  const controller = useInboxOrganizeController({
    aiOrganize: aiOrganize as unknown as Parameters<typeof useInboxOrganizeController>[0]['aiOrganize'],
    labels,
  });

  useEffect(() => {
    void controller.requestInboxOrganize(files).then(resultMock);
  }, [controller, files]);

  return null;
}

describe('useInboxOrganizeController', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  });

  it('starts Inbox Agent with the active provider from Settings instead of showing the missing-key toast', async () => {
    const files = [{ name: 'capture.md', path: 'Inbox/capture.md' }];
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url === '/api/settings') {
        return {
          ok: true,
          json: async () => ({
            ai: {
              activeProvider: 'p_openai01',
              providers: [
                { id: 'p_openai01', name: 'OpenAI', protocol: 'openai', apiKey: 'sk-openai-test', model: 'gpt-5.4', baseUrl: '' },
              ],
            },
            envOverrides: {},
          }),
        };
      }
      if (url.startsWith('/api/file?')) {
        return {
          ok: true,
          json: async () => ({ content: 'Inbox capture content' }),
        };
      }
      throw new Error(`Unexpected fetch: ${url}`);
    }));

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(<InboxOrganizeHarness files={files} />);
      await new Promise(r => setTimeout(r, 0));
    });

    expect(toastError).not.toHaveBeenCalledWith(labels.organizeNoAi, expect.anything());
    expect(startMock).toHaveBeenCalledTimes(1);
    expect(startMock).toHaveBeenCalledWith(
      [{ name: 'capture.md', content: 'Inbox capture content' }],
      expect.stringContaining('capture.md'),
      'inbox-organize',
      {},
    );
    expect(resultMock).toHaveBeenCalledWith({ started: true });

    await act(async () => {
      root.unmount();
    });
  });
});
