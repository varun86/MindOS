export const dynamic = 'force-dynamic';

import { handleBacklinks } from '@geminilight/mindos/server';
import { NextRequest } from 'next/server';
import { collectAllFiles, getContentVersion, getFileContent } from '@/lib/fs';
import { handleRouteErrorSimple } from '@/lib/errors';
import { toNextResponse } from '../_mindos-adapter';

export function GET(req: NextRequest) {
  try {
    return toNextResponse(handleBacklinks(req.nextUrl.searchParams, {
      collectAllFiles,
      readTextFile: getFileContent,
      // Stable function reference → the handler's link-index snapshot caches
      // across requests and rebuilds for content edits without forcing a
      // sidebar/tree refresh.
      getTreeVersion: getContentVersion,
    }));
  } catch (error) {
    return handleRouteErrorSimple(error);
  }
}
