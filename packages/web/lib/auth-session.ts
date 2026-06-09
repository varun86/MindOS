export const WEB_SESSION_COOKIE_NAME = 'mindos-session';
export const WEB_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export type LoginMode = 'login' | 'reauth';

export function resolveWebSessionSecret(webPassword: string, webSessionSecret?: string): string {
  const stableSecret = webSessionSecret?.trim();
  return stableSecret || webPassword;
}

export function sanitizeLoginRedirect(rawRedirect: string | null | undefined): string {
  if (!rawRedirect) return '/';
  return rawRedirect.startsWith('/') && !rawRedirect.startsWith('//')
    ? rawRedirect
    : '/';
}

export function buildLoginRedirectTarget(pathname: string, search = ''): string | null {
  const normalizedPathname = pathname || '/';
  const normalizedSearch = search
    ? (search.startsWith('?') ? search : `?${search}`)
    : '';
  const target = `${normalizedPathname}${normalizedSearch}`;
  return target === '/' ? null : target;
}

export function resolveLoginMode(
  reason: string | null | undefined,
  hadPreviousBrowserSession: boolean,
): LoginMode {
  return reason === 'expired' || hadPreviousBrowserSession ? 'reauth' : 'login';
}
