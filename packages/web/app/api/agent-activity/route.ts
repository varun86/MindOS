export const dynamic = 'force-dynamic';

import { handleAgentActivity, handleAgentActivityPost, json } from '@geminilight/mindos/server';
import { NextRequest } from 'next/server';
import { getMindRoot } from '@/lib/fs';
import { handleRouteErrorSimple } from '@/lib/errors';
import { toNextResponse } from '../_mindos-adapter';

export async function GET(req: NextRequest) {
  try {
    return toNextResponse(await handleAgentActivity(req.nextUrl.searchParams, {
      mindRoot: getMindRoot(),
    }));
  } catch (error) {
    return handleRouteErrorSimple(error);
  }
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return toNextResponse(json({ error: 'invalid JSON' }, { status: 400 }));
  }

  try {
    return toNextResponse(handleAgentActivityPost(body, {
      mindRoot: getMindRoot(),
    }));
  } catch (error) {
    return handleRouteErrorSimple(error);
  }
}
