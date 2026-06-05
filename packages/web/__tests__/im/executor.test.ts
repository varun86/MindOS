import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/im/config', () => ({
  getConfiguredPlatforms: vi.fn(() => ['telegram']),
  getIMConfigMtime: vi.fn(() => 0),
  getPlatformConfig: vi.fn(() => ({ bot_token: '123:ABC' })),
}));

vi.mock('@/lib/im/adapters/telegram', () => ({
  TelegramAdapter: class {
    verify() {
      return new Promise<boolean>(() => {});
    }

    dispose() {
      return Promise.resolve();
    }
  },
}));

vi.mock('@/lib/im/activity', () => ({
  recordActivity: vi.fn(),
}));

describe('IM executor status listing', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(async () => {
    const { disposeAllAdapters } = await import('@/lib/im/executor');
    await disposeAllAdapters();
    vi.useRealTimers();
    vi.resetModules();
  });

  it('does not block status listing when platform verification hangs', async () => {
    const { listConfiguredIM } = await import('@/lib/im/executor');

    const resultPromise = listConfiguredIM();
    await vi.advanceTimersByTimeAsync(3000);

    await expect(resultPromise).resolves.toEqual([
      expect.objectContaining({
        platform: 'telegram',
        connected: false,
        capabilities: expect.arrayContaining(['text', 'markdown']),
      }),
    ]);
  });
});
