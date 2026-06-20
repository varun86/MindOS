'use client';

import type { ReactNode } from 'react';
import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Footprints, GitBranch, LayoutDashboard, Sprout } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { cn } from '@/lib/utils';
import { ECHO_SEGMENT_HREF, ECHO_SEGMENT_ORDER, type EchoSegment } from '@/lib/echo-segments';
import { shouldHandleSmoothNavigation, useSmoothRouterPush } from '@/hooks/useSmoothRouterPush';

function segmentMeta(
  segment: EchoSegment,
  echo: ReturnType<typeof useLocale>['t']['panels']['echo'],
): { label: string; icon: ReactNode } {
  switch (segment) {
    case 'overview':
      return { label: echo.overviewTitle, icon: <LayoutDashboard size={14} /> };
    case 'imprint':
      return { label: echo.imprintTitle, icon: <Footprints size={14} /> };
    case 'threads':
      return { label: echo.threadsTitle, icon: <GitBranch size={14} /> };
    case 'growth':
      return { label: echo.growthTitle, icon: <Sprout size={14} /> };
  }
}

export default function EchoSegmentNav({ activeSegment }: { activeSegment: EchoSegment }) {
  const { t } = useLocale();
  const smoothPush = useSmoothRouterPush();
  const navRef = useRef<HTMLElement | null>(null);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);
  const echo = t.panels.echo;
  const aria = t.echoPages.segmentNavAria;

  useEffect(() => {
    const nav = navRef.current;
    const activeLink = activeLinkRef.current;
    if (!nav || !activeLink) return;

    const nextLeft = activeLink.offsetLeft - (nav.clientWidth - activeLink.offsetWidth) / 2;
    nav.scrollTo({ left: Math.max(0, nextLeft), behavior: 'auto' });
  }, [activeSegment]);

  return (
    <nav ref={navRef} aria-label={aria} className="mt-5 overflow-x-auto pb-1 font-sans">
      <ul className="flex w-max min-w-full overflow-hidden rounded-xl border border-border/60 bg-card/35 shadow-sm md:grid md:w-auto md:grid-cols-4">
        {ECHO_SEGMENT_ORDER.map((segment) => {
          const href = ECHO_SEGMENT_HREF[segment];
          const { label, icon } = segmentMeta(segment, echo);
          const isActive = segment === activeSegment;
          return (
            <li key={segment} className="shrink-0 border-r border-border/45 last:border-r-0">
              <Link
                ref={isActive ? activeLinkRef : undefined}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                onClick={(event) => {
                  if (!shouldHandleSmoothNavigation(event)) return;
                  event.preventDefault();
                  if (!isActive) smoothPush(href);
                }}
                className={cn(
                  'group flex min-h-[58px] w-[172px] items-center gap-2 px-3 py-3 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:w-auto md:px-4',
                  isActive
                    ? 'bg-[var(--amber)]/[0.08] font-medium text-foreground'
                    : 'text-muted-foreground hover:bg-muted/45 hover:text-foreground',
                )}
              >
                <span className={cn(
                  'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-colors',
                  isActive
                    ? 'bg-[var(--amber)] text-[var(--amber-foreground)]'
                    : 'bg-background text-muted-foreground group-hover:text-foreground',
                )} aria-hidden>{icon}</span>
                <span className="min-w-0 truncate text-xs font-medium">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
