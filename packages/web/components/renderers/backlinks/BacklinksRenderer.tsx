'use client';

import { useState, useEffect } from 'react';
import { FileText, ExternalLink } from 'lucide-react';
import { encodePath } from '@/lib/utils';
import type { RendererContext } from '@/lib/renderers/registry';
import { fetchBacklinks } from '@/lib/backlinks-client';
import type { BacklinkItem } from '@/lib/types';
import { useSmoothRouterPush } from '@/hooks/useSmoothRouterPush';
import {
  RendererEmptyState,
  RendererMetaRow,
  RendererPageShell,
  RendererPanel,
  RendererStatus,
} from '../renderer-primitives';

function basename(p: string) {
  return p.split('/').pop()?.replace(/\.md$/, '') ?? p;
}

function dirname(p: string) {
  const parts = p.split('/');
  return parts.length > 1 ? parts.slice(0, -1).join('/') : '';
}

// Highlight [[...]] and [text](url) references in snippet
function SnippetLine({ text }: { text: string }) {
  // Replace wikilinks and md links with styled spans
  const parts = text.split(/(\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g);
  return (
    <span>
      {parts.map((part, i) => {
        if (/^\[\[/.test(part) || /^\[/.test(part)) {
          return <span key={i} className="font-medium text-[var(--amber)]">{part}</span>;
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}

export function BacklinksRenderer({ filePath }: RendererContext) {
  const smoothPush = useSmoothRouterPush();
  const [backlinks, setBacklinks] = useState<BacklinkItem[] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    fetchBacklinks(filePath)
      .then((data) => { setBacklinks(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [filePath]);

  if (loading) {
    return (
      <RendererStatus>
        Scanning backlinks…
      </RendererStatus>
    );
  }

  const items = backlinks ?? [];

  return (
    <RendererPageShell>
      <RendererMetaRow>
        {items.length === 0 ? 'No backlinks found' : `${items.length} file${items.length === 1 ? '' : 's'} link here`}
      </RendererMetaRow>

      {items.length === 0 ? (
        <RendererEmptyState icon={<FileText size={28} />}>
          No other files link to <strong className="text-foreground">{basename(filePath)}</strong> yet.
        </RendererEmptyState>
      ) : (
        <div className="grid gap-2.5">
          {items.map(({ filePath: src, snippets }) => {
            const name = basename(src);
            const dir = dirname(src);
            return (
              <RendererPanel
                key={src}
                interactive
                className="group"
                onClick={() => smoothPush('/view/' + encodePath(src))}
              >
                <div className={`flex items-center gap-2 bg-muted px-3.5 py-2.5 ${snippets.length > 0 ? 'border-b border-border' : ''}`}>
                  <FileText size={13} className="shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1 truncate text-[0.85rem] font-semibold text-foreground">
                    {name}
                  </span>
                  {dir && (
                    <span className="font-display shrink-0 text-[0.68rem] text-muted-foreground/60">
                      {dir}
                    </span>
                  )}
                  <ExternalLink size={11} className="shrink-0 text-muted-foreground/50 transition-colors group-hover:text-foreground/70" />
                </div>

                {snippets.map((snippet: string, i: number) => (
                  <div
                    key={i}
                    className={`bg-background px-3.5 py-2 ${i < snippets.length - 1 ? 'border-b border-border' : ''}`}
                  >
                    {snippet.split('\n').map((line: string, j: number) => (
                      <div key={j} className="font-display whitespace-pre-wrap break-words text-[0.72rem] leading-relaxed text-muted-foreground">
                        <SnippetLine text={line} />
                      </div>
                    ))}
                  </div>
                ))}
              </RendererPanel>
            );
          })}
        </div>
      )}
    </RendererPageShell>
  );
}
