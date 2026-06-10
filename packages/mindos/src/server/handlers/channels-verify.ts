import { json, type MindosServerResponse } from '../response.js';
import {
  isChannelPlatform,
  validateChannelCredentials,
  type ChannelPlatform,
} from '../channel-contract.js';

export type ChannelsVerifyPayload = {
  platform?: string;
  credentials?: unknown;
};

export type ChannelsVerifyResult = {
  ok: boolean;
  botName?: string;
  botId?: string;
  error?: string;
};

export type ChannelsVerifyServices = {
  verifyCredentials?(platform: ChannelPlatform, credentials: unknown): Promise<ChannelsVerifyResult>;
};

export async function handleChannelsVerifyPost(
  body: ChannelsVerifyPayload | unknown,
  services: ChannelsVerifyServices = {},
): Promise<MindosServerResponse<ChannelsVerifyResult | { ok: false; error: string }>> {
  try {
    const payload = body && typeof body === 'object' ? body as ChannelsVerifyPayload : {};
    const platform = payload.platform;
    const credentials = payload.credentials;

    if (!platform || !isChannelPlatform(platform)) {
      return json({ ok: false, error: 'Invalid platform' }, { status: 400 });
    }

    if (!credentials || typeof credentials !== 'object') {
      return json({ ok: false, error: 'Missing credentials' }, { status: 400 });
    }

    const validation = validateChannelCredentials(platform, credentials);
    if (!validation.valid) {
      return json(
        { ok: false, error: `Missing required fields: ${validation.missing?.join(', ') || 'unknown'}` },
        { status: 400 },
      );
    }

    const verifier = services.verifyCredentials ?? defaultVerifier;
    const result = await verifier(platform, credentials);
    if (!result.ok) {
      return json({ ok: false, error: result.error || 'Credential verification failed' }, { status: 401 });
    }

    return json({
      ok: true,
      botName: result.botName,
      botId: result.botId,
    });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : String(error) }, { status: 500 });
  }
}

async function defaultVerifier(): Promise<ChannelsVerifyResult> {
  return { ok: false, error: 'Credential verifier is not configured' };
}
