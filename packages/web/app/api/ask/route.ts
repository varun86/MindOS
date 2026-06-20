export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { handleAskRouteRequest } from './runner';

export async function POST(req: Request) {
  return handleAskRouteRequest(req);
}
