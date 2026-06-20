'use client';

import { useMemo } from 'react';
import type { RendererContext } from '@/lib/renderers/registry';
import { escapeAttribute, escapeHtml, safeHref } from '../safe-html';
import {
  RendererBadge,
  RendererMetaRow,
  RendererPageShell,
  RendererPanel,
  RendererStatus,
  rendererTagTone,
} from '../renderer-primitives';

// ─── Parser ───────────────────────────────────────────────────────────────────

interface TimelineEntry {
  heading: string;
  date: Date | null;
  body: string; // raw markdown lines joined
  tags: string[];
}

// Detect date-like H2 headings: ## 2025-01-15, ## Jan 2025, ## 2025/01/15, etc.
const DATE_RE = /(\d{4}[-/]\d{1,2}(?:[-/]\d{1,2})?|[A-Za-z]+ \d{4}|\d{4}年\d{1,2}月(?:\d{1,2}日)?)/;

function parseDate(s: string): Date | null {
  const m = DATE_RE.exec(s);
  if (!m) return null;
  const d = new Date(m[1].replace(/[/年月]/g, '-').replace('日', ''));
  return isNaN(d.getTime()) ? null : d;
}

// Extract #tag or **tag** markers from body text
function extractTags(body: string): string[] {
  const tags: string[] = [];
  const hashTags = body.match(/#([\w\u4e00-\u9fff]+)/g);
  if (hashTags) tags.push(...hashTags.map(t => t.slice(1)));
  return [...new Set(tags)];
}

function parseTimeline(content: string): TimelineEntry[] {
  const lines = content.split('\n');
  const entries: TimelineEntry[] = [];
  let current: TimelineEntry | null = null;
  let bodyLines: string[] = [];

  const flush = () => {
    if (!current) return;
    const body = bodyLines.join('\n').trim();
    current.body = body;
    current.tags = extractTags(body);
    entries.push(current);
    current = null;
    bodyLines = [];
  };

  for (const line of lines) {
    // H1 is the document title — skip
    if (/^# /.test(line)) continue;

    // H2 = timeline entry
    if (/^## /.test(line)) {
      flush();
      const heading = line.slice(3).trim();
      current = { heading, date: parseDate(heading), body: '', tags: [] };
      continue;
    }

    if (current) bodyLines.push(line);
  }
  flush();

  return entries;
}

// ─── Markdown inline renderer (no extra dep) ──────────────────────────────────

function renderInline(text: string): string {
  return escapeHtml(text)
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code class="font-display rounded bg-muted px-1.5 py-px text-[0.85em]">$1</code>')
    .replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (_, target, alias) =>
      `<span class="cursor-pointer text-[var(--amber)]" title="${escapeAttribute(target)}">${alias ?? target}</span>`)
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) =>
      `<a href="${safeHref(href)}" class="text-[var(--amber)]">${label}</a>`);
}

export function renderBody(body: string): string {
  const lines = body.split('\n');
  const out: string[] = [];
  let listTag: 'ul' | 'ol' | null = null;

  const closeList = () => {
    if (!listTag) return;
    out.push(`</${listTag}>`);
    listTag = null;
  };

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line) { closeList(); out.push('<br/>'); continue; }

    if (/^### /.test(line)) { closeList(); out.push(`<h3 class="my-2 text-[0.8rem] font-semibold uppercase tracking-[0.06em] text-muted-foreground">${renderInline(line.slice(4))}</h3>`); continue; }
    if (/^- /.test(line) || /^\* /.test(line)) {
      if (listTag !== 'ul') { closeList(); out.push('<ul class="my-1 list-disc pl-5">'); listTag = 'ul'; }
      out.push(`<li class="my-0.5 text-[0.82rem] text-foreground">${renderInline(line.slice(2))}</li>`);
      continue;
    }
    if (/^\d+\. /.test(line)) {
      if (listTag !== 'ol') { closeList(); out.push('<ol class="my-1 list-decimal pl-5">'); listTag = 'ol'; }
      out.push(`<li class="my-0.5 text-[0.82rem] text-foreground">${renderInline(line.replace(/^\d+\. /, ''))}</li>`);
      continue;
    }
    closeList();
    out.push(`<p class="my-1 text-[0.82rem] leading-relaxed text-foreground">${renderInline(line)}</p>`);
  }
  closeList();
  return out.join('');
}

function formatDate(d: Date): string {
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineRenderer({ content }: RendererContext) {
  const entries = useMemo(() => parseTimeline(content), [content]);

  if (entries.length === 0) {
    return (
      <RendererStatus>
        No timeline entries found. Add <code className="rounded bg-muted px-1.5 py-px">## 2025-01-15</code> headings to create entries.
      </RendererStatus>
    );
  }

  return (
    <RendererPageShell>
      <RendererMetaRow>
        {entries.length} {entries.length === 1 ? 'entry' : 'entries'}
      </RendererMetaRow>

      <div className="relative pl-7">
        <div className="absolute bottom-2 left-1.5 top-2 w-px bg-border" />

        {entries.map((entry, idx) => (
          <div key={idx} className="relative mb-6">
            <div
              className={`absolute -left-[22px] top-2.5 z-10 size-[9px] rounded-full ${
                entry.date ? 'bg-[var(--amber)] outline outline-2 outline-[var(--amber-dim)]' : 'bg-border'
              }`}
            />

            <RendererPanel className="px-[18px] py-3.5 transition-colors">
              <div className="mb-2 flex flex-wrap items-baseline justify-between gap-3">
                <span className="text-[0.9rem] font-semibold text-foreground">
                  {entry.heading}
                </span>
                {entry.date && (
                  <span className="font-display shrink-0 text-[0.7rem] text-muted-foreground/70">
                    {formatDate(entry.date)}
                  </span>
                )}
              </div>

              {entry.body && (
                <div dangerouslySetInnerHTML={{ __html: renderBody(entry.body) }} />
              )}

              {entry.tags.length > 0 && (
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {entry.tags.map(tag => (
                    <RendererBadge key={tag} tone={rendererTagTone(tag)} className="text-[0.68rem]">
                      #{tag}
                    </RendererBadge>
                  ))}
                </div>
              )}
            </RendererPanel>
          </div>
        ))}
      </div>
    </RendererPageShell>
  );
}
