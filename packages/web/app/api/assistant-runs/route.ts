export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { NextResponse } from 'next/server';
import { AssistantRunError, runAssistant } from '@/lib/assistant-runs';
import { handleRouteErrorSimple } from '@/lib/errors';

export async function POST(req: Request) {
  const body = await readJsonBody(req);

  try {
    return NextResponse.json(runAssistant(body));
  } catch (error) {
    if (error instanceof AssistantRunError) {
      return NextResponse.json(
        { ok: false, error: { code: error.code, message: error.message } },
        { status: error.status },
      );
    }
    return handleRouteErrorSimple(error);
  }
}

async function readJsonBody(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}
