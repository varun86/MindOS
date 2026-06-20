'use client';

import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils';

type Tone = 'neutral' | 'amber' | 'success' | 'read' | 'search';

const badgeToneClasses: Record<Tone, string> = {
  neutral: 'border-border bg-background text-muted-foreground',
  amber: 'border-[var(--amber)]/25 bg-[var(--amber-subtle)] text-[var(--amber)]',
  success: 'border-[var(--success)]/25 bg-success/10 text-success',
  read: 'border-[var(--tool-read)]/25 bg-[var(--tool-read)]/10 text-[var(--tool-read)]',
  search: 'border-[var(--tool-search)]/25 bg-[var(--tool-search)]/10 text-[var(--tool-search)]',
};

export function rendererTagTone(seed: string): Exclude<Tone, 'neutral'> {
  const tones: Array<Exclude<Tone, 'neutral'>> = ['amber', 'success', 'read', 'search'];
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) & 0xffff;
  }
  return tones[hash % tones.length];
}

export function RendererPageShell({
  children,
  className,
  wide = false,
}: {
  children: ReactNode;
  className?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn('mx-auto w-full py-6', wide ? 'max-w-none' : 'max-w-[720px]', className)}>
      {children}
    </div>
  );
}

export function RendererStatus({
  children,
  className,
  framed = false,
}: {
  children: ReactNode;
  className?: string;
  framed?: boolean;
}) {
  return (
    <div
      className={cn(
        'font-display flex min-h-40 items-center justify-center px-4 py-12 text-center text-xs text-muted-foreground',
        framed && 'min-h-[400px] rounded-lg border border-border bg-muted',
        className,
      )}
    >
      {children}
    </div>
  );
}

export function RendererMetaRow({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-6 flex items-center gap-2', className)}>
      <span className="font-display text-[11px] text-muted-foreground">{children}</span>
    </div>
  );
}

export function RendererEmptyState({
  icon,
  children,
  className,
}: {
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-dashed border-border px-6 py-10 text-center text-sm text-muted-foreground',
        className,
      )}
    >
      {icon ? <div className="mx-auto mb-2.5 flex justify-center opacity-30">{icon}</div> : null}
      <div className="font-display text-xs">{children}</div>
    </div>
  );
}

export function RendererPanel({
  as: Component = 'div',
  children,
  className,
  interactive = false,
  ...props
}: {
  as?: 'div' | 'aside';
  children: ReactNode;
  className?: string;
  interactive?: boolean;
} & ComponentPropsWithoutRef<'div'>) {
  return (
    <Component
      {...props}
      className={cn(
        'overflow-hidden rounded-lg border border-border bg-card text-foreground',
        interactive && 'cursor-pointer transition-colors hover:border-[var(--amber)]/50',
        className,
      )}
    >
      {children}
    </Component>
  );
}

export function RendererBadge({
  children,
  className,
  tone = 'neutral',
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  return (
    <span
      className={cn(
        'font-display inline-flex items-center rounded-full border px-2 py-0.5 text-[10px]',
        badgeToneClasses[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function RendererMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="font-display rounded-md border border-border bg-background px-2 py-1.5">
      <div className="mb-0.5 text-[9px] text-muted-foreground">{label}</div>
      <div className="text-[13px] text-foreground">{value}</div>
    </div>
  );
}

export function RendererIconButton({
  children,
  label,
  onClick,
  className,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'inline-flex size-7 shrink-0 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:border-[var(--amber)]/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        className,
      )}
    >
      {children}
    </button>
  );
}

export function RendererSearchField({
  value,
  onChange,
  placeholder = 'Search',
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <label
      className={cn(
        'font-display inline-flex h-[30px] items-center gap-2 rounded-full border border-border bg-card px-2.5 text-[11px] text-muted-foreground',
        className,
      )}
    >
      <Search size={13} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-[130px] border-0 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground/70 focus-visible:outline-none"
      />
    </label>
  );
}

export function RendererTogglePill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'font-display h-7 rounded-full border px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active
          ? 'border-[var(--amber)] bg-[var(--amber-dim)] text-foreground'
          : 'border-border bg-card text-muted-foreground hover:border-[var(--amber)]/50 hover:text-foreground',
      )}
    >
      {children}
    </button>
  );
}

export function RendererSegmentedControl({
  value,
  options,
  onChange,
}: {
  value: string;
  options: Array<{ id: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-0.5 rounded-full bg-muted p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            'font-display h-[22px] rounded-full px-2.5 text-[11px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            value === option.id
              ? 'bg-card text-foreground shadow-[0_1px_4px_color-mix(in_srgb,var(--foreground)_10%,transparent)]'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
