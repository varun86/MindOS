'use client';

import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Archive, History, Inbox, ListChecks } from 'lucide-react';
import PanelHeader from './PanelHeader';
import { useLocale } from '@/lib/stores/locale-store';
import { loadHistory, type OrganizeHistoryEntry } from '@/lib/organize-history';

type InboxFile = {
  name: string;
  path: string;
  size: number;
  modifiedAt: string;
  isAging?: boolean;
};

export default function CapturePanel() {
  const { t } = useLocale();
  const [files, setFiles] = useState<InboxFile[]>([]);
  const [history, setHistory] = useState<OrganizeHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const refreshHistory = useCallback(() => {
    setHistory(loadHistory());
  }, []);

  const fetchInbox = useCallback(async () => {
    try {
      const res = await fetch('/api/inbox');
      if (!res.ok) return;
      const data = await res.json() as { files?: InboxFile[] };
      if (Array.isArray(data.files)) setFiles(data.files);
    } catch (error) {
      console.warn('[CapturePanel] fetch failed:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      void fetchInbox();
      refreshHistory();
    }, 80);
  }, [fetchInbox, refreshHistory]);

  useEffect(() => {
    void fetchInbox();
    refreshHistory();
    window.addEventListener('mindos:inbox-updated', refresh);
    window.addEventListener('mindos:organize-done', refresh);
    window.addEventListener('mindos:organize-history-update', refreshHistory);
    return () => {
      clearTimeout(refreshTimerRef.current);
      window.removeEventListener('mindos:inbox-updated', refresh);
      window.removeEventListener('mindos:organize-done', refresh);
      window.removeEventListener('mindos:organize-history-update', refreshHistory);
    };
  }, [fetchInbox, refresh, refreshHistory]);

  return (
    <div className="flex h-full flex-col">
      <PanelHeader title={t.sidebar.capture}>
        <Link
          href="/capture/history"
          className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring"
          aria-label={t.importHistory.title}
          title={t.importHistory.title}
        >
          <History size={13} />
        </Link>
      </PanelHeader>

      <div className="flex-1 overflow-y-auto px-3 py-3">
        <section className="rounded-lg border border-border/60 bg-card/60 p-3">
          <div className="flex items-center gap-2">
            <Inbox size={14} className="text-[var(--amber)]" />
            <h3 className="text-xs font-semibold text-foreground">{t.inbox.sidebarPanelTitle}</h3>
          </div>
          <p className="mt-1 text-2xs leading-relaxed text-muted-foreground/60">
            {t.inbox.sidebarPanelDesc}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <CaptureMetric label={t.inbox.pendingSequenceTitle} value={String(files.length)} />
            <CaptureMetric label={t.inbox.recentProcessedTitle} value={String(history.length)} />
          </div>
        </section>

        <nav className="mt-3 space-y-1.5" aria-label={t.inbox.title}>
          <CapturePanelLink
            href="/capture"
            icon={Archive}
            title={t.inbox.viewCapture}
            desc={t.inbox.sidebarCaptureDesc}
          />
          <CapturePanelLink
            href="/capture#queue"
            icon={ListChecks}
            title={t.inbox.viewQueue}
            desc={loading ? t.inbox.sidebarLoadingDesc : t.inbox.sidebarQueueDesc(files.length)}
          />
          <CapturePanelLink
            href="/capture/history"
            icon={History}
            title={t.inbox.viewHistory}
            desc={t.inbox.sidebarHistoryDesc(history.length)}
          />
        </nav>
      </div>
    </div>
  );
}

function CapturePanelLink({
  href,
  icon: Icon,
  title,
  desc,
}: {
  href: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  title: string;
  desc: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-start gap-2 rounded-lg border border-border/50 bg-card/35 px-3 py-2.5 transition-colors hover:bg-muted/40 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Icon size={13} className="mt-0.5 shrink-0 text-[var(--amber)]/75" />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-foreground">{title}</span>
        <span className="mt-0.5 block text-2xs leading-relaxed text-muted-foreground/60">{desc}</span>
      </span>
    </Link>
  );
}

function CaptureMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/50 bg-background px-3 py-2">
      <p className="text-lg font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 truncate text-2xs text-muted-foreground/60">{label}</p>
    </div>
  );
}
