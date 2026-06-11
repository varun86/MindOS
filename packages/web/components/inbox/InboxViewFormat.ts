import type { OrganizeSource } from '@/lib/organize-history';
import type { CaptureIntent, RelativeTimeStrings } from './InboxViewTypes';

export const EXT_STYLES: Record<string, { bg: string; text: string }> = {
  md:   { bg: 'bg-blue-500/10',    text: 'text-blue-500/70' },
  txt:  { bg: 'bg-muted/50',       text: 'text-muted-foreground/60' },
  csv:  { bg: 'bg-emerald-500/10', text: 'text-emerald-500/70' },
  json: { bg: 'bg-violet-500/10',  text: 'text-violet-500/70' },
  pdf:  { bg: 'bg-error/10',       text: 'text-error/60' },
};

export function getFileExt(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function getFileBaseName(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(0, dot) : name;
}

export function isContentPreviewable(name: string): boolean {
  const ext = getFileExt(name);
  return ['', 'md', 'markdown', 'txt', 'csv', 'tsv', 'json', 'yaml', 'yml', 'xml', 'html', 'htm'].includes(ext);
}

export function formatContentPreview(content: string): string {
  const withoutYamlFrontmatter = content.replace(/^\uFEFF?---[ \t]*(?:\r?\n)[\s\S]*?(?:^|\r?\n)---[ \t]*(?:\r?\n|$)/, '');
  const withoutCaptureHeader = stripGeneratedCaptureHeader(withoutYamlFrontmatter);
  const compact = withoutCaptureHeader.trim();
  const limit = 3200;
  return compact.length > limit ? `${compact.slice(0, limit).trimEnd()}\n...` : compact;
}

function stripGeneratedCaptureHeader(content: string): string {
  const lines = content.split(/\r?\n/);
  const headerStart = lines.findIndex(line => line.trim().length > 0);
  if (headerStart < 0 || lines[headerStart]?.trim() !== '***') return content;

  const separatorIndex = lines.findIndex((line, index) => index > headerStart && /^[-*_]{6,}$/.test(line.trim()));
  if (separatorIndex < headerStart + 2 || separatorIndex - headerStart > 24) return content;

  const headerLines = lines.slice(headerStart + 1, separatorIndex);
  const hasCaptureMetadata = headerLines.some(line => /^(title|source|url|author|site|platform|clipped):/i.test(line.trim()));
  return hasCaptureMetadata ? lines.slice(separatorIndex + 1).join('\n') : content;
}

export function countWords(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const cjk = trimmed.match(/[\u4e00-\u9fff]/g)?.length ?? 0;
  const words = trimmed
    .replace(/[\u4e00-\u9fff]/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length;
  return cjk + words;
}

export function getUrlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export function shortenUrl(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, '');
    const label = `${parsed.hostname}${path}`;
    return label.length > 42 ? `${label.slice(0, 39)}...` : label;
  } catch {
    return url.length > 42 ? `${url.slice(0, 39)}...` : url;
  }
}

export function removeSavedPendingFiles(files: File[], savedOriginalNames: string[]): File[] {
  const remainingSavedByName = new Map<string, number>();
  for (const name of savedOriginalNames) {
    remainingSavedByName.set(name, (remainingSavedByName.get(name) ?? 0) + 1);
  }
  return files.filter(file => {
    const remaining = remainingSavedByName.get(file.name) ?? 0;
    if (remaining <= 0) return true;
    remainingSavedByName.set(file.name, remaining - 1);
    return false;
  });
}

export function buildCaptureFileName(content: string, intent: CaptureIntent): string {
  const firstLine = content.split(/\r?\n/).find(line => line.trim())?.trim() ?? 'capture';
  const clean = firstLine
    .replace(/^#+\s*/, '')
    .replace(/[`*_~[\]()#>]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^a-zA-Z0-9\u4e00-\u9fff-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48);
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, '')
    .replace('T', '-');
  return `capture-${intent}-${timestamp}-${clean || 'note'}.md`;
}

export function getSourceBadge(source?: OrganizeSource): { label: string; className: string } | null {
  switch (source) {
    case 'drag-drop':      return { label: 'drop',   className: 'bg-muted/50 text-muted-foreground/50' };
    case 'inbox-organize': return { label: 'inbox',  className: 'bg-[var(--amber)]/10 text-[var(--amber)]/70' };
    case 'import-modal':   return { label: 'import', className: 'bg-blue-500/10 text-blue-500/70' };
    case 'plugin':         return { label: 'plugin', className: 'bg-violet-500/10 text-violet-500/70' };
    case 'upload':         return { label: 'upload', className: 'bg-teal-500/10 text-teal-500/70' };
    case 'web-clipper':    return { label: 'clip',   className: 'bg-emerald-500/10 text-emerald-500/70' };
    default: return null;
  }
}

export function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}m${rem > 0 ? `${rem}s` : ''}`;
}

export function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function formatRelativeTime(isoString: string, rt: RelativeTimeStrings): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return rt.justNow;
  if (minutes < 60) return rt.minutesAgo(minutes);
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return rt.hoursAgo(hours);
  const days = Math.floor(hours / 24);
  return rt.daysAgo(days);
}
