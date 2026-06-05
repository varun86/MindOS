'use client';

import { useEffect, useRef } from 'react';
import { RefreshCw, CheckCircle2, XCircle, X } from 'lucide-react';
import { DOT_COLORS, getStatusLevel, getSyncLabel, useSyncAction } from '../SyncStatusBar';
import type { SyncStatus } from '../settings/types';
import { PrimaryButton } from '../settings/Primitives';

interface SyncPopoverProps {
  open: boolean;
  onClose: () => void;
  anchorRect: DOMRect | null;
  railWidth: number;
  onOpenSyncSettings: () => void;
  syncStatus: SyncStatus | null;
  onSyncStatusRefresh: () => Promise<void>;
}

export default function SyncPopover({ open, onClose, anchorRect, railWidth, onOpenSyncSettings, syncStatus, onSyncStatusRefresh }: SyncPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const { syncing, syncResult, syncNow } = useSyncAction(onSyncStatusRefresh);

  // Close on ESC
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, open]);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const id = setTimeout(() => window.addEventListener('mousedown', handler), 0);
    return () => { clearTimeout(id); window.removeEventListener('mousedown', handler); };
  }, [onClose, open]);

  if (!open || !anchorRect) return null;

  const level = getStatusLevel(syncStatus, syncing);
  const { label: statusText, tooltip: statusDetail } = getSyncLabel(level, syncStatus);

  // Position: anchor near the button, avoid going off-screen top
  const popoverTop = Math.max(8, anchorRect.bottom - 180);

  return (
    <div
      ref={ref}
      className="fixed z-50 w-[280px] border rounded-lg bg-background shadow-lg border-border animate-in fade-in slide-in-from-left-2 duration-150"
      style={{
        top: popoverTop,
        left: railWidth,
      }}
    >
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Git Sync</span>
        <button
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Close"
        >
          <X size={14} />
        </button>
      </div>
      <div className="p-3 space-y-3">
        {/* Status */}
        <div className="flex items-center gap-2">
          <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[level]} ${
            level === 'syncing' || level === 'conflicts' || level === 'error' ? 'animate-pulse' : ''
          }`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{statusText}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{statusDetail}</p>
          </div>
          {syncResult === 'success' && <CheckCircle2 size={14} className="text-success shrink-0" />}
          {syncResult === 'error' && <XCircle size={14} className="text-error shrink-0" />}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {level !== 'off' && (
            <PrimaryButton
              onClick={syncNow}
              disabled={syncing}
              className="flex min-h-9 items-center gap-1.5 px-3 text-xs"
            >
              <RefreshCw size={12} className={syncing ? 'animate-spin' : ''} />
              Sync Now
            </PrimaryButton>
          )}
          <button
            onClick={() => { onOpenSyncSettings(); onClose(); }}
            className="inline-flex min-h-9 items-center rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            Open settings
          </button>
        </div>
      </div>
    </div>
  );
}
