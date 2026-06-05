import { NextRequest } from 'next/server';
import { handleImFeishuOAuthGet, type ImFeishuOAuthServices } from '@geminilight/mindos/server';
import { readIMConfig, writeIMConfig } from '@/lib/im/config';
import { toNextResponse } from '../../../_mindos-adapter';

const services: ImFeishuOAuthServices = {
  readConfig: readIMConfig as ImFeishuOAuthServices['readConfig'],
  writeConfig: writeIMConfig as ImFeishuOAuthServices['writeConfig'],
};

export function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (!url.searchParams.get('redirect_uri')) {
    url.searchParams.set('redirect_uri', `${url.origin}/api/im/feishu/oauth/callback`);
  }
  return toNextResponse(handleImFeishuOAuthGet(url.searchParams, services));
}
