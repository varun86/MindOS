'use client';

import { useState } from 'react';
import { AlertCircle, ChevronRight, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatSyncError, timeAgo } from '@/lib/sync-ui';

export function ConflictRow({ file, time, noBackup, localExists, remoteExists, syncT, onResolved, disabled }: {
  file: string;
  time?: string;
  noBackup?: boolean;
  localExists?: boolean;
  remoteExists?: boolean;
  syncT?: Record<string, unknown>;
  onResolved: () => Promise<boolean>;
  disabled?: boolean;
}) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ local: string; remote: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmKeepLocalWithoutPreview, setConfirmKeepLocalWithoutPreview] = useState(false);
  const [previewBackupMissing, setPreviewBackupMissing] = useState(false);
  const [refreshFailedAfterResolve, setRefreshFailedAfterResolve] = useState(false);

  const remoteDeleted = remoteExists === false;
  const localDeleted = localExists === false;
  const backupMissing = !remoteDeleted && (!!noBackup || previewBackupMissing);
  const canKeepLocalWithoutPreview = backupMissing;
  const rowLocked = disabled || refreshFailedAfterResolve;

  const loadPreview = async () => {
    setRowError(null);
    setConfirmKeepLocalWithoutPreview(false);
    setPreviewBackupMissing(false);
    setLoadingPreview(true);
    try {
      const data = await apiFetch<{ local: string; remote: string }>('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'conflict-preview', file, remote: file }),
      });
      setPreview(data);
      return true;
    } catch (error) {
      const fallback = (syncT?.conflictPreviewFailed as string) ?? 'Failed to load conflict preview';
      const raw = error instanceof Error ? error.message : fallback;
      const detail = formatSyncError(raw, syncT);
      if (/remote conflict backup is missing/i.test(raw)) {
        setPreviewBackupMissing(true);
      }
      setRowError(detail.includes(fallback) ? detail : `${fallback}\n${detail}`);
      return false;
    } finally {
      setLoadingPreview(false);
    }
  };

  const togglePreview = async () => {
    if (expanded) {
      setExpanded(false);
      return;
    }
    setExpanded(true);
    if (!preview) await loadPreview();
  };

  const handleResolve = async (strategy: 'keep-local' | 'keep-remote') => {
    if (rowLocked) return;
    if (strategy === 'keep-local' && !preview) {
      if (!canKeepLocalWithoutPreview) return;
      if (!confirmKeepLocalWithoutPreview) {
        setConfirmKeepLocalWithoutPreview(true);
        return;
      }
    }
    if (strategy === 'keep-remote' && (!preview || backupMissing)) {
      return;
    }
    setRowError(null);
    setConfirmKeepLocalWithoutPreview(false);
    setResolving(strategy === 'keep-local' ? 'local' : 'remote');
    try {
      const result = await apiFetch<{ uploaded?: boolean; warning?: string }>('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve-conflict', file, strategy }),
      });
      const warning = typeof result.warning === 'string' && result.warning.trim()
        ? formatSyncError(result.warning, syncT)
        : null;
      const refreshed = await onResolved();
      if (!refreshed) {
        setRefreshFailedAfterResolve(true);
        const refreshMessage = (syncT?.conflictResolvedRefreshFailed as string)
          ?? 'Conflict resolution may have been saved, but MindOS could not refresh sync status. Retry status refresh before continuing.';
        setRowError(warning ? `${warning}\n${refreshMessage}` : refreshMessage);
      } else if (warning) {
        setRowError(warning);
      }
    } catch (error) {
      const fallback = (syncT?.conflictResolveFailed as string) ?? 'Failed to resolve conflict';
      const raw = error instanceof Error ? error.message : fallback;
      const detail = formatSyncError(raw, syncT);
      setRowError(detail.includes(fallback) ? detail : `${fallback}\n${detail}`);
    } finally {
      setResolving(null);
    }
  };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      <div className="flex flex-wrap items-center gap-2 p-2 text-xs bg-muted/20">
        <AlertCircle size={12} className="text-error shrink-0" />
        <button
          type="button"
          onClick={togglePreview}
          className="inline-flex min-h-8 flex-1 min-w-[12rem] items-center rounded-md font-mono text-left hover:text-foreground hover:underline transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          title={(syncT?.viewDiff as string) ?? 'View differences'}
        >
          <ChevronRight size={11} className={`inline mr-1 transition-transform ${expanded ? 'rotate-90' : ''}`} />
          {file}
        </button>
        <span className="text-muted-foreground shrink-0">
          {time ? timeAgo(time, syncT) : ((syncT?.timeUnknown as string) ?? 'unknown')}
        </span>
        {!preview && (
          <span className="text-2xs text-muted-foreground">
            {(syncT?.viewDiffFirst as string) ?? 'View diff first'}
          </span>
        )}
        {remoteDeleted && (
          <span className="text-2xs text-muted-foreground">
            {(syncT?.remoteDeleted as string) ?? 'Remote deleted'}
          </span>
        )}
        {localDeleted && (
          <span className="text-2xs text-muted-foreground">
            {(syncT?.localDeleted as string) ?? 'Local deleted'}
          </span>
        )}
        {backupMissing && (
          <span className="text-2xs text-destructive">
            {(syncT?.remoteBackupMissing as string) ?? 'Remote backup unavailable'}
          </span>
        )}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleResolve('keep-local')}
            disabled={rowLocked || !!resolving || loadingPreview || (!preview && !canKeepLocalWithoutPreview)}
            className="inline-flex min-h-8 items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={(syncT?.keepLocalHint as string) ?? 'Keep this device\'s version'}
          >
            {resolving === 'local'
              ? <Loader2 size={10} className="animate-spin" />
              : confirmKeepLocalWithoutPreview
                ? ((syncT?.confirmKeepLocal as string) ?? 'Confirm keep local?')
                : ((syncT?.keepLocal as string) ?? 'Keep local')}
          </button>
          <button
            type="button"
            onClick={() => handleResolve('keep-remote')}
            disabled={rowLocked || !!resolving || !preview || backupMissing}
            className="inline-flex min-h-8 items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={backupMissing
              ? ((syncT?.remoteBackupMissingHint as string) ?? 'The remote version could not be saved for preview, so it cannot be applied from the UI.')
              : remoteDeleted
                ? ((syncT?.keepRemoteDeletedHint as string) ?? 'Accept the remote deletion for this file')
                : ((syncT?.keepRemoteHint as string) ?? 'Replace with remote version')
            }
          >
            {resolving === 'remote' ? <Loader2 size={10} className="animate-spin" /> : ((syncT?.keepRemote as string) ?? 'Keep remote')}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="border-t border-border/50">
          {loadingPreview ? (
            <div className="flex justify-center py-3">
              <Loader2 size={13} className="animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="grid grid-cols-1 divide-y divide-border/50 text-2xs font-mono max-h-72 overflow-auto sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-2">
                <div className="text-muted-foreground mb-1 font-sans text-xs font-medium">
                  {(syncT?.localVersion as string) ?? 'Local (this device)'}
                </div>
                <pre className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{preview.local || ((syncT?.emptyFile as string) ?? '(empty)')}</pre>
              </div>
              <div className="p-2">
                <div className="text-muted-foreground mb-1 font-sans text-xs font-medium">
                  {(syncT?.remoteVersion as string) ?? 'Remote'}
                </div>
                <pre className="whitespace-pre-wrap text-foreground/80 leading-relaxed">
                  {backupMissing
                    ? ((syncT?.remoteBackupMissingHint as string) ?? 'The remote version could not be saved for preview, so it cannot be applied from the UI.')
                    : remoteDeleted
                      ? ((syncT?.remoteDeletedPreview as string) ?? '(deleted remotely)')
                      : (preview.remote || ((syncT?.emptyFile as string) ?? '(empty)'))
                  }
                </pre>
              </div>
            </div>
          ) : (
            <div className="p-3 text-xs text-muted-foreground">
              {(syncT?.previewEmptyState as string) ?? 'No preview loaded yet.'}
            </div>
          )}
        </div>
      )}
      {rowError && (
        <div className="flex items-start justify-between gap-2 border-t border-border/50 bg-destructive/10 p-2 text-xs text-destructive" role="alert" aria-live="polite">
          <div className="space-y-0.5">
            {rowError.split('\n').map((line, i) => (
              <span key={i} className={`block ${i > 0 ? 'text-destructive/70' : ''}`}>{line}</span>
            ))}
          </div>
          <button
            type="button"
            onClick={() => {
              if (refreshFailedAfterResolve) {
                void onResolved();
                return;
              }
              setPreview(null);
              setExpanded(true);
              void loadPreview();
            }}
            className="shrink-0 rounded-md px-2 py-1 text-destructive transition-colors hover:bg-destructive/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(syncT?.retry as string) ?? 'Retry'}
          </button>
        </div>
      )}
    </div>
  );
}
