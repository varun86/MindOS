import { beforeEach, describe, expect, it, vi } from 'vitest';

const hasAnyIMConfig = vi.fn();
const listConfiguredIM = vi.fn();
const getPlatformConfig = vi.fn();

vi.mock('@/lib/im/config', () => ({
  getPlatformConfig,
  hasAnyIMConfig,
}));

vi.mock('@/lib/im/executor', () => ({
  listConfiguredIM,
}));

vi.mock('@/lib/im/webhook/feishu', () => {
  throw new Error('status route must not import Feishu webhook processing');
});

async function importRoute() {
  return await import('../../app/api/im/status/route');
}

describe('GET /api/im/status', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('returns Feishu status without loading webhook processing or agent runtime', async () => {
    hasAnyIMConfig.mockReturnValue(true);
    listConfiguredIM.mockResolvedValue([
      {
        platform: 'feishu',
        connected: false,
        capabilities: ['text', 'markdown'],
      },
    ]);
    getPlatformConfig.mockReturnValue({
      app_id: 'cli_xxx',
      app_secret: 'secret',
      conversation: {
        enabled: true,
        encrypt_key: 'encrypt',
        public_base_url: 'https://mindos.example.com/',
      },
    });

    const { GET } = await importRoute();
    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      platforms: [
        expect.objectContaining({
          platform: 'feishu',
          webhook: {
            platform: 'feishu',
            state: 'ready',
            transport: 'webhook',
            publicBaseUrl: 'https://mindos.example.com',
            webhookUrl: 'https://mindos.example.com/api/im/webhook/feishu',
          },
          oauth: {
            state: 'disconnected',
          },
        }),
      ],
    });
  });
});
