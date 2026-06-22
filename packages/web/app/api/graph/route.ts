export const dynamic = 'force-dynamic';

import { handleGraph } from '@geminilight/mindos/server';
import { collectAllFiles, getContentVersion, getFileContent } from '@/lib/fs';
import { handleRouteErrorSimple } from '@/lib/errors';
import { toNextResponse } from '../_mindos-adapter';
import type { NextRequest } from 'next/server';
export type { GraphData, GraphDirection, GraphEdge, GraphNode, GraphScope, GraphStats } from '@geminilight/mindos/server';

export function GET(req: NextRequest) {
  try {
    return toNextResponse(handleGraph(req.nextUrl.searchParams, {
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
