'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';

/** Row matching Discover panel nav: icon tile, title, optional subtitle, optional badge, chevron. */
export function PanelNavRow({
  icon,
  title,
  subtitle,
  badge,
  href,
  onClick,
  active,
}: {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  /** When true, row shows selected state (e.g. current Echo segment). */
  active?: boolean;
}) {
  const content = (
    <>
      <span
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-md transition-colors',
          active ? 'bg-[var(--amber)]/10 text-[var(--amber)]' : 'bg-muted text-muted-foreground',
        )}
      >
        {icon}
      </span>
      <span className="flex-1 min-w-0">
        <span className="block text-left text-sm font-medium text-foreground truncate" title={title}>{title}</span>
        {subtitle ? (
          <span className="block text-left text-2xs text-muted-foreground truncate" title={subtitle}>{subtitle}</span>
        ) : null}
      </span>
      {badge}
      <ChevronRight size={14} className={cn('shrink-0', active ? 'text-[var(--amber)]' : 'text-muted-foreground')} />
    </>
  );

  const showRail = Boolean(active);

  const className = cn(
    'relative flex items-center gap-3 rounded-none px-4 py-2.5 transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
    showRail ? 'bg-[var(--amber-subtle)] text-foreground' : 'text-muted-foreground',
    !showRail && 'cursor-pointer hover:bg-muted/50',
    showRail && 'cursor-default',
  );

  const rail = showRail ? (
    <span
      className="pointer-events-none absolute bottom-[22%] left-0 top-[22%] w-[3px] rounded-r-full bg-[var(--amber)]"
      aria-hidden
    />
  ) : null;

  if (href) {
    return (
      <Link href={href} className={className} aria-current={active ? 'page' : undefined}>
        {rail}
        {content}
      </Link>
    );
  }
  return (
    <button type="button" onClick={onClick} className={cn(className, 'w-full')}>
      {rail}
      {content}
    </button>
  );
}

export function ComingSoonBadge({ label }: { label: string }) {
  return (
    <span className="text-2xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">{label}</span>
  );
}
