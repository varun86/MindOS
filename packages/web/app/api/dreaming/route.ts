export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { getMindRoot } from '@/lib/fs';
import { loadLatestDreamingRun, runDreaming } from '@/lib/dreaming';
import { handleRouteErrorSimple } from '@/lib/errors';

export async function GET() {
  try {
    const latest = loadLatestDreamingRun(getMindRoot());
    return NextResponse.json({ latest });
  } catch (e) {
    return handleRouteErrorSimple(e);
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({})) as { space?: unknown; dryRun?: unknown };
    const space = typeof body.space === 'string' && body.space.trim() ? body.space.trim() : undefined;
    const run = runDreaming(getMindRoot(), {
      space,
      writeArtifacts: body.dryRun !== true,
    });
    return NextResponse.json(run);
  } catch (e) {
    return handleRouteErrorSimple(e);
  }
}
