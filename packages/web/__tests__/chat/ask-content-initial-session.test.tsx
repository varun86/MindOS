// @vitest-environment jsdom
/**
 * AskContent initialSessionId prop (spec-titlebar-row.md Phase 2, /chat route):
 * when the route already selected a session via loadSession, the init effect
 * must NOT run initSessions (its selection phase would clobber the route's
 * choice) — it refreshes session metadata instead. The default path (no
 * initialSessionId) keeps calling initSessions unchanged.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import AskContent from '@/components/ask/AskContent';
import type { ChatSession } from '@/lib/types';

const { mockInitSessions, mockRefreshSessions } = vi.hoisted(() => ({
  mockInitSessions: vi.fn(),
  mockRefreshSessions: vi.fn(() => Promise.resolve()),
}));

const emptySession: ChatSession = {
  id: 's1',
  createdAt: 1,
  updatedAt: 1,
  messages: [],
};

vi.mock('@/lib/ask-session-store', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ask-session-store')>();
  return { ...actual, refreshSessions: mockRefreshSessions };
});

vi.mock('@/lib/stores/locale-store', async () => {
  const { messages } = await import('@/lib/i18n');
  return {
    useLocale: () => ({ locale: 'en' as const, setLocale: vi.fn(), t: messages.en }),
  };
});

vi.mock('@/hooks/useAskSession', () => ({
  useAskSession: () => ({
    messages: [],
    sessions: [emptySession],
    activeSession: emptySession,
    activeSessionId: 's1',
    initSessions: mockInitSessions,
    persistSession: vi.fn(),
    clearPersistTimer: vi.fn(),
    setMessages: vi.fn(),
    setSessionDefaultAcpAgent: vi.fn(),
    setSessionAgentRuntimeBinding: vi.fn(),
    attachRuntimeSession: vi.fn(() => true),
    resetSession: vi.fn(),
    loadSession: vi.fn(),
    deleteSession: vi.fn(),
    renameSession: vi.fn(),
    togglePinSession: vi.fn(),
    clearSessions: vi.fn(),
    clearAllSessions: vi.fn(),
  }),
}));

vi.mock('@/hooks/useFileUpload', () => ({
  useFileUpload: () => ({
    localAttachments: [],
    uploadError: '',
    uploadInputRef: { current: null },
    clearAttachments: vi.fn(),
    removeAttachment: vi.fn(),
    pickFiles: vi.fn(),
    injectFiles: vi.fn(),
  }),
}));

vi.mock('@/hooks/useImageUpload', () => ({
  useImageUpload: () => ({
    images: [],
    imageError: '',
    clearImages: vi.fn(),
    removeImage: vi.fn(),
    handlePaste: vi.fn(),
    handleDrop: vi.fn(),
    handleFileSelect: vi.fn(),
    addImages: vi.fn(),
  }),
}));

vi.mock('@/hooks/useMention', () => ({
  useMention: () => ({
    mentionQuery: null,
    mentionResults: [],
    mentionIndex: 0,
    resetMention: vi.fn(),
    updateMentionFromInput: vi.fn(),
    navigateMention: vi.fn(),
  }),
}));

vi.mock('@/hooks/useSlashCommand', () => ({
  useSlashCommand: () => ({
    slashQuery: null,
    slashResults: [],
    slashIndex: 0,
    resetSlash: vi.fn(),
    updateSlashFromInput: vi.fn(),
    navigateSlash: vi.fn(),
  }),
}));

vi.mock('@/hooks/useNativeRuntimeDetection', () => ({
  useNativeRuntimeDetection: () => ({
    runtimes: [],
    loadingByKind: {},
    errorByKind: {},
    refresh: vi.fn(),
  }),
}));

vi.mock('@/components/ask/MessageList', () => ({ default: () => <div data-testid="message-list" /> }));
vi.mock('@/components/ask/MentionPopover', () => ({ default: () => null }));
vi.mock('@/components/ask/SlashCommandPopover', () => ({ default: () => null }));
vi.mock('@/components/ask/SessionHistoryPanel', () => ({ default: () => null }));
vi.mock('@/components/ask/AskHeader', () => ({ default: () => null }));
vi.mock('@/components/ask/FileChip', () => ({ default: () => null }));
vi.mock('@/components/ask/ProviderModelCapsule', () => ({
  default: () => null,
  getPersistedProviderModel: () => ({ provider: null, model: null }),
}));
vi.mock('@/components/ask/ModeCapsule', () => ({
  default: () => null,
  getPersistedMode: () => 'agent',
}));
vi.mock('@/lib/agent/stream-consumer', () => ({
  consumeUIMessageStream: () => new Promise(() => {}),
}));

async function renderAskContent(props: Partial<React.ComponentProps<typeof AskContent>> = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(<AskContent visible variant="home" {...props} />);
  });
  await act(async () => {
    await Promise.resolve();
  });
  return { host, root };
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.body.innerHTML = '';
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  vi.stubGlobal('fetch', vi.fn(() => Promise.resolve({
    ok: true,
    json: async () => ([]),
    body: new ReadableStream(),
  } as unknown as Response)));
});

describe('AskContent initialSessionId', () => {
  it('skips initSessions and refreshes metadata when initialSessionId is provided', async () => {
    await renderAskContent({ initialSessionId: 's1', maximized: true });

    expect(mockInitSessions).not.toHaveBeenCalled();
    expect(mockRefreshSessions).toHaveBeenCalledTimes(1);
  });

  it('still calls initSessions on open without initialSessionId', async () => {
    await renderAskContent();

    expect(mockInitSessions).toHaveBeenCalledTimes(1);
    expect(mockRefreshSessions).not.toHaveBeenCalled();
  });

  it('keeps the rest of the open path working with initialSessionId (initialMessage applied)', async () => {
    const { host } = await renderAskContent({ initialSessionId: 's1', initialMessage: 'hello from route' });

    const textarea = host.querySelector('textarea');
    expect(textarea?.value).toBe('hello from route');
  });
});
