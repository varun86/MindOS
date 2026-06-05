'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { RefreshCw, AlertCircle, CheckCircle2, Loader2, GitBranch, Check, ChevronRight, FileX2, GitCommitHorizontal } from 'lucide-react';
import { PrimaryButton, SettingCard, Select } from './Primitives';
import { apiFetch } from '@/lib/api';
import type { SyncStatus, SyncTabProps } from './types';

export function timeAgo(iso: string | null | undefined, syncT?: Record<string, unknown>): string {
  if (!iso) return (syncT?.timeNever as string) ?? 'never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60000) return (syncT?.timeJustNow as string) ?? 'just now';
  const m = Math.floor(diff / 60000);
  if (diff < 3600000) return (syncT?.timeMinAgo as ((n: number) => string))?.(m) ?? `${m}m ago`;
  const h = Math.floor(diff / 3600000);
  if (diff < 86400000) return (syncT?.timeHourAgo as ((n: number) => string))?.(h) ?? `${h}h ago`;
  const d = Math.floor(diff / 86400000);
  return (syncT?.timeDayAgo as ((n: number) => string))?.(d) ?? `${d}d ago`;
}

/** Classify a raw sync error and return a user-friendly message with action hint. */
function formatSyncError(raw: string, syncT?: Record<string, unknown>): string {
  const hint = getSyncErrorHint(raw, undefined, syncT);
  return hint ? `${raw}\n${hint}` : raw;
}

/** Return an actionable hint for common sync errors. */
export function getSyncErrorHint(error: string, remote?: string | null, syncT?: Record<string, unknown>): string {
  const lower = error.toLowerCase();

  // SSH authentication failures
  if (lower.includes('permission denied') || lower.includes('publickey')) {
    return (syncT?.hintSshAuth as string) ?? 'SSH key may not be configured. Run: ssh-keygen -t ed25519 && ssh -T git@github.com';
  }
  // SSH host key / connection
  if (lower.includes('host key') || lower.includes('known_hosts') || lower.includes('fingerprint')) {
    return (syncT?.hintSshHost as string) ?? 'Run: ssh-keyscan github.com >> ~/.ssh/known_hosts';
  }
  // HTTPS auth failures
  if (lower.includes('authentication failed') || lower.includes('invalid credentials') || lower.includes('401') || lower.includes('403')) {
    return (syncT?.hintHttpsAuth as string) ?? 'Access token may be expired or missing. Check Settings → Developer settings → Personal access tokens.';
  }
  // Network / timeout
  if (lower.includes('timed out') || lower.includes('timeout') || lower.includes('could not resolve')) {
    return (syncT?.hintNetwork as string) ?? 'Check your network connection and try again.';
  }
  // Remote not found
  if (lower.includes('not found') || lower.includes('does not exist') || lower.includes('repository not found')) {
    return (syncT?.hintNotFound as string) ?? 'Repository not found. Check the URL and ensure the repo exists.';
  }
  // Push rejected (non-fast-forward)
  if (lower.includes('non-fast-forward') || lower.includes('rejected') || lower.includes('fetch first')) {
    return (syncT?.hintPushRejected as string) ?? 'Remote has changes. Click "Sync Now" to pull and retry.';
  }
  // Merge conflicts
  if (lower.includes('conflict') || lower.includes('merge')) {
    return (syncT?.hintConflict as string) ?? 'Merge conflict detected. Check the Conflicts section below.';
  }

  return '';
}

function getUnpushedCount(status: SyncStatus): number {
  const parsed = parseInt(status.unpushed || '0', 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

function getSyncHealth(status: SyncStatus, syncT?: Record<string, unknown>) {
  const conflictCount = status.conflicts?.length ?? 0;
  const unpushedCount = getUnpushedCount(status);

  if (conflictCount > 0) {
    return {
      tone: 'error' as const,
      title: (syncT?.healthConflictsTitle as string) ?? 'Resolve conflicts to finish sync',
      description: (syncT?.healthConflictsDesc as ((n: number) => string))?.(conflictCount)
        ?? `Review each file below, compare the two versions, then choose which one to keep.`,
      next: (syncT?.healthConflictsNext as string) ?? 'Next: choose which version to keep',
      icon: <AlertCircle size={18} />,
    };
  }

  if (status.lastError) {
    const hint = getSyncErrorHint(status.lastError, status.remote, syncT);
    return {
      tone: 'error' as const,
      title: (syncT?.healthErrorTitle as string) ?? 'Sync needs attention',
      description: hint || status.lastError,
      next: (syncT?.healthErrorNext as string) ?? 'Next: fix the issue, then sync again',
      icon: <AlertCircle size={18} />,
    };
  }

  if (unpushedCount > 0) {
    return {
      tone: 'warning' as const,
      title: (syncT?.healthUnpushedTitle as ((n: number) => string))?.(unpushedCount)
        ?? `${unpushedCount} local change${unpushedCount === 1 ? '' : 's'} waiting to upload`,
      description: (syncT?.healthUnpushedDesc as string)
        ?? 'MindOS will push them automatically, or you can run Sync now.',
      next: (syncT?.healthUnpushedNext as string) ?? 'Next: sync now or keep working',
      icon: <GitCommitHorizontal size={18} />,
    };
  }

  return {
    tone: 'success' as const,
    title: (syncT?.healthSyncedTitle as string) ?? 'All notes are backed up',
    description: (syncT?.healthSyncedDesc as ((time: string) => string))?.(timeAgo(status.lastSync, syncT))
      ?? `Last sync: ${timeAgo(status.lastSync, syncT)}.`,
    next: (syncT?.healthSyncedNext as string) ?? 'Next: keep writing',
    icon: <CheckCircle2 size={18} />,
  };
}

function healthToneClass(tone: 'success' | 'warning' | 'error') {
  switch (tone) {
    case 'success':
      return 'border-success/25 bg-success/10 text-success';
    case 'warning':
      return 'border-[var(--amber)]/30 bg-[var(--amber-subtle)] text-[var(--amber-text)]';
    case 'error':
      return 'border-destructive/25 bg-destructive/10 text-destructive';
  }
}

async function loadSyncStatus(): Promise<SyncStatus> {
  return apiFetch<SyncStatus>('/api/sync', { timeout: 10000 });
}

/* ── Conflict Row ──────────────────────────────────────────────── */

function ConflictRow({ file, time, syncT, onResolved }: {
  file: string; time: string; syncT?: Record<string, unknown>; onResolved: () => void;
}) {
  const [resolving, setResolving] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [preview, setPreview] = useState<{ local: string; remote: string } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  const togglePreview = async () => {
    if (expanded) { setExpanded(false); return; }
    if (!preview) {
      setLoadingPreview(true);
      try {
        const data = await apiFetch<{ local: string; remote: string }>('/api/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'conflict-preview', remote: file }),
        });
        setPreview(data);
      } catch { /* ignore */ }
      setLoadingPreview(false);
    }
    setExpanded(true);
  };

  const handleResolve = async (strategy: 'keep-local' | 'keep-remote') => {
    setResolving(strategy === 'keep-local' ? 'local' : 'remote');
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'resolve-conflict', remote: file, branch: strategy }),
      });
      onResolved();
    } catch {
      setResolving(null);
    }
  };

  return (
    <div className="rounded-lg border border-border/50 overflow-hidden">
      {/* Header row */}
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
        <span className="text-muted-foreground shrink-0">{timeAgo(time, syncT)}</span>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => handleResolve('keep-local')}
            disabled={!!resolving}
            className="inline-flex min-h-8 items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={(syncT?.keepLocalHint as string) ?? 'Keep this device\'s version'}
          >
            {resolving === 'local' ? <Loader2 size={10} className="animate-spin" /> : ((syncT?.keepLocal as string) ?? 'Keep local')}
          </button>
          <button
            type="button"
            onClick={() => handleResolve('keep-remote')}
            disabled={!!resolving}
            className="inline-flex min-h-8 items-center gap-1 px-2.5 py-1 rounded-md border border-border text-xs hover:bg-muted transition-colors disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            title={(syncT?.keepRemoteHint as string) ?? 'Replace with remote version'}
          >
            {resolving === 'remote' ? <Loader2 size={10} className="animate-spin" /> : ((syncT?.keepRemote as string) ?? 'Keep remote')}
          </button>
        </div>
      </div>

      {/* Diff preview */}
      {expanded && (
        <div className="border-t border-border/50">
          {loadingPreview ? (
            <div className="flex justify-center py-3">
              <Loader2 size={13} className="animate-spin text-muted-foreground" />
            </div>
          ) : preview ? (
            <div className="grid grid-cols-2 divide-x divide-border/50 text-2xs font-mono max-h-60 overflow-auto">
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
                <pre className="whitespace-pre-wrap text-foreground/80 leading-relaxed">{preview.remote || ((syncT?.emptyFile as string) ?? '(empty)')}</pre>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

/* ── Gitignore Editor ──────────────────────────────────────────── */

function GitignoreEditor({ syncT }: { syncT?: Record<string, unknown> }) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const loaded = useRef(false);

  const dirty = content !== saved;

  useEffect(() => {
    if (!open || loaded.current) return;
    loaded.current = true;
    setLoading(true);
    apiFetch<{ content: string }>('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'gitignore-get' }),
    }).then(data => {
      setContent(data.content);
      setSaved(data.content);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [open]);

  const handleSave = async () => {
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gitignore-save', content }),
      });
      setSaved(content);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2000);
    } catch {}
  };

  return (
    <div className="pt-2 border-t border-border/50">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1"
      >
        <ChevronRight size={14} className={`shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
        <FileX2 size={13} className="shrink-0" />
        <span>{(syncT?.gitignoreTitle as string) ?? 'Excluded files'}</span>
        <span className="text-2xs opacity-50">.gitignore</span>
      </button>

      {open && (
        <div className="mt-2 space-y-2">
          {loading ? (
            <div className="flex justify-center py-4">
              <Loader2 size={14} className="animate-spin text-muted-foreground" />
            </div>
          ) : (
            <>
              <textarea
                value={content}
                onChange={e => setContent(e.target.value)}
                rows={8}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={(syncT?.gitignorePlaceholder as string) ?? '# Files to exclude from sync\n*.tmp\nsecret/'}
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                {dirty && (
                  <button
                    type="button"
                    onClick={handleSave}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-[var(--amber)] text-[var(--amber-foreground)] hover:opacity-90 transition-opacity"
                  >
                    {(syncT?.gitignoreSave as string) ?? 'Save'}
                  </button>
                )}
                {saveOk && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check size={12} /> {(syncT?.gitignoreSaved as string) ?? 'Saved'}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}


import SyncEmptyState from './SyncEmptyState';

/* ── Main SyncTab ──────────────────────────────────────────────── */

export function SyncTab({ t, visible }: SyncTabProps) {
  const syncT = t.settings?.sync as Record<string, unknown> | undefined;
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const showSuccess = useCallback((text: string) => {
    setMessage({ type: 'success', text });
    setTimeout(() => {
      setMessage(current => (current?.type === 'success' && current.text === text ? null : current));
    }, 3000);
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const data = await loadSyncStatus();
      setStatus(data);
    } catch {
      // Keep existing status on refresh failure (don't flash init form during recompile)
      // Only set null if we never had a status (first load)
      setStatus(prev => prev ?? null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    void loadSyncStatus()
      .then((data) => {
        if (!cancelled) setStatus(data);
      })
      .catch(() => {
        if (!cancelled) setStatus(prev => prev ?? null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh sync status when the tab becomes visible again (after being hidden via display:none)
  const prevVisible = useRef(visible);
  useEffect(() => {
    if (visible && !prevVisible.current && status !== null) {
      fetchStatus();
    }
    prevVisible.current = visible;
  }, [visible, status, fetchStatus]);

  const handleSyncNow = async () => {
    setSyncing(true);
    setMessage(null);
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'now' }),
        timeout: 120_000, // sync can take 60s+ for large repos
      });
      showSuccess((syncT?.syncComplete as string) ?? 'Sync complete');
      await fetchStatus();
    } catch (err: unknown) {
      const raw = err instanceof Error ? err.message : 'Sync failed';
      setMessage({ type: 'error', text: formatSyncError(raw, syncT) });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggle = async () => {
    if (!status) return;
    setToggling(true);
    setMessage(null);
    const action = status.enabled ? 'off' : 'on';
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchStatus();
      showSuccess(status.enabled ? ((syncT?.autoSyncDisabled as string) ?? 'Auto-sync disabled') : ((syncT?.autoSyncEnabled as string) ?? 'Auto-sync enabled'));
    } catch (err) {
      const raw = err instanceof Error ? err.message : ((syncT?.toggleFailed as string) ?? 'Failed to toggle sync');
      setMessage({ type: 'error', text: formatSyncError(raw, syncT) });
    } finally {
      setToggling(false);
    }
  };

  const handleReset = async () => {
    setToggling(true);
    setMessage(null);
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset' }),
      });
      await fetchStatus();
    } catch (err) {
      const raw = err instanceof Error ? err.message : ((syncT?.resetFailed as string) ?? 'Failed to reset sync configuration');
      setMessage({ type: 'error', text: formatSyncError(raw, syncT) });
    } finally {
      setToggling(false);
    }
  };

  const handleUpdateIntervals = async (patch: { autoCommitInterval?: number; autoPullInterval?: number }) => {
    setMessage(null);
    try {
      await apiFetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'update-intervals', ...patch }),
      });
      await fetchStatus();
      showSuccess((syncT?.settingsSaved as string) ?? 'Sync settings saved');
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'Failed to update sync settings';
      setMessage({ type: 'error', text: formatSyncError(raw, syncT) });
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 size={18} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status || !status.enabled) {
    return <SyncEmptyState t={t} onInitComplete={fetchStatus} />;
  }

  // Broken state: config says enabled but repo/remote is missing
  if (status.needsSetup) {
    return (
      <div className="space-y-6">
        <div className="flex items-start gap-3 p-4 rounded-lg bg-destructive/10">
          <AlertCircle size={18} className="text-destructive shrink-0 mt-0.5" />
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-destructive">
              {(syncT?.brokenTitle as string) ?? 'Sync configuration is broken'}
            </h3>
            <p className="text-xs text-destructive/80">
              {status.lastError || ((syncT?.brokenDesc as string) ?? 'The git repository or remote is missing. Reset to re-configure.')}
            </p>
            <PrimaryButton
              onClick={handleReset}
              disabled={toggling}
              className="flex items-center gap-2 mt-2"
            >
              {toggling && <Loader2 size={14} className="animate-spin" />}
              {(syncT?.resetButton as string) ?? 'Reset & Re-configure'}
            </PrimaryButton>
          </div>
        </div>
      </div>
    );
  }

  const conflicts = status.conflicts || [];
  const health = getSyncHealth(status, syncT);
  const unpushedCount = getUnpushedCount(status);
  const showHealthSyncAction = conflicts.length === 0;

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${healthToneClass(health.tone)}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-background/65">
              {health.icon}
            </div>
            <div className="min-w-0 space-y-1">
              <h3 className="text-sm font-semibold text-foreground">{health.title}</h3>
              <p className="text-xs leading-relaxed text-foreground/75">{health.description}</p>
              <p className="text-xs font-medium">{health.next}</p>
            </div>
          </div>
          {showHealthSyncAction && (
            <button
              type="button"
              onClick={handleSyncNow}
              disabled={syncing}
              className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-lg border border-border bg-background/80 px-3 text-sm text-foreground shadow-sm transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
              {(syncT?.syncNow as string) ?? 'Sync now'}
            </button>
          )}
        </div>
      </div>

      <SettingCard
        icon={<GitBranch size={15} />}
        title={(syncT?.repositoryTitle as string) ?? 'Repository'}
        description={status.remote}
        badge={
          <span className="text-2xs px-1.5 py-0.5 rounded bg-success/15 text-success font-medium">
            {(syncT?.labelEnabled as string) ?? 'Active'}
          </span>
        }
      >
        {/* Status rows */}
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{(syncT?.labelBranch as string) ?? 'Branch'}</span>
            <span className="font-mono text-xs">{status.branch}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{(syncT?.labelLastSync as string) ?? 'Last sync'}</span>
            <span className="text-xs">{timeAgo(status.lastSync, syncT)}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">{(syncT?.labelUnpushed as string) ?? 'Local changes'}</span>
            <span className="text-xs">
              {typeof status.unpushed === 'string' && /^\d+$/.test(status.unpushed)
                ? ((syncT?.unpushedCommits as ((n: number) => string))?.(unpushedCount) ?? `${unpushedCount} changes`)
                : `${status.unpushed ?? '?'} changes`}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border px-3 text-sm text-muted-foreground transition-colors hover:border-destructive/50 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {(syncT?.disableAutoSync as string) ?? 'Disable Auto-sync'}
          </button>
        </div>

        {/* Message */}
        {message && (
          <div className="flex items-start gap-1.5 text-xs" role="status" aria-live="polite">
            {message.type === 'success' ? (
              <><CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" /><span className="text-success">{message.text}</span></>
            ) : (
              <>
                <AlertCircle size={13} className="text-destructive shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  {message.text.split('\n').map((line, i) => (
                    <span key={i} className={`block ${i > 0 ? 'text-destructive/70' : 'text-destructive'}`}>{line}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

      </SettingCard>

      {conflicts.length > 0 && (
        <SettingCard
          icon={<AlertCircle size={15} />}
          title={(syncT?.conflictsTitle as ((n: number) => string))?.(conflicts.length) ?? `Conflicts (${conflicts.length})`}
          description={(syncT?.conflictSectionDesc as string) ?? 'Review each file below. Choose which version to keep before syncing again.'}
          className="border-destructive/25"
        >
          <p className="text-xs text-muted-foreground">
            {(syncT?.conflictExplain as string) ?? 'Choose which version to keep for each file.'}
          </p>
          <div className="space-y-2">
            {conflicts.map((c, i) => (
              <ConflictRow key={i} file={c.file} time={c.time} syncT={syncT} onResolved={fetchStatus} />
            ))}
          </div>
        </SettingCard>
      )}

      <SettingCard
        icon={<RefreshCw size={15} />}
        title={(syncT?.automationTitle as string) ?? 'Automation'}
        description={(syncT?.automationDesc as string) ?? 'MindOS keeps syncing in the background while you work.'}
      >
        <div className="space-y-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground">{(syncT?.autoCommitLabel as string) ?? 'Save changes every'}</span>
            <Select
              size="sm"
              value={String(status.autoCommitInterval)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                void handleUpdateIntervals({ autoCommitInterval: val });
              }}
            >
              <option value="10">10s</option>
              <option value="15">15s</option>
              <option value="30">30s</option>
              <option value="60">60s</option>
              <option value="120">120s</option>
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="text-muted-foreground">{(syncT?.autoPullLabel as string) ?? 'Check for updates every'}</span>
            <Select
              size="sm"
              value={String(status.autoPullInterval)}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                void handleUpdateIntervals({ autoPullInterval: val });
              }}
            >
              <option value="60">1min</option>
              <option value="120">2min</option>
              <option value="300">5min</option>
              <option value="600">10min</option>
              <option value="1800">30min</option>
              <option value="3600">60min</option>
            </Select>
          </div>
        </div>
      </SettingCard>

      <GitignoreEditor syncT={syncT} />
    </div>
  );
}
