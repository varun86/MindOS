'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { AlertCircle, Loader2, RefreshCw } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { getPlatformDisplaySubtitle } from '@/lib/im/display';
import { PLATFORMS, type PlatformStatus } from '@/lib/im/platforms';
import { ChannelIcon } from '@/components/agents/ChannelIcon';

export default function IMChannelsView() {
  const { locale, t } = useLocale();
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
      <div className="px-3 py-4">
        <div className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-xs text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span>{im.title}</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-3 py-3">
        <div className="rounded-md border border-border bg-card p-3">
          <div className="flex items-start gap-2">
            <AlertCircle size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
            <p className="min-w-0 flex-1 text-xs leading-5 text-muted-foreground">{im.fetchError}</p>
          </div>
          <button
            type="button"
            onClick={() => { setLoading(true); fetchStatuses(); }}
            className="mt-2 inline-flex items-center gap-1.5 rounded-sm px-0 text-xs font-medium text-foreground transition-colors hover:text-[var(--amber)]"
          >
            <RefreshCw size={12} /> {im.retry}
          </button>
        </div>
      </div>
    );
  }

  const configuredCount = statuses.filter(s => s.connected).length;
  const getStatus = (id: string) => statuses.find(s => s.platform === id);

  return (
    <div className="flex flex-col gap-2 px-2 py-2">
      <div className="flex items-center justify-between gap-2 px-1.5">
        <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{im.title}</span>
        <span className="rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] leading-4 text-muted-foreground">
          {configuredCount} {im.connected}
        </span>
      </div>

      <div className="flex flex-col gap-1">
        {PLATFORMS.map((platform) => {
          const status = getStatus(platform.id);
          const isConnected = status?.connected ?? false;
          const isActive = activePlatform === platform.id;
          const subtitle = getPlatformDisplaySubtitle({
            platform,
            status,
            locale,
            connectedFallback: im.statusConnected,
            disconnectedFallback: im.notConfigured,
          });

          return (
            <Link
              key={platform.id}
              href={`/agents?tab=channels&platform=${platform.id}`}
              aria-current={isActive ? 'page' : undefined}
              className={`
                group relative grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2.5 rounded-md border px-2.5 py-2 text-left transition-colors
                ${isActive
                  ? 'border-[var(--amber)]/40 bg-[var(--amber-dim)]/45 shadow-sm'
                  : 'border-transparent hover:border-border hover:bg-muted/45'
                }
              `}
            >
              {isActive && (
                <span
                  className="pointer-events-none absolute bottom-2 left-0 top-2 w-0.5 rounded-r-full bg-[var(--amber)]"
                  aria-hidden
                />
              )}
              <ChannelIcon
                platform={platform}
                size="sm"
                className={isActive ? 'border-[var(--amber)]/35 bg-background' : 'bg-background/80'}
              />
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium leading-5 text-foreground">{platform.name}</span>
                <span className={`block truncate text-[11px] leading-4 ${isConnected ? 'text-success' : 'text-muted-foreground'}`}>
                  {subtitle}
                </span>
              </span>
              <span
                className={`
                  inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-[10px] font-medium leading-4
                  ${isConnected
                    ? 'border-[var(--success)]/25 bg-[var(--success)]/10 text-success'
                    : 'border-border bg-background text-muted-foreground'
                  }
                `}
              >
                <span
                  className={`h-1.5 w-1.5 rounded-full ${isConnected ? 'bg-success' : 'bg-muted-foreground/35'}`}
                  aria-hidden
                />
                {isConnected ? im.statusConnected : im.notConfigured}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
