import { cn } from '@/lib/utils';

export type SetupTone = 'muted' | 'success' | 'error' | 'amber';

export function setupToneText(tone: SetupTone): string {
  if (tone === 'success') return 'text-success';
  if (tone === 'error') return 'text-error';
  if (tone === 'amber') return 'text-[var(--amber)]';
  return 'text-muted-foreground';
}

export function setupBadgeClass(tone: SetupTone, className?: string): string {
  return cn(
    'inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs',
    tone === 'success' && 'bg-success/10 text-success',
    tone === 'error' && 'bg-error/10 text-error',
    tone === 'amber' && 'bg-[var(--amber-subtle)] text-[var(--amber)]',
    tone === 'muted' && 'bg-muted/70 text-muted-foreground',
    className,
  );
}

export function setupNoticeClass(tone: Exclude<SetupTone, 'muted'>, className?: string): string {
  return cn(
    'rounded-lg border text-xs leading-relaxed',
    tone === 'success' && 'border-success/25 bg-success/10 text-success',
    tone === 'error' && 'border-error/25 bg-error/10 text-error',
    tone === 'amber' && 'border-[var(--amber)]/30 bg-[var(--amber-subtle)] text-[var(--amber)]',
    className,
  );
}

export function setupOutlineButtonClass(tone: 'neutral' | 'amber' = 'neutral', className?: string): string {
  return cn(
    'rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45',
    tone === 'amber' ? 'border-[var(--amber)] text-[var(--amber)]' : 'border-border text-muted-foreground',
    className,
  );
}

export function setupChoiceCardClass(selected: boolean, className?: string): string {
  return cn(
    'border transition-colors',
    selected ? 'border-[var(--amber)] bg-[var(--amber-subtle)]' : 'border-border bg-transparent',
    className,
  );
}
