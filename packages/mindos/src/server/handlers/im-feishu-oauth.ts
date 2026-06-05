import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { json, type MindosServerResponse } from '../response.js';
import type { ImConfig } from './im-config.js';

export type FeishuOAuthUser = {
  name?: string;
  en_name?: string;
  avatar_url?: string;
  open_id?: string;
  union_id?: string;
  user_id?: string;
  email?: string;
};

export type FeishuOAuthExchangeInput = {
  appId: string;
  appSecret: string;
  code: string;
};

export type FeishuOAuthExchangeResult = FeishuOAuthUser & {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
};

export type ImFeishuOAuthServices = {
  configPath?: string;
  readConfig?(): ImConfig;
  writeConfig?(config: ImConfig): void;
  createState?(): string;
  now?(): Date;
  exchangeCode?(input: FeishuOAuthExchangeInput): Promise<FeishuOAuthExchangeResult>;
};

const DEFAULT_IM_CONFIG_PATH = join(homedir(), '.mindos', 'im.json');
const FEISHU_AUTH_URL = 'https://accounts.feishu.cn/open-apis/authen/v1/authorize';
const DEFAULT_OAUTH_TTL_MS = 10 * 60 * 1000;
const DEFAULT_REDIRECT_URI = 'http://127.0.0.1:4567/api/im/feishu/oauth/callback';

export function handleImFeishuOAuthGet(
  searchParams: URLSearchParams,
  services: ImFeishuOAuthServices = {},
): MindosServerResponse<
  | {
    ok: true;
    mode: 'oauth';
    authorizeUrl: string;
    qrLoginGoto: string;
    redirectUri: string;
    state: string;
    scopes: string[];
    expiresAt: string;
  }
  | {
    ok: false;
    mode: 'setup_required';
    error: string;
    setupUrl: string;
  }
  | { error: string }
> {
  try {
    const config = readConfig(services);
    const feishu = getFeishuConfig(config);
    if (!hasFeishuAppCredentials(feishu)) {
      return json({
        ok: false,
        mode: 'setup_required',
        error: 'Save Feishu App ID and App Secret before OAuth authorization.',
        setupUrl: 'https://open.feishu.cn/',
      }, { status: 422 });
    }

    const redirectUri = normalizeRedirectUri(searchParams.get('redirect_uri'), feishu);
    const scopes = parseScopes(searchParams.get('scope'));
    const state = services.createState ? services.createState() : randomBytes(18).toString('base64url');
    const now = getNow(services);
    const expiresAt = new Date(now.getTime() + DEFAULT_OAUTH_TTL_MS).toISOString();
    const authorizeUrl = buildAuthorizeUrl({
      appId: feishu.app_id,
      redirectUri,
      scopes,
      state,
    });

    feishu.oauth = {
      ...(typeof feishu.oauth === 'object' && feishu.oauth ? feishu.oauth : {}),
      pending: {
        state,
        redirect_uri: redirectUri,
        scopes,
        expires_at: expiresAt,
      },
    };
    config.providers.feishu = feishu;
    writeConfig(config, services);

    return json({
      ok: true,
      mode: 'oauth',
      authorizeUrl,
      qrLoginGoto: authorizeUrl,
      redirectUri,
      state,
      scopes,
      expiresAt,
    });
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Failed to create Feishu OAuth URL' }, { status: 500 });
  }
}

export async function handleImFeishuOAuthCallbackGet(
  searchParams: URLSearchParams,
  services: ImFeishuOAuthServices = {},
): Promise<MindosServerResponse<
  | { ok: true; platform: 'feishu'; user: FeishuOAuthUser }
  | { ok: false; error: string }
>> {
  try {
    const code = searchParams.get('code')?.trim();
    const state = searchParams.get('state')?.trim();
    if (!code || !state) {
      return json({ ok: false, error: 'Missing Feishu OAuth code or state.' }, { status: 400 });
    }

    const config = readConfig(services);
    const feishu = getFeishuConfig(config);
    if (!hasFeishuAppCredentials(feishu)) {
      return json({ ok: false, error: 'Feishu app credentials are missing. Save App ID and App Secret first.' }, { status: 422 });
    }

    const pending = feishu.oauth && typeof feishu.oauth === 'object' ? feishu.oauth.pending : undefined;
    if (!pending || pending.state !== state || isExpired(String(pending.expires_at ?? ''), getNow(services))) {
      return json({ ok: false, error: 'Invalid Feishu OAuth state. Start authorization again from MindOS.' }, { status: 400 });
    }

    const exchangeCode = services.exchangeCode ?? exchangeFeishuCode;
    const token = await exchangeCode({
      appId: feishu.app_id,
      appSecret: feishu.app_secret,
      code,
    });

    const now = getNow(services);
    const expiresIn = Number.isFinite(token.expires_in) ? Number(token.expires_in) : 7200;
    const user = pickUser(token);
    feishu.oauth = {
      status: 'connected',
      connected_at: now.toISOString(),
      user_access_token: token.access_token,
      refresh_token: token.refresh_token,
      expires_at: new Date(now.getTime() + expiresIn * 1000).toISOString(),
      user,
    };
    config.providers.feishu = feishu;
    writeConfig(config, services);

    return json({ ok: true, platform: 'feishu', user });
  } catch (error) {
    return json({ ok: false, error: error instanceof Error ? error.message : 'Failed to finish Feishu OAuth authorization.' }, { status: 502 });
  }
}

function buildAuthorizeUrl(input: { appId: string; redirectUri: string; scopes: string[]; state: string }): string {
  const url = new URL(FEISHU_AUTH_URL);
  url.searchParams.set('client_id', input.appId);
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('redirect_uri', input.redirectUri);
  url.searchParams.set('state', input.state);
  if (input.scopes.length > 0) {
    url.searchParams.set('scope', input.scopes.join(' '));
  }
  return url.toString();
}

function parseScopes(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(/[\s,]+/).map(s => s.trim()).filter(Boolean);
}

function normalizeRedirectUri(raw: string | null, feishu: Record<string, any>): string {
  if (raw && /^https?:\/\//.test(raw)) return raw;
  const conversation = feishu.conversation && typeof feishu.conversation === 'object' ? feishu.conversation : undefined;
  const publicBaseUrl = typeof conversation?.public_base_url === 'string' && conversation.public_base_url.trim()
    ? conversation.public_base_url.trim().replace(/\/+$/, '')
    : '';
  return publicBaseUrl ? `${publicBaseUrl}/api/im/feishu/oauth/callback` : DEFAULT_REDIRECT_URI;
}

function getFeishuConfig(config: ImConfig): Record<string, any> {
  config.providers ??= {};
  const feishu = config.providers.feishu;
  if (feishu && typeof feishu === 'object') return feishu;
  config.providers.feishu = {};
  return config.providers.feishu;
}

function hasFeishuAppCredentials(config: Record<string, any>): config is Record<string, any> & { app_id: string; app_secret: string } {
  return typeof config.app_id === 'string' && Boolean(config.app_id.trim())
    && typeof config.app_secret === 'string' && Boolean(config.app_secret.trim());
}

function isExpired(expiresAt: string, now: Date): boolean {
  const time = Date.parse(expiresAt);
  return !Number.isFinite(time) || time <= now.getTime();
}

function getNow(services: ImFeishuOAuthServices): Date {
  return services.now ? services.now() : new Date();
}

function pickUser(token: FeishuOAuthExchangeResult): FeishuOAuthUser {
  const user: FeishuOAuthUser = {};
  for (const key of ['name', 'en_name', 'avatar_url', 'open_id', 'union_id', 'user_id', 'email'] as const) {
    const value = token[key];
    if (typeof value === 'string' && value) user[key] = value;
  }
  return user;
}

async function exchangeFeishuCode(input: FeishuOAuthExchangeInput): Promise<FeishuOAuthExchangeResult> {
  const userTokenRes = await fetchJson('https://open.feishu.cn/open-apis/authen/v2/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      grant_type: 'authorization_code',
      client_id: input.appId,
      client_secret: input.appSecret,
      code: input.code,
    }),
  });
  const data = userTokenRes?.data ?? userTokenRes;
  if (!data?.access_token) {
    throw new Error(`Failed to obtain Feishu user_access_token: ${userTokenRes?.msg ?? 'unknown error'}`);
  }

  const userInfoRes = await fetchJson('https://open.feishu.cn/open-apis/authen/v1/user_info', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${data.access_token}`,
    },
  });
  const user = userInfoRes?.data ?? userInfoRes;
  return {
    ...data,
    ...pickUser(user as FeishuOAuthExchangeResult),
  } as FeishuOAuthExchangeResult;
}

async function fetchJson(url: string, init: RequestInit): Promise<any> {
  const res = await fetch(url, init);
  const jsonBody = await res.json().catch(() => ({}));
  if (!res.ok || (typeof jsonBody?.code === 'number' && jsonBody.code !== 0)) {
    throw new Error(jsonBody?.msg || `Feishu request failed with status ${res.status}`);
  }
  return jsonBody;
}

function readConfig(services: ImFeishuOAuthServices): ImConfig {
  if (services.readConfig) return services.readConfig();
  const configPath = services.configPath ?? DEFAULT_IM_CONFIG_PATH;
  try {
    if (!existsSync(configPath)) return { providers: {} };
    const parsed = JSON.parse(readFileSync(configPath, 'utf-8')) as ImConfig;
    if (!parsed || typeof parsed !== 'object' || !parsed.providers || typeof parsed.providers !== 'object') {
      return { providers: {} };
    }
    return parsed;
  } catch {
    return { providers: {} };
  }
}

function writeConfig(config: ImConfig, services: ImFeishuOAuthServices): void {
  if (services.writeConfig) {
    services.writeConfig(config);
    return;
  }
  const configPath = services.configPath ?? DEFAULT_IM_CONFIG_PATH;
  const dir = dirname(configPath);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmpPath = `${configPath}.tmp`;
  writeFileSync(tmpPath, `${JSON.stringify(config, null, 2)}\n`, 'utf-8');
  renameSync(tmpPath, configPath);
}
