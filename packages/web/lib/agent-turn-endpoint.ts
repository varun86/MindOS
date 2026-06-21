export function buildAgentTurnEndpoint(sessionId: string): string {
  return `/api/agent/sessions/${encodeURIComponent(sessionId)}/turns`;
}

export function createTransientAgentSessionId(prefix: string): string {
  const safePrefix = prefix.trim().toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '') || 'turn';
  return `${safePrefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
