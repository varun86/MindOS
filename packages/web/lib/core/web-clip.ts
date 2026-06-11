import { JSDOM } from 'jsdom';
import { Readability } from '@mozilla/readability';
import TurndownService from 'turndown';
import { detectSourcePlatform } from '@/lib/link-preview/source-platforms';

export interface WebClipResult {
  title: string;
  markdown: string;
  fileName: string;
  wordCount: number;
  url: string;
  siteName: string | null;
  byline: string | null;
  mode: 'article' | 'link';
}

export interface WebFileCaptureResult {
  title: string;
  fileName: string;
  contentBase64: string;
  contentType: string;
  byteLength: number;
  wordCount: 0;
  url: string;
  siteName: string | null;
  byline: null;
  mode: 'file';
}

export type UrlCaptureResult = WebClipResult | WebFileCaptureResult;

const FETCH_TIMEOUT_MS = 15_000;
const MAX_HTML_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_CAPTURE_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_REDIRECTS = 5;

interface RemoteBinaryFileType {
  extensions: string[];
  preferredExtension: string;
  contentTypes: string[];
}

const REMOTE_BINARY_FILE_TYPES: RemoteBinaryFileType[] = [
  { extensions: ['.pdf'], preferredExtension: '.pdf', contentTypes: ['application/pdf', 'application/x-pdf'] },
  { extensions: ['.png'], preferredExtension: '.png', contentTypes: ['image/png'] },
  { extensions: ['.jpg', '.jpeg'], preferredExtension: '.jpg', contentTypes: ['image/jpeg', 'image/pjpeg'] },
  { extensions: ['.webp'], preferredExtension: '.webp', contentTypes: ['image/webp'] },
  { extensions: ['.gif'], preferredExtension: '.gif', contentTypes: ['image/gif'] },
];

/**
 * Validates a URL string. Only http/https schemes allowed.
 */
export function isValidUrl(input: string): boolean {
  try {
    const u = new URL(input);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeHttpUrlForFetch(input: string): boolean {
  if (!isValidUrl(input)) return false;
  const parsed = new URL(input);
  return isSafePublicHostname(parsed.hostname);
}

function isSafePublicHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
  if (!host) return false;
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local')) return false;
  if (isUnsafeIpv4(host) || isUnsafeIpv6(host)) return false;
  return true;
}

function isUnsafeIpv4(host: string): boolean {
  if (!/^\d{1,3}(?:\.\d{1,3}){3}$/.test(host)) return false;
  const octets = host.split('.').map(part => Number(part));
  if (octets.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = octets;
  return a === 0
    || a === 10
    || a === 127
    || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168)
    || (a === 100 && b >= 64 && b <= 127)
    || (a === 198 && (b === 18 || b === 19))
    || a >= 224;
}

function isUnsafeIpv6(host: string): boolean {
  if (!host.includes(':')) return false;
  const normalized = host.toLowerCase();
  return normalized === '::'
    || normalized === '::1'
    || normalized.startsWith('fc')
    || normalized.startsWith('fd')
    || normalized.startsWith('fe80:')
    || normalized.startsWith('::ffff:10.')
    || normalized.startsWith('::ffff:127.')
    || normalized.startsWith('::ffff:192.168.');
}

function sanitizeFileName(title: string): string {
  return title
    .replace(/[/\\?*:|"<>]/g, '-')
    .replace(/[\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^\.+/, '')
    .trim()
    .slice(0, 120)
    || 'Untitled';
}

function buildFrontmatter(meta: Record<string, string | null | undefined>): string {
  const lines = ['---'];
  const yamlReserved = /^(true|false|null|yes|no|on|off|~)$/i;
  const yamlSpecialStart = /^[*&!@`>|%-]/;

  for (const [key, val] of Object.entries(meta)) {
    if (val == null || val === '') continue;
    const clean = val.replace(/[\r\n]+/g, ' ').trim();
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

function createTurndown(): TurndownService {
  const td = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    bulletListMarker: '-',
    emDelimiter: '*',
  });

  td.addRule('pre-code', {
    filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
    replacement: (_content, node) => {
      const code = (node as Element).querySelector('code');
      const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
      const text = code?.textContent || '';
      return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
    },
  });

  td.addRule('remove-scripts-styles', {
    filter: ['script', 'style', 'noscript'],
    replacement: () => '',
  });

  return td;
}

/**
 * Fetches a URL, extracts article content via Readability, and converts to Markdown.
 */
export async function clipUrl(url: string): Promise<WebClipResult> {
  return fetchUrlWithTimeout(url, async (res) => {
    const contentType = res.headers.get('content-type') ?? '';
    if (!isHtmlContentType(contentType)) {
      throw new Error(`URL does not point to an HTML page (got ${contentType})`);
    }
    return readHtmlClipFromResponse(res, url);
  });
}

/**
 * Fetches a URL and captures either an HTML article as Markdown or a supported binary file.
 */
export async function captureUrl(url: string): Promise<UrlCaptureResult> {
  return fetchUrlWithTimeout(url, async (res) => {
    const contentType = res.headers.get('content-type') ?? '';
    const finalUrl = res.url || url;

    if (isHtmlContentType(contentType)) {
      return readHtmlClipFromResponse(res, url);
    }

    const binaryType = supportedRemoteBinaryTypeForResponse(res, finalUrl, contentType);
    if (binaryType) {
      return readBinaryFileFromResponse(res, finalUrl, contentType, binaryType);
    }

    throw new Error(`URL does not point to an HTML page, PDF, or supported image file (got ${contentType})`);
  });
}

async function fetchUrlWithTimeout<T>(url: string, readResponse: (res: Response) => Promise<T>): Promise<T> {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL — only http:// and https:// are supported');
  }
  if (!isSafeHttpUrlForFetch(url)) {
    throw new Error('Unsafe URL — local and private network addresses are not supported');
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const res = await fetchWithSafeRedirects(url, controller.signal);

    if (!res.ok) {
      throw new Error(`Failed to fetch: HTTP ${res.status} ${res.statusText}`);
    }

    return await readResponse(res);
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new Error(`Fetch timed out after ${FETCH_TIMEOUT_MS / 1000}s`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function readHtmlClipFromResponse(res: Response, requestedUrl: string): Promise<WebClipResult> {
  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_HTML_SIZE) {
    throw new Error(`Page too large (${Math.round(contentLength / 1024 / 1024)}MB, max 5MB)`);
  }

  const html = await res.text();
  const finalUrl = res.url || requestedUrl;

  if (html.length > MAX_HTML_SIZE) {
    throw new Error('Page content too large (max 5MB)');
  }

  const dom = new JSDOM(html, { url: finalUrl });
  const doc = dom.window.document;

  const reader = new Readability(doc, { charThreshold: 100 });
  const article = reader.parse();

  const title = article?.title || doc.title || new URL(finalUrl).hostname;
  const content = article?.content || doc.body?.innerHTML || '';
  const textContent = article?.textContent || doc.body?.textContent || '';

  const latinWords = textContent.split(/\s+/).filter(Boolean).length;
  const cjkChars = (textContent.match(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/g) || []).length;
  const wordCount = cjkChars > latinWords ? cjkChars : latinWords;

  let hostname: string;
  try {
    hostname = new URL(finalUrl).hostname.replace(/^www\./, '');
  } catch {
    hostname = 'unknown';
  }

  const turndown = createTurndown();
  const bodyMd = turndown.turndown(content);
  const platform = detectSourcePlatform(finalUrl);

  const savedAt = new Date().toISOString();
  const fm = buildFrontmatter({
    title,
    source: finalUrl,
    source_platform: platform?.id,
    source_domain: hostname,
    author: article?.byline || null,
    site: article?.siteName || platform?.label || hostname,
    clipped: savedAt,
  });

  const markdown = `${fm}# ${title}\n\n${bodyMd}\n`;
  const fileName = sanitizeFileName(title) + '.md';

  dom.window.close();

  return {
    title,
    markdown,
    fileName,
    wordCount,
    url: finalUrl,
    siteName: article?.siteName || platform?.label || hostname,
    byline: article?.byline || null,
    mode: 'article',
  };
}

async function readBinaryFileFromResponse(
  res: Response,
  finalUrl: string,
  contentType: string,
  binaryType: RemoteBinaryFileType,
): Promise<WebFileCaptureResult> {
  const contentLength = parseInt(res.headers.get('content-length') ?? '0', 10);
  if (contentLength > MAX_CAPTURE_FILE_SIZE) {
    throw new Error(`File too large (${Math.round(contentLength / 1024 / 1024)}MB, max 10MB)`);
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.byteLength > MAX_CAPTURE_FILE_SIZE) {
    throw new Error('File content too large (max 10MB)');
  }

  const fileName = binaryFileNameForResponse(res, finalUrl, binaryType);
  const hostname = hostNameForUrl(finalUrl);
  const platform = detectSourcePlatform(finalUrl);
  const siteName = platform?.label || hostname;

  return {
    title: fileName,
    fileName,
    contentBase64: buffer.toString('base64'),
    contentType,
    byteLength: buffer.byteLength,
    wordCount: 0,
    url: finalUrl,
    siteName,
    byline: null,
    mode: 'file',
  };
}

function isHtmlContentType(contentType: string): boolean {
  const normalized = contentType.toLowerCase();
  return normalized.includes('text/html') || normalized.includes('application/xhtml');
}

function normalizedContentType(contentType: string): string {
  return contentType.toLowerCase().split(';', 1)[0]?.trim() ?? '';
}

function supportedRemoteBinaryTypeForResponse(
  res: Response,
  finalUrl: string,
  contentType: string,
): RemoteBinaryFileType | null {
  const byContentType = remoteBinaryTypeForContentType(contentType);
  if (byContentType) return byContentType;

  const dispositionName = fileNameFromContentDisposition(res.headers.get('content-disposition'));
  return remoteBinaryTypeForFileName(dispositionName) || remoteBinaryTypeForFileName(fileNameFromUrl(finalUrl));
}

function remoteBinaryTypeForContentType(contentType: string): RemoteBinaryFileType | null {
  const normalized = normalizedContentType(contentType);
  if (!normalized) return null;
  return REMOTE_BINARY_FILE_TYPES.find(type => type.contentTypes.includes(normalized)) ?? null;
}

function remoteBinaryTypeForFileName(fileName: string | null): RemoteBinaryFileType | null {
  const extension = extensionFromFileName(fileName);
  if (!extension) return null;
  return REMOTE_BINARY_FILE_TYPES.find(type => type.extensions.includes(extension)) ?? null;
}

function binaryFileNameForResponse(
  res: Response,
  finalUrl: string,
  binaryType: RemoteBinaryFileType,
): string {
  const fromDisposition = fileNameFromContentDisposition(res.headers.get('content-disposition'));
  const fromUrl = fileNameFromUrl(finalUrl);
  const fallback = `${hostNameForUrl(finalUrl) || 'document'}${binaryType.preferredExtension}`;
  return ensureSupportedExtension(sanitizeFileName(fromDisposition || fromUrl || fallback), binaryType);
}

function fileNameFromContentDisposition(header: string | null): string | null {
  if (!header) return null;
  const parts = header.split(';').map(part => part.trim());
  const encoded = parts.find(part => /^filename\*/i.test(part));
  if (encoded) {
    const value = headerValueAfterEquals(encoded);
    if (value) {
      const withoutCharset = value.replace(/^[^']*'[^']*'/, '');
      try {
        return decodeURIComponent(stripWrappingQuotes(withoutCharset));
      } catch {
        return stripWrappingQuotes(withoutCharset);
      }
    }
  }

  const plain = parts.find(part => /^filename=/i.test(part));
  if (!plain) return null;
  return stripWrappingQuotes(headerValueAfterEquals(plain));
}

function headerValueAfterEquals(part: string): string {
  const index = part.indexOf('=');
  if (index < 0) return '';
  return part.slice(index + 1).trim();
}

function stripWrappingQuotes(value: string): string {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"'))
    || (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function fileNameFromUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const segment = parsed.pathname.split('/').filter(Boolean).pop();
    if (!segment) return null;
    try {
      return decodeURIComponent(segment);
    } catch {
      return segment;
    }
  } catch {
    return null;
  }
}

function extensionFromFileName(name: string | null): string | null {
  if (!name) return null;
  const match = name.toLowerCase().match(/(\.[a-z0-9]+)$/);
  return match?.[1] ?? null;
}

function ensureSupportedExtension(fileName: string, binaryType: RemoteBinaryFileType): string {
  const extension = extensionFromFileName(fileName);
  if (extension && binaryType.extensions.includes(extension)) return fileName;
  const stem = fileName.replace(/\.[^.]+$/, '') || 'document';
  return `${stem}${binaryType.preferredExtension}`;
}

function hostNameForUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return 'unknown';
  }
}

async function fetchWithSafeRedirects(url: string, signal: AbortSignal): Promise<Response> {
  let current = url;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    if (!isSafeHttpUrlForFetch(current)) {
      throw new Error('Unsafe redirect URL — local and private network addresses are not supported');
    }

    const res = await fetch(current, {
      signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; MindOS-Clipper/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/pdf,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9,zh-CN;q=0.8,zh;q=0.7',
      },
      redirect: 'manual',
    });

    if (![301, 302, 303, 307, 308].includes(res.status)) return res;

    const location = res.headers.get('location');
    if (!location) throw new Error(`Redirect response missing Location header (HTTP ${res.status})`);

    const next = new URL(location, current).toString();
    if (!isSafeHttpUrlForFetch(next)) {
      throw new Error('Unsafe redirect URL — local and private network addresses are not supported');
    }
    current = next;
  }

  throw new Error(`Too many redirects (max ${MAX_REDIRECTS})`);
}

export function createFallbackWebClip(url: string): WebClipResult {
  if (!isValidUrl(url)) {
    throw new Error('Invalid URL — only http:// and https:// are supported');
  }
  if (!isSafeHttpUrlForFetch(url)) {
    throw new Error('Unsafe URL — local and private network addresses are not supported');
  }

  const parsed = new URL(url);
  const hostname = parsed.hostname.replace(/^www\./, '');
  const platform = detectSourcePlatform(url);
  const siteName = platform?.label || hostname;
  const title = `${siteName} link`;
  const savedAt = new Date().toISOString();
  const fm = buildFrontmatter({
    title,
    source: parsed.toString(),
    source_platform: platform?.id,
    source_domain: hostname,
    site: siteName,
    clipped: savedAt,
    clip_status: 'link-only',
  });

  return {
    title,
    markdown: `${fm}# ${title}\n\n${parsed.toString()}\n`,
    fileName: `${sanitizeFileName(title)}.md`,
    wordCount: 0,
    url: parsed.toString(),
    siteName,
    byline: null,
    mode: 'link',
  };
}
