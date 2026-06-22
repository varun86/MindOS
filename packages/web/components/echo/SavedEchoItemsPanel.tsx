'use client';

import type { ComponentType } from 'react';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, NotebookText } from 'lucide-react';
import type { EchoSavedItem, EchoSavedItemDetail } from '@/lib/echo-store';
import type { Messages } from '@/lib/i18n';
import { cn, encodePath } from '@/lib/utils';
import { buttonVariants } from '@/components/ui/button';

type EchoMarkdownComponent = ComponentType<{ markdown: string }>;
type EchoSavedItemsCopy = Messages['echoPages'];

const echoSurfaceClass =
  'rounded-xl border border-border/60 bg-card/45 shadow-sm';

const echoDetailProseClass =
  'prose prose-sm prose-panel dark:prose-invert max-w-none text-foreground ' +
  'prose-p:my-2 prose-p:leading-7 ' +
  'prose-headings:font-semibold prose-headings:text-foreground prose-h1:text-lg prose-h2:text-base prose-h3:text-sm ' +
  'prose-headings:mt-5 prose-headings:mb-2 ' +
  'prose-ul:my-3 prose-ol:my-3 prose-li:my-1 ' +
  'prose-code:text-[0.8em] prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:before:content-none prose-code:after:content-none ' +
  'prose-pre:bg-muted prose-pre:text-foreground prose-pre:text-xs ' +
  'prose-blockquote:border-l-[var(--amber)] prose-blockquote:text-muted-foreground ' +
  'prose-a:text-[var(--amber)] prose-a:no-underline hover:prose-a:underline ' +
  'prose-strong:text-foreground prose-strong:font-semibold';

export default function SavedEchoItemsPanel({
  items,
  selectedPath,
  onSelect,
  detail,
  loading,
  error,
  detailLoading,
  detailError,
  p,
}: {
  items: EchoSavedItem[];
  selectedPath: string | null;
  onSelect: (path: string) => void;
  detail: EchoSavedItemDetail | null;
  loading: boolean;
  error: string;
  detailLoading: boolean;
  detailError: string;
  p: EchoSavedItemsCopy;
}) {
  const [EchoMarkdown, setEchoMarkdown] = useState<EchoMarkdownComponent | null>(null);
  const selectedItem = detail ?? items.find((item) => item.path === selectedPath) ?? null;

  useEffect(() => {
    if (!detail?.markdown || EchoMarkdown) return;
    let cancelled = false;
    import('./EchoInsightMarkdown')
      .then((mod) => {
        if (!cancelled) setEchoMarkdown(() => mod.default);
      })
      .catch((err) => {
        console.error('[SavedEchoItemsPanel] Failed to load markdown renderer:', err);
      });
    return () => { cancelled = true; };
  }, [detail?.markdown, EchoMarkdown]);

  return (
    <section className={cn(echoSurfaceClass, 'overflow-hidden')} aria-labelledby="echo-saved-items-title">
      <div className="flex items-center justify-between gap-3 border-b border-border/45 px-5 py-4 md:px-6">
        <div className="min-w-0">
          <h2 id="echo-saved-items-title" className="font-sans text-sm font-medium text-foreground">
            {p.echoSavedListTitle}
          </h2>
          <p className="mt-1 font-sans text-xs text-muted-foreground">
            {loading ? p.echoSavedLoadingLabel : `${items.length}`}
          </p>
        </div>
      </div>

      {error ? (
        <p className="px-5 py-4 font-sans text-sm text-error md:px-6" role="alert">{error}</p>
      ) : null}

      <div className="grid min-h-[24rem] lg:grid-cols-[minmax(15rem,0.72fr)_minmax(0,1.28fr)]">
        <div className="border-b border-border/45 p-3 lg:max-h-[34rem] lg:overflow-y-auto lg:border-b-0 lg:border-r">
          {items.length > 0 ? (
            <div className="space-y-2">
              {items.map((item) => {
                const active = item.path === selectedPath;
                return (
                  <button
                    key={item.path}
                    type="button"
                    onClick={() => onSelect(item.path)}
                    className={cn(
                      'group flex w-full items-start gap-3 rounded-lg border px-3 py-3 text-left transition-[background-color,border-color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      active
                        ? 'border-[var(--amber)]/30 bg-[var(--amber)]/10'
                        : 'border-transparent hover:bg-muted/35',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border bg-background/70',
                        active ? 'border-[var(--amber)]/30 text-[var(--amber)]' : 'border-border/50 text-muted-foreground',
                      )}
                      aria-hidden
                    >
                      <NotebookText size={16} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-sm font-medium text-foreground">{item.title}</span>
                      <span className="mt-1 block truncate font-sans text-xs text-muted-foreground">{item.date}</span>
                      {item.excerpt ? (
                        <span className="mt-2 line-clamp-2 block font-sans text-xs leading-5 text-muted-foreground">{item.excerpt}</span>
                      ) : null}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : !loading && !error ? (
            <div className="flex h-full min-h-48 items-center justify-center rounded-lg border border-dashed border-border/55 px-4 py-8 text-center">
              <p className="max-w-xs font-sans text-sm leading-6 text-muted-foreground">{p.echoSavedEmptyLabel}</p>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 p-5 md:p-6">
          {detailError ? (
            <p className="font-sans text-sm text-error" role="alert">
              {p.echoSavedDetailErrorPrefix} {detailError}
            </p>
          ) : detailLoading ? (
            <p className="font-sans text-sm text-muted-foreground">{p.echoSavedDetailLoadingLabel}</p>
          ) : selectedItem ? (
            <article aria-labelledby="echo-saved-detail-title">
              <div className="mb-5 flex flex-col gap-4 border-b border-border/45 pb-5 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <p className="mb-2 font-sans text-xs uppercase tracking-[0.12em] text-muted-foreground">{p.echoSavedDetailTitle}</p>
                  <h3 id="echo-saved-detail-title" className="font-sans text-lg font-semibold leading-tight text-foreground">{selectedItem.title}</h3>
                  <p className="mt-2 truncate font-sans text-xs text-muted-foreground">{selectedItem.date} · {selectedItem.path}</p>
                </div>
                <Link
                  href={`/view/${encodePath(selectedItem.path)}`}
                  className={cn(
                    buttonVariants({ variant: 'outline', size: 'sm' }),
                    'w-fit shrink-0',
                  )}
                >
                  {p.echoSavedOpenLabel}
                  <ArrowUpRight size={13} aria-hidden />
                </Link>
              </div>
              {detail?.markdown ? (
                <div className={cn(echoDetailProseClass, 'max-h-[26rem] overflow-y-auto pr-1')}>
                  {EchoMarkdown ? (
                    <EchoMarkdown markdown={detail.markdown} />
                  ) : (
                    <p className="whitespace-pre-wrap">{detail.markdown}</p>
                  )}
                </div>
              ) : (
                <p className="font-sans text-sm leading-6 text-muted-foreground">{selectedItem.excerpt}</p>
              )}
            </article>
          ) : (
            <p className="font-sans text-sm text-muted-foreground">{p.echoSavedEmptyLabel}</p>
          )}
        </div>
      </div>
    </section>
  );
}
