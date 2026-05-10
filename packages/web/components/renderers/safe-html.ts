const HTML_ESCAPE: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPE[char]);
}

export function escapeAttribute(value: string): string {
  return escapeHtml(value).replace(/`/g, '&#96;');
}

function decodeBasicHtmlEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

export function safeHref(value: string): string {
  const decoded = decodeBasicHtmlEntities(value).trim();
  const compact = decoded.replace(/[\u0000-\u001f\u007f\s]+/g, '').toLowerCase();
  if (
    compact.startsWith('http://') ||
    compact.startsWith('https://') ||
    compact.startsWith('mailto:') ||
    (decoded.startsWith('/') && !decoded.startsWith('//')) ||
    decoded.startsWith('#')
  ) {
    return escapeAttribute(decoded);
  }
  return '#';
}
