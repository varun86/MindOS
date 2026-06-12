'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { PLATFORMS, type PlatformStatus } from '@/lib/im/platforms';
import { ChannelIcon } from '@/components/agents/ChannelIcon';

/** Compact sidebar cards for IM channels — icon + name + status mark. */
export default function IMChannelsView() {
  const { t } = useLocale();
  const im = t.panels.im;
  const searchParams = useSearchParams();
  const activePlatform = searchParams.get('platform');

  const [statuses, setStatuses] = useState<PlatformStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchStatuses = useCallback(async () => {
    setError(false);
    try {
      const res = await fetch('/api/im/status');
      if (res.ok) {
        const data = await res.json();
        setStatuses(data.platforms ?? []);
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchStatuses(); }, [fetchStatuses]);

  if (loading) {
    return (
      <div className="space-y-2 px-3 py-3" aria-label={im.title}>
        {[0, 1, 2, 3].map((item) => (
          <div
            key={item}
            className="flex min-h-14 items-center gap-3 rounded-xl border border-border/50 bg-background/45 px-3 py-2.5"
          >
            <span className="h-9 w-9 shrink-0 animate-pulse rounded-md bg-muted/60" />
            <span className="h-4 w-24 animate-pulse rounded bg-muted/60" />
            <span className="ml-auto h-7 w-7 shrink-0 animate-pulse rounded-full bg-muted/40" />
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3">
        <div className="flex flex-col items-center gap-2 rounded-xl border border-border/60 bg-background/50 px-4 py-5 text-center">
          <AlertCircle size={16} className="text-muted-foreground" />
          <p className="text-2xs text-muted-foreground">{im.fetchError}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); fetchStatuses(); }}
            className="inline-flex items-center gap-1 text-2xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <RefreshCw size={11} /> {im.retry}
          </button>
        </div>
      </div>
    );
  }

  const configuredCount = statuses.filter(s => s.connected).length;
  const getStatus = (id: string) => statuses.find(s => s.platform === id);

  return (
    <div className="flex flex-col px-3 py-3">
      {/* Section header */}
      <div className="mb-2 flex items-center gap-2 px-0.5">
        <span className="text-2xs font-semibold text-muted-foreground">{im.title}</span>
        {configuredCount > 0 && (
          <span className="text-2xs text-muted-foreground/60">{configuredCount} {im.connected}</span>
        )}
      </div>

      {/* Platform list */}
      <div className="flex flex-col gap-2">
        {PLATFORMS.map((platform) => {
          const { id, name } = platform;
          const status = getStatus(id);
          const isConnected = status?.connected ?? false;
          const isActive = activePlatform === id;

          return (
            <Link
              key={id}
              href={`/agents?tab=channels&platform=${id}`}
              aria-current={isActive ? 'page' : undefined}
              className={`
                group relative flex min-h-14 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-all duration-150
                ${isActive
                  ? 'border-[var(--amber)]/30 bg-[var(--amber)]/8 shadow-sm shadow-[var(--amber)]/5'
                  : 'border-border/55 bg-background/45 hover:border-border hover:bg-muted/35'
                }
              `}
            >
              <ChannelIcon
                platform={platform}
                size="md"
                className={isActive ? 'border-[var(--amber)]/20 bg-[var(--amber)]/8' : 'transition-colors group-hover:bg-background'}
              />
              <span className="min-w-0 flex-1 truncate text-[15px] font-semibold text-foreground">{name}</span>
              {isConnected ? (
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-success/25 bg-success/10 text-success"
                  aria-label={im.connected}
                >
                  <CheckCircle2 size={15} />
                </span>
              ) : (
                <span
                  className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full"
                  aria-label={im.statsNotConfigured}
                >
                  <span className="h-3 w-3 rounded-full border border-border bg-background" />
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
