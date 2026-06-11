import ChatPageClient from './ChatPageClient';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ sessionId: string }>;
}

/**
 * /chat/[sessionId] — full-page chat for one session (spec-titlebar-row Phase 2).
 *
 * The session stores are client-side; this server page only unwraps the route
 * param. 'new' is the creation flow: the client creates a session via the
 * shared store and replaces the URL with the real id.
 */
export default async function ChatPage({ params }: PageProps) {
  const { sessionId } = await params;
  return <ChatPageClient sessionId={sessionId} />;
}
