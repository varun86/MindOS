export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

import { handleAgentSessionTurnRouteRequest } from '../../../../ask/runner';

export async function POST(
  req: Request,
  context: { params: Promise<{ sessionId: string }> | { sessionId: string } },
) {
  return handleAgentSessionTurnRouteRequest(req, context);
}
