export type DesktopRendererMode = 'local' | 'remote';

export interface RendererTrustSnapshot {
  currentMode: DesktopRendererMode;
  currentWebPort?: number;
  currentRemoteAddress?: string;
  senderMatchesMainWindow: boolean;
  senderUrl?: string;
  mainWindowUrl?: string;
}

export interface NavigationTrustSnapshot {
  currentMode: DesktopRendererMode;
  currentWebPort?: number;
  currentRemoteAddress?: string;
}

const LOOPBACK_HOSTS = new Set(['127.0.0.1', 'localhost', '::1', '[::1]']);

export function trustedLocalRendererError(capability: string): Error {
  return new Error(`Blocked desktop IPC capability from untrusted renderer: ${capability}`);
}

export function isTrustedLocalRenderer(snapshot: RendererTrustSnapshot): boolean {
  if (snapshot.currentMode !== 'local') return false;
  if (!snapshot.senderMatchesMainWindow) return false;
  if (typeof snapshot.currentWebPort !== 'number') return false;
  if (!isManagedLocalWebUrl(snapshot.senderUrl, snapshot.currentWebPort)) return false;
  if (snapshot.mainWindowUrl && !isManagedLocalWebUrl(snapshot.mainWindowUrl, snapshot.currentWebPort)) {
    return false;
  }
  return true;
}

export function isAllowedMainWindowNavigation(
  targetUrl: string | undefined,
  snapshot: NavigationTrustSnapshot,
): boolean {
  if (snapshot.currentMode === 'local') {
    return typeof snapshot.currentWebPort === 'number' &&
      isManagedLocalWebUrl(targetUrl, snapshot.currentWebPort);
  }

  const target = parseUrl(targetUrl);
  const remote = parseUrl(snapshot.currentRemoteAddress);
  if (!target || !remote) return false;
  return target.origin === remote.origin;
}

function isManagedLocalWebUrl(value: string | undefined, expectedPort: number): boolean {
  const url = parseUrl(value);
  if (!url) return false;
  if (url.protocol !== 'http:') return false;
  if (!LOOPBACK_HOSTS.has(url.hostname)) return false;
  return Number(url.port || '80') === expectedPort;
}

function parseUrl(value: string | undefined): URL | null {
  if (!value) return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}
