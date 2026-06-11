'use client';

import { useCallback, useState } from 'react';
import { AlertCircle, Check, ChevronRight, FileX2, Loader2, RefreshCw } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { formatSyncError } from '@/lib/sync-ui';

export function GitignoreEditor({ syncT, onSaved, disabled }: {
  syncT?: Record<string, unknown>;
  onSaved?: () => void | Promise<void>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState('');
  const [saved, setSaved] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);
  const [stoppedTracking, setStoppedTracking] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saveWarning, setSaveWarning] = useState<string | null>(null);
  const [refreshWarning, setRefreshWarning] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const dirty = content !== saved;

  const loadGitignore = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSaveWarning(null);
    setRefreshWarning(null);
    setLoadFailed(false);
    setSaveOk(false);
    setStoppedTracking([]);
    try {
      const data = await apiFetch<{ content: string }>('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gitignore-get' }),
      });
      setContent(data.content);
      setSaved(data.content);
    } catch (err) {
      const raw = err instanceof Error ? err.message : ((syncT?.gitignoreLoadFailed as string) ?? 'Failed to load .gitignore');
      setError(formatSyncError(raw, syncT));
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [syncT]);

  const handleSave = async () => {
    if (disabled) return;
    setSaving(true);
    setError(null);
    setSaveWarning(null);
    setRefreshWarning(null);
    setSaveOk(false);
    setStoppedTracking([]);
    try {
      const data = await apiFetch<{ content?: string; stoppedTracking?: string[]; warning?: string }>('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'gitignore-save', content }),
      });
      const savedContent = data.content ?? content;
      setContent(savedContent);
      setSaved(savedContent);
      setStoppedTracking(Array.isArray(data.stoppedTracking) ? data.stoppedTracking : []);
      if (typeof data.warning === 'string' && data.warning.trim()) {
        setSaveWarning(formatSyncError(data.warning, syncT));
      }
      setSaveOk(true);
      setLoadFailed(false);
      try {
        await onSaved?.();
      } catch (refreshError) {
        const raw = refreshError instanceof Error
          ? refreshError.message
          : ((syncT?.syncStatusRefreshFailed as string) ?? 'Saved, but failed to refresh sync status');
        setRefreshWarning(formatSyncError(raw, syncT));
      }
      setTimeout(() => setSaveOk(false), 2000);
    } catch (err) {
      const raw = err instanceof Error ? err.message : ((syncT?.gitignoreSaveFailed as string) ?? 'Failed to save .gitignore');
      setError(formatSyncError(raw, syncT));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pt-2 border-t border-border/50">
      <button
        type="button"
        onClick={() => {
          if (disabled) return;
          const nextOpen = !open;
          setOpen(nextOpen);
          if (nextOpen) void loadGitignore();
        }}
        disabled={disabled}
        className="flex items-center gap-2 w-full text-left text-sm text-muted-foreground hover:text-foreground transition-colors py-1 disabled:cursor-not-allowed disabled:opacity-50"
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
                onChange={event => setContent(event.target.value)}
                rows={8}
                disabled={disabled || loadFailed}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-xs font-mono leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
                placeholder={(syncT?.gitignorePlaceholder as string) ?? '# Files to exclude from sync\n*.tmp\nsecret/'}
                spellCheck={false}
              />
              <div className="flex items-center gap-2">
                {dirty && !loadFailed && (
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={disabled || saving}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg bg-[var(--amber)] text-[var(--amber-foreground)] hover:opacity-90 transition-opacity disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {saving && <Loader2 size={12} className="animate-spin" />}
                    {(syncT?.gitignoreSave as string) ?? 'Save'}
                  </button>
                )}
                {loadFailed && (
                  <button
                    type="button"
                    onClick={() => void loadGitignore()}
                    className="flex items-center gap-1.5 px-3 py-1 text-xs rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <RefreshCw size={12} />
                    {(syncT?.retry as string) ?? 'Retry'}
                  </button>
                )}
                {saveOk && (
                  <span className="flex items-center gap-1 text-xs text-success">
                    <Check size={12} /> {(syncT?.gitignoreSaved as string) ?? 'Saved'}
                  </span>
                )}
              </div>
              {error && (
                <div className="flex items-start gap-1.5 rounded-md bg-destructive/10 p-2 text-xs text-destructive" role="alert" aria-live="polite">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    {error.split('\n').map((line, i) => (
                      <span key={i} className={`block ${i > 0 ? 'text-destructive/70' : ''}`}>{line}</span>
                    ))}
                  </div>
                </div>
              )}
              {stoppedTracking.length > 0 && (
                <div className="rounded-md border border-[var(--amber)]/25 bg-[var(--amber-subtle)] p-2 text-xs text-[var(--amber-text)]" role="status" aria-live="polite">
                  <div className="flex items-start gap-1.5">
                    <AlertCircle size={13} className="mt-0.5 shrink-0" />
                    <div className="space-y-0.5">
                      <span className="block font-medium">
                        {(syncT?.gitignoreStoppedTracking as ((n: number) => string))?.(stoppedTracking.length)
                          ?? `${stoppedTracking.length} previously synced file${stoppedTracking.length === 1 ? '' : 's'} will be removed from future syncs.`}
                      </span>
                      <span className="block text-foreground/70">
                        {(syncT?.gitignoreStoppedTrackingHint as string)
                          ?? 'The file stays on this device. The next sync removes it from the current remote tree; older Git history may still contain prior copies.'}
                      </span>
                      <span className="block max-w-full truncate font-mono text-foreground/70" title={stoppedTracking.join(', ')}>
                        {stoppedTracking.slice(0, 3).join(', ')}
                        {stoppedTracking.length > 3 ? ` +${stoppedTracking.length - 3}` : ''}
                      </span>
                    </div>
                  </div>
                </div>
              )}
              {saveWarning && (
                <div className="flex items-start gap-1.5 rounded-md border border-[var(--amber)]/25 bg-[var(--amber-subtle)] p-2 text-xs text-[var(--amber-text)]" role="status" aria-live="polite">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    {saveWarning.split('\n').map((line, i) => (
                      <span key={i} className={`block ${i > 0 ? 'text-foreground/70' : ''}`}>{line}</span>
                    ))}
                  </div>
                </div>
              )}
              {refreshWarning && (
                <div className="flex items-start gap-1.5 rounded-md border border-[var(--amber)]/25 bg-[var(--amber-subtle)] p-2 text-xs text-[var(--amber-text)]" role="status" aria-live="polite">
                  <AlertCircle size={13} className="mt-0.5 shrink-0" />
                  <div className="space-y-0.5">
                    <span className="block">{(syncT?.syncStatusRefreshFailed as string) ?? 'Saved, but failed to refresh sync status'}</span>
                    {refreshWarning.split('\n').map((line, i) => (
                      <span key={i} className="block text-foreground/70">{line}</span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
