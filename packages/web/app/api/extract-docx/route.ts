export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextRequest } from 'next/server';
import { handleExtractDocxPost } from '@geminilight/mindos/server';
import { toNextResponse } from '../_mindos-adapter';

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  return toNextResponse(await handleExtractDocxPost(body));
}
