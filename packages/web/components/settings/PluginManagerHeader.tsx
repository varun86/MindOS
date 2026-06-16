'use client';

import Link from 'next/link';
import { ExternalLink, Puzzle, type LucideIcon } from 'lucide-react';
import type { PluginsCopy } from './PluginsTabModel';
import type { PluginPanel } from './types';

export interface PluginManagerNavItem {
  id: PluginPanel;
  label: string;
  icon: LucideIcon;
  count?: number;
}

interface PluginManagerHeaderProps {
  copy: PluginsCopy;
  panel: PluginPanel;
  panels: PluginManagerNavItem[];
  onPanelChange: (panel: PluginPanel) => void;
}

export function PluginManagerHeader({
  copy,
  panel,
  panels,
  onPanelChange,
}: PluginManagerHeaderProps) {
  return (
    <header className="rounded-xl border border-border/60 bg-card/65 p-4 shadow-[0_1px_2px_0_color-mix(in_srgb,var(--foreground)_5%,transparent)]">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--amber-subtle)] text-[var(--amber)]">
            <Puzzle size={15} />
          </span>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-foreground">{copy.managerTitle}</h3>
            <p className="mt-0.5 max-w-2xl text-xs leading-relaxed text-muted-foreground">{copy.managerSubtitle}</p>
          </div>
        </div>

        <Link
          href="/explore/plugins"
          className="inline-flex h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border border-border bg-background px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ExternalLink size={13} />
          {copy.browseMarketAction}
        </Link>
      </div>

      <nav
        aria-label={copy.sectionNavLabel}
        className="mt-4 flex max-w-full gap-1 overflow-x-auto rounded-lg border border-border/70 bg-muted/25 p-1"
      >
        {panels.map((item) => {
          const Icon = item.icon;
          const active = panel === item.id;
          return (
            <button
              key={item.id}
              type="button"
              aria-pressed={active}
              onClick={() => onPanelChange(item.id)}
              className={`inline-flex h-8 min-w-0 shrink-0 items-center gap-2 rounded-md px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                active
                  ? 'bg-background text-foreground shadow-[0_1px_2px_0_color-mix(in_srgb,var(--foreground)_8%,transparent)]'
                  : 'text-muted-foreground hover:bg-background/70 hover:text-foreground'
              }`}
            >
              <Icon size={14} className={active ? 'text-[var(--amber)]' : 'text-muted-foreground'} />
              <span className="truncate">{item.label}</span>
              {typeof item.count === 'number' && (
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground tabular-nums">
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>
    </header>
  );
}
