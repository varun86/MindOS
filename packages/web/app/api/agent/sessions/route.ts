export const dynamic = 'force-dynamic';

import {
  handleAgentSessionsDelete,
  handleAgentSessionsGet,
  handleAgentSessionsPost,
} from '@geminilight/mindos/server';
import { NextRequest } from 'next/server';
import { toNextResponse } from '../../_mindos-adapter';

export function GET() {
  return toNextResponse(handleAgentSessionsGet());
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  return toNextResponse(handleAgentSessionsPost(body));
}

export async function DELETE(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = undefined;
  }
  return toNextResponse(handleAgentSessionsDelete(body));
}
