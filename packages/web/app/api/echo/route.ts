export const dynamic = 'force-dynamic';

import { revalidatePath } from 'next/cache';
import { NextRequest, NextResponse } from 'next/server';
import {
  listEchoItems,
  normalizeEchoStoredSegment,
  readEchoItemDetail,
  saveEchoDraft,
  saveEchoItem,
} from '@/lib/echo-store';
import { appendContentChange, getMindRoot, invalidateCache } from '@/lib/fs';
import { handleRouteErrorSimple } from '@/lib/errors';

type EchoPostBody = {
  op?: unknown;
  segment?: unknown;
  markdown?: unknown;
  assistantId?: unknown;
  title?: unknown;
};

export async function GET(req: NextRequest) {
  try {
    const segment = normalizeEchoStoredSegment(req.nextUrl.searchParams.get('segment'));
    if (req.nextUrl.searchParams.has('segment') && !segment) {
      return NextResponse.json({ error: 'invalid segment' }, { status: 400 });
    }

    const itemPath = req.nextUrl.searchParams.get('path');
    if (itemPath != null) {
      if (!segment) return NextResponse.json({ error: 'segment is required' }, { status: 400 });
      const item = readEchoItemDetail(getMindRoot(), segment, itemPath);
      if (!item) return NextResponse.json({ error: 'Echo item not found' }, { status: 404 });
      return NextResponse.json({ item });
    }

    return NextResponse.json(listEchoItems(getMindRoot(), segment ?? undefined));
  } catch (e) {
    return handleRouteErrorSimple(e);
  }
}

export async function POST(req: NextRequest) {
  let body: EchoPostBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON' }, { status: 400 });
  }

  try {
    const op = typeof body.op === 'string' ? body.op : '';
    const segment = normalizeEchoStoredSegment(body.segment);
    const markdown = typeof body.markdown === 'string' ? body.markdown.trim() : '';
    const assistantId = typeof body.assistantId === 'string' && body.assistantId.trim()
      ? body.assistantId.trim()
      : undefined;
    const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : undefined;

    if (!segment) return NextResponse.json({ error: 'invalid segment' }, { status: 400 });
    if (!markdown) return NextResponse.json({ error: 'missing markdown' }, { status: 400 });

    if (op === 'draft') {
      const draft = saveEchoDraft(getMindRoot(), { segment, markdown, assistantId, title });
      return NextResponse.json({ ok: true, draft });
    }

    if (op === 'save') {
      const result = saveEchoItem(getMindRoot(), { segment, markdown, assistantId, title });
      invalidateCache();
      try { revalidatePath('/', 'layout'); } catch { /* noop in test env */ }
      try {
        appendContentChange({
          op: 'create_file',
          path: result.item.path,
          source: 'user',
          summary: `Saved Echo ${segment} note`,
          after: result.content,
        });
      } catch (logError) {
        console.warn('[echo.route] failed to append content change log:', (logError as Error).message);
      }
      return NextResponse.json({ ok: true, item: result.item });
    }

    return NextResponse.json({ error: 'unknown op' }, { status: 400 });
  } catch (e) {
    return handleRouteErrorSimple(e);
  }
}
