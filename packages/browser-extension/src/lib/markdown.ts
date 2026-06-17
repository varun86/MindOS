/* ── Markdown Conversion Pipeline ── */

import type { PageContent, ClipDocument } from './types';

/** Sanitize a string for use as filename */
export function sanitizeFileName(title: string): string {
  return title
    .replace(/[\/\\?*:|"<>]/g, '-')  // illegal fs chars
    .replace(/\s+/g, ' ')            // collapse whitespace
    .replace(/^\.+/, '')             // no leading dots
    .trim()
    .slice(0, 120)                   // cap length
    || 'Untitled';
}

/** Generate YAML frontmatter block */
function frontmatter(meta: Record<string, string | null | undefined>): string {
  const lines = ['---'];
  // YAML reserved words and special patterns that need quoting
  const yamlReserved = /^(true|false|null|yes|no|on|off|~)$/i;
  const yamlSpecialStart = /^[*&!@`>|%-]/;

  for (const [key, val] of Object.entries(meta)) {
    if (val == null || val === '') continue;
    // Collapse newlines (YAML scalar values must be single-line in flow style)
    const clean = val.replace(/[\r\n]+/g, ' ').trim();
    // Quote if value contains YAML-special characters or is a reserved word
    const needsQuote = clean.includes(':') || clean.includes('#') || clean.includes("'")
      || clean.includes('"') || clean.includes('[') || clean.includes('{')
      || yamlReserved.test(clean) || yamlSpecialStart.test(clean);
    const safe = needsQuote
      ? `"${clean.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
      : clean;
    lines.push(`${key}: ${safe}`);
  }
  lines.push('---', '');
  return lines.join('\n');
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Convert extracted PageContent → ClipDocument */
export function toClipDocument(
  page: PageContent,
  space: string,
  turndownHtml: (html: string) => string,
): ClipDocument {
  const fileName = sanitizeFileName(page.title) + '.md';

  // Convert HTML content to Markdown
  const bodyMd = turndownHtml(page.content);
  const capturedAt = page.savedAt || new Date().toISOString();
  const capturedDate = new Date(capturedAt);
  const created = Number.isNaN(capturedDate.getTime())
    ? formatLocalDate(new Date())
    : formatLocalDate(capturedDate);
  const isAiConversation = page.captureType === 'ai-conversation';

  // Build frontmatter
  const fm = frontmatter({
    title: page.title,
    type: isAiConversation ? 'log' : 'material',
    status: 'active',
    created,
    source_type: page.sourceType ?? (isAiConversation ? 'session' : 'web'),
    source_url: page.url,
    source_platform: page.sourcePlatform,
    captured_at: capturedAt,
  });

  const sourceNote = buildSourceNote(page);
  const markdown = `${fm}# ${page.title}\n\n${sourceNote}${bodyMd}\n`;

  return {
    fileName,
    markdown,
    space,
    wordCount: page.wordCount,
    source: isAiConversation ? 'ai-conversation-clipper' : 'web-clipper',
  };
}

function buildSourceNote(page: PageContent): string {
  if (page.captureType === 'ai-conversation') {
    const platform = page.sourcePlatformLabel || page.siteName || page.sourcePlatform || 'AI chat';
    const count = page.messageCount != null ? `${page.messageCount} messages` : 'conversation';
    return `> Captured from ${platform} (${count}).\n\n`;
  }

  const notes = [
    page.byline ? `Author: ${page.byline}` : null,
    page.siteName ? `Site: ${page.siteName}` : null,
    page.excerpt ? `Excerpt: ${page.excerpt}` : null,
  ].filter((line): line is string => Boolean(line));
  return notes.length > 0 ? `${notes.map(line => `> ${line}`).join('\n')}\n\n` : '';
}
