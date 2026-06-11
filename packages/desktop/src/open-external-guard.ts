/**
 * Guard for shell.openExternal — only web/mail URLs may leave the app.
 *
 * The navigation-deny path receives arbitrary URLs from renderer content
 * (remote mode renders pages from a remote server). Passing file://, UNC
 * paths, or OS scheme handlers (ms-msdt: etc.) to openExternal can execute
 * local programs on Windows, so everything outside the allowlist is dropped.
 */
const SAFE_EXTERNAL_PROTOCOLS = new Set(['http:', 'https:', 'mailto:']);

export function isSafeExternalUrl(url: string): boolean {
  if (typeof url !== 'string' || !url.trim()) return false;
  // UNC paths (\\server\share) parse as file-ish or throw depending on form — reject early
  if (url.startsWith('\\\\') || url.startsWith('//')) return false;
  try {
    const parsed = new URL(url);
    return SAFE_EXTERNAL_PROTOCOLS.has(parsed.protocol.toLowerCase());
  } catch {
    return false;
  }
}
