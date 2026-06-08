'use client';

import { useRef, useCallback, useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Brain, Search, Settings, RefreshCw, Bot, Compass, ChevronLeft, ChevronRight, Radio, Zap, Inbox } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { DOT_COLORS, getStatusLevel } from './SyncStatusBar';
import type { SyncStatus } from './settings/types';
import Logo from './Logo';

export type PanelId = 'files' | 'capture' | 'search' | 'echo' | 'agents' | 'discover' | 'workflows';

export const RAIL_WIDTH_COLLAPSED = 48;
export const RAIL_WIDTH_EXPANDED = 180;

interface ActivityBarProps {
  activePanel: PanelId | null;
  onPanelChange: (id: PanelId | null) => void;
  onEchoClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onAgentsClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onDiscoverClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onWorkflowsClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onSpacesClick?: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  syncStatus: SyncStatus | null;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  onSettingsClick: () => void;
  onSyncClick: (rect: DOMRect) => void;
}

interface RailButtonProps {
  icon: React.ReactNode;
  label: string;
  shortcut?: string;
  active?: boolean;
  expanded: boolean;
  href?: string;
  onClick: React.MouseEventHandler<HTMLAnchorElement | HTMLButtonElement>;
  onNavigate?: (event: { preventDefault: () => void }) => void;
  buttonRef?: React.Ref<HTMLButtonElement>;
  /** Optional overlay badge (e.g. status dot) rendered inside the button */
  badge?: React.ReactNode;
  /** Optional data-walkthrough attribute for interactive walkthrough targeting */
  walkthroughId?: string;
}

function normalizeUrl(value: string): string {
  try {
    const url = new URL(value, window.location.href);
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return value;
  }
}

function RailButton({ icon, label, shortcut, active = false, expanded, href, onClick, onNavigate, buttonRef, badge, walkthroughId }: RailButtonProps) {
  const tooltipText = shortcut ? `${label} (${shortcut})` : label;
  const buttonClassName = `
    relative flex items-center ${expanded ? 'justify-start px-3 w-full' : 'justify-center w-10'} h-10 rounded-md transition-colors
    ${active
      ? 'text-[var(--amber)] bg-[var(--amber-dim)]'
      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
    }
    focus-visible:ring-2 focus-visible:ring-ring
  `;
  const buttonContent = (
    <>
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-[18px] rounded-r-full bg-[var(--amber)]" />
      )}
      <span className="shrink-0 flex items-center justify-center w-[18px]">{icon}</span>
      {badge}
      {expanded && (
        <>
          <span className="ml-2.5 text-sm whitespace-nowrap">{label}</span>
          {shortcut && (
            <span className="ml-auto text-2xs text-muted-foreground/60 font-mono shrink-0">{shortcut}</span>
          )}
        </>
      )}
    </>
  );

  const handleLinkClick: React.MouseEventHandler<HTMLAnchorElement> = (event) => {
    onClick(event);
    if (event.defaultPrevented || !href) return;
    if (process.env.NODE_ENV === 'test') return;

    const target = normalizeUrl(href);
    window.setTimeout(() => {
      const current = `${window.location.pathname}${window.location.search}${window.location.hash}`;
      if (current !== target) {
        window.location.assign(href);
      }
    }, 1200);
  };

  const sharedProps = {
    'aria-pressed': active,
    'aria-label': label,
    title: expanded ? undefined : tooltipText,
    'data-walkthrough': walkthroughId,
    className: buttonClassName,
  };

  if (href) {
    return (
      <Link href={href} onClick={handleLinkClick} onNavigate={onNavigate} {...sharedProps}>
        {buttonContent}
      </Link>
    );
  }

  return (
    <button type="button" ref={buttonRef} onClick={onClick} {...sharedProps}>
      {buttonContent}
    </button>
  );
}

export default function ActivityBar({
  activePanel,
  onPanelChange,
  onEchoClick,
  onAgentsClick,
  onDiscoverClick,
  onWorkflowsClick,
  onSpacesClick,
  syncStatus,
  expanded,
  onExpandedChange,
  onSettingsClick,
  onSyncClick,
}: ActivityBarProps) {
  const lastClickRef = useRef<{ key: string; at: number }>({ key: '', at: 0 });
  const syncBtnRef = useRef<HTMLButtonElement>(null);
  const { t } = useLocale();
  const pathname = usePathname();
  const [, startTransition] = useTransition();
  const router = useRouter();
  const isHome = pathname === '/';
  const isCapture = pathname === '/capture' || pathname?.startsWith('/capture/');
  const isFilesRoute = pathname === '/wiki' || pathname?.startsWith('/wiki/') || pathname?.startsWith('/view/');
  const activeDestination = activePanel ?? (isCapture ? 'capture' : isFilesRoute ? 'files' : null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      router.prefetch('/capture');
      router.prefetch('/wiki');
    }, 0);
    return () => window.clearTimeout(timer);
  }, [router]);

  // Update badge: Desktop → electron-updater IPC; Browser → npm registry check
  const [hasUpdate, setHasUpdate] = useState(false);
  useEffect(() => {
    const bridge = typeof window !== 'undefined'
      ? (window as unknown as { mindos?: { checkUpdate?: () => Promise<{ available: boolean }>; onUpdateAvailable?: (cb: () => void) => () => void } }).mindos
      : undefined;

    if (bridge?.checkUpdate) {
      const doCheck = bridge.checkUpdate.bind(bridge);
      const timer = setTimeout(async () => {
        try {
          const r = await doCheck();
          if (r.available) setHasUpdate(true);
        } catch { /* silent */ }
      }, 10_000);
      const cleanup = bridge.onUpdateAvailable?.(() => setHasUpdate(true));
      return () => { clearTimeout(timer); cleanup?.(); };
    }

    // Browser/CLI: check npm registry
    const dismissed = localStorage.getItem('mindos_update_dismissed');
    const latest = localStorage.getItem('mindos_update_latest');
    if (latest && latest !== dismissed) { setHasUpdate(true); }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/update-check', { signal: AbortSignal.timeout(5000) });
        if (!res.ok) return;
        const data = await res.json();
        if (!data.hasUpdate) {
          localStorage.removeItem('mindos_update_latest');
          localStorage.removeItem('mindos_update_dismissed');
          setHasUpdate(false);
          return;
        }
        const d = localStorage.getItem('mindos_update_dismissed');
        if (data.latest === d) return;
        localStorage.setItem('mindos_update_latest', data.latest);
        setHasUpdate(true);
      } catch { /* silent */ }
    }, 5000);
    const onAvail = () => setHasUpdate(true);
    const onDismiss = () => setHasUpdate(false);
    window.addEventListener('mindos:update-available', onAvail);
    window.addEventListener('mindos:update-dismissed', onDismiss);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('mindos:update-available', onAvail);
      window.removeEventListener('mindos:update-dismissed', onDismiss);
    };
  }, []);

  // Labs feature flags (Echo, Workflows) — always start false to match SSR, hydrate from localStorage in effect
  const [labsEcho, setLabsEcho] = useState(false);
  const [labsWorkflows, setLabsWorkflows] = useState(false);
  useEffect(() => {
    setLabsEcho(localStorage.getItem('mindos:labs-echo') === '1');
    setLabsWorkflows(localStorage.getItem('mindos:labs-workflows') === '1');
    const sync = () => {
      setLabsEcho(localStorage.getItem('mindos:labs-echo') === '1');
      setLabsWorkflows(localStorage.getItem('mindos:labs-workflows') === '1');
    };
    window.addEventListener('mindos:labs-changed', sync);
    return () => window.removeEventListener('mindos:labs-changed', sync);
  }, []);

  /** Debounce repeated clicks on the same rail target without swallowing destination changes. */
  const debounced = useCallback((key: string, fn: () => void) => {
    const now = Date.now();
    if (lastClickRef.current.key === key && now - lastClickRef.current.at < 300) return;
    lastClickRef.current = { key, at: now };
    fn();
  }, []);

  const toggle = useCallback((id: PanelId) => {
    debounced(`panel:${id}`, () => onPanelChange(activePanel === id ? null : id));
  }, [activePanel, onPanelChange, debounced]);

  const syncLevel = getStatusLevel(syncStatus, false);
  const showSyncDot = syncLevel !== 'off' && syncLevel !== 'synced';

  const railWidth = expanded ? RAIL_WIDTH_EXPANDED : RAIL_WIDTH_COLLAPSED;

  // Sync dot badge — positioned differently in collapsed vs expanded
  const syncBadge = showSyncDot ? (
    <span className={`absolute ${expanded ? 'left-[26px] top-1.5' : 'top-1.5 right-1.5'} w-2 h-2 rounded-full ${DOT_COLORS[syncLevel]} ${syncLevel === 'error' || syncLevel === 'conflicts' ? 'animate-pulse' : ''}`} />
  ) : undefined;

  return (
    <aside
      className="group hidden md:flex fixed top-0 left-0 h-screen z-[31] flex-col bg-background border-r border-border transition-[width] duration-200 ease-out"
      style={{ width: `${railWidth}px` }}
      role="toolbar"
      aria-label="Navigation"
      aria-orientation="vertical"
    >
      {/* Content wrapper — overflow-hidden prevents text flash during width transitions */}
      <div className="flex flex-col h-full w-full overflow-hidden">
        {/* ── Top: Logo — h-[45px] aligns divider with PanelHeader h-[46px] border-b (both at y=45) ── */}
        <button
          type="button"
          onClick={() => {
            startTransition(() => {
              if (isHome) {
                onPanelChange(activePanel === 'files' ? null : 'files');
              } else {
                onPanelChange('files');
                router.push('/');
              }
            });
          }}
          className={`flex items-center ${expanded ? 'px-3 gap-2' : 'justify-center'} w-full h-[46px] shrink-0 transition-opacity cursor-pointer ${isHome ? 'opacity-100' : 'opacity-50 hover:opacity-80'}`}
          aria-label="MindOS Home"
        >
          <Logo id="rail" className="w-7 h-3.5 shrink-0" />
          {expanded && <span className="text-sm text-foreground font-brand whitespace-nowrap">MindOS</span>}
        </button>

        <div className={`${expanded ? 'mx-3' : 'mx-2'} border-t border-border`} />

        {/* ── Middle: Core panel toggles ── */}
        <div className={`flex flex-col ${expanded ? 'px-1.5' : 'items-center'} gap-1 py-2`}>
          <RailButton
            icon={<Inbox size={18} />}
            label={t.sidebar.capture}
            active={activeDestination === 'capture'}
            expanded={expanded}
            href="/capture"
            onClick={() => debounced('panel:capture', () => onPanelChange('capture'))}
            walkthroughId="capture-page"
          />
          <RailButton icon={<Brain size={18} />} label={t.sidebar.files} active={activeDestination === 'files'} expanded={expanded} href="/wiki" onClick={(event) => { onSpacesClick ? debounced('panel:files', () => onSpacesClick(event)) : toggle('files'); }} walkthroughId="files-panel" />
          {labsEcho && <RailButton icon={<Radio size={18} />} label={t.sidebar.echo} active={activePanel === 'echo'} expanded={expanded} href="/echo/about-you" onClick={(event) => { onEchoClick ? debounced('panel:echo', () => onEchoClick(event)) : toggle('echo'); }} walkthroughId="echo-panel" />}
          <RailButton icon={<Search size={18} />} label={t.sidebar.searchTitle} shortcut="⌘K" active={activePanel === 'search'} expanded={expanded} onClick={() => toggle('search')} />
          <RailButton
            icon={<Bot size={18} />}
            label={t.sidebar.agents}
            active={activePanel === 'agents'}
            expanded={expanded}
            href="/agents"
            onClick={(event) => { onAgentsClick ? debounced('panel:agents', () => onAgentsClick(event)) : toggle('agents'); }}
            walkthroughId="agents-panel"
          />
          {labsWorkflows && <RailButton icon={<Zap size={18} />} label={t.sidebar.workflows ?? 'Flows'} active={activePanel === 'workflows'} expanded={expanded} onClick={(event) => onWorkflowsClick ? debounced('panel:workflows', () => onWorkflowsClick(event)) : toggle('workflows')} />}
        </div>

        {/* ── Spacer ── */}
        <div className="flex-1" />

        {/* ── Secondary: Explore ── */}
        <div className={`${expanded ? 'mx-3' : 'mx-2'} border-t border-border`} />
        <div className={`flex flex-col ${expanded ? 'px-1.5' : 'items-center'} gap-1 py-2`}>
          <RailButton icon={<Compass size={18} />} label={t.sidebar.discover} active={activePanel === 'discover'} expanded={expanded} href="/explore" onClick={(event) => { onDiscoverClick ? debounced('panel:discover', () => onDiscoverClick(event)) : toggle('discover'); }} />
        </div>

        {/* ── Bottom: Action buttons (not panel toggles) ── */}
        <div className={`${expanded ? 'mx-3' : 'mx-2'} border-t border-border`} />
        <div className={`flex flex-col ${expanded ? 'px-1.5' : 'items-center'} gap-1 py-2`}>
          <RailButton
            icon={<Settings size={18} />}
            label={t.sidebar.settingsTitle}
            shortcut="⌘,"
            expanded={expanded}
            onClick={() => debounced('action:settings', onSettingsClick)}
            badge={hasUpdate ? (
              <span className={`absolute ${expanded ? 'left-[26px] top-1.5' : 'top-1.5 right-1.5'} w-2 h-2 rounded-full bg-error`} />
            ) : undefined}
          />
          {syncStatus?.enabled && syncStatus?.remote && syncStatus.remote !== '(not configured)' && (
          <RailButton
            icon={<RefreshCw size={18} />}
            label={t.sidebar.syncLabel}
            expanded={expanded}
            buttonRef={syncBtnRef}
            badge={syncBadge}
            onClick={() => debounced('action:sync', () => {
              const rect = syncBtnRef.current?.getBoundingClientRect();
              if (rect) onSyncClick(rect);
            })}
          />
          )}
        </div>
      </div>

      {/* ── Hover expand/collapse button — vertically centered on right edge ── */}
      {/* z-[32] ensures it paints above Panel (z-30). Shows on Rail hover OR self-hover. */}
      <button
        onClick={() => onExpandedChange(!expanded)}
        className="
          absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 z-[32]
          w-5 h-5 rounded-full
          bg-card border border-border shadow-sm
          flex items-center justify-center
          opacity-0 group-hover:opacity-100 hover:!opacity-100
          transition-opacity duration-200
          text-muted-foreground hover:text-foreground hover:bg-muted
          focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring
        "
        aria-label={expanded ? 'Collapse sidebar' : 'Expand sidebar'}
        title={expanded ? 'Collapse' : 'Expand'}
      >
        {expanded ? <ChevronLeft size={10} /> : <ChevronRight size={10} />}
      </button>
    </aside>
  );
}
