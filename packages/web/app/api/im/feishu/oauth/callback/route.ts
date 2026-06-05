import { NextRequest } from 'next/server';
import { handleImFeishuOAuthCallbackGet, type ImFeishuOAuthServices } from '@geminilight/mindos/server';
import { readIMConfig, writeIMConfig } from '@/lib/im/config';
import { toNextResponse } from '../../../../_mindos-adapter';

const services: ImFeishuOAuthServices = {
  readConfig: readIMConfig as ImFeishuOAuthServices['readConfig'],
  writeConfig: writeIMConfig as ImFeishuOAuthServices['writeConfig'],
};

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  return toNextResponse(await handleImFeishuOAuthCallbackGet(url.searchParams, services));
}
