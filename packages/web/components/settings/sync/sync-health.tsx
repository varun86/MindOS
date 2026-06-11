import { AlertCircle, CheckCircle2, GitBranch, GitCommitHorizontal } from 'lucide-react';
import type { SyncStatus } from '../types';
import { formatSyncError, getSyncErrorHint, getUnpushedCount, hasUnknownUnpushedCount, timeAgo } from '@/lib/sync-ui';

export type SyncHealthTone = 'success' | 'warning' | 'error';

export function getSyncHealth(status: SyncStatus, syncT?: Record<string, unknown>, staleError?: string | null) {
  const conflictCount = status.conflicts?.length ?? 0;
  const unpushedCount = getUnpushedCount(status);
  const paused = !status.enabled && status.configured;

  if (staleError) {
    return {
      tone: 'error' as const,
      title: (syncT?.healthStaleTitle as string) ?? 'Sync status may be outdated',
      description: formatSyncError(staleError, syncT),
      next: (syncT?.healthStaleNext as string) ?? 'Next: retry status refresh before trusting this state',
      icon: <AlertCircle size={18} />,
    };
  }

  if (conflictCount > 0) {
    return {
      tone: 'error' as const,
      title: (syncT?.healthConflictsTitle as string) ?? 'Resolve conflicts to finish sync',
      description: (syncT?.healthConflictsDesc as ((n: number) => string))?.(conflictCount)
        ?? 'Review each file below, compare the two versions, then choose which one to keep.',
      next: (syncT?.healthConflictsNext as string) ?? 'Next: choose which version to keep',
      icon: <AlertCircle size={18} />,
    };
  }

  if (status.lastError) {
    const hint = getSyncErrorHint(status.lastError, status.remote, syncT);
    const description = hint && !status.lastError.includes(hint)
      ? `${status.lastError}\n${hint}`
      : (hint || status.lastError);
    return {
      tone: 'error' as const,
      title: (syncT?.healthErrorTitle as string) ?? 'Sync needs attention',
      description,
      next: (syncT?.healthErrorNext as string) ?? 'Next: fix the issue, then sync again',
      icon: <AlertCircle size={18} />,
    };
  }

  if (hasUnknownUnpushedCount(status)) {
    return {
      tone: 'warning' as const,
      title: (syncT?.healthUnknownTitle as string) ?? 'Sync status unknown',
      description: paused
        ? ((syncT?.healthPausedUnknownDesc as string)
          ?? 'Auto-sync is paused, and MindOS could not confirm whether local changes have been uploaded.')
        : ((syncT?.healthUnknownDesc as string)
          ?? 'MindOS could not confirm whether local changes have been uploaded.'),
      next: paused
        ? ((syncT?.healthPausedUnknownNext as string) ?? 'Next: enable auto-sync or retry the status refresh')
        : ((syncT?.healthUnknownNext as string) ?? 'Next: retry sync or check the remote repository'),
      icon: <AlertCircle size={18} />,
    };
  }

  if (unpushedCount > 0) {
    return {
      tone: 'warning' as const,
      title: paused
        ? ((syncT?.healthPausedUnpushedTitle as ((n: number) => string))?.(unpushedCount)
          ?? `${unpushedCount} local change${unpushedCount === 1 ? '' : 's'} are waiting`)
        : ((syncT?.healthUnpushedTitle as ((n: number) => string))?.(unpushedCount)
          ?? `${unpushedCount} local change${unpushedCount === 1 ? '' : 's'} waiting to upload`),
      description: paused
        ? ((syncT?.healthPausedUnpushedDesc as string)
          ?? 'Auto-sync is paused. These changes will not upload until you sync manually or enable auto-sync.')
        : ((syncT?.healthUnpushedDesc as string)
          ?? 'MindOS will push them automatically, or you can run Sync now.'),
      next: paused
        ? ((syncT?.healthPausedUnpushedNext as string) ?? 'Next: run Sync Now or enable auto-sync')
        : ((syncT?.healthUnpushedNext as string) ?? 'Next: sync now or keep working'),
      icon: <GitCommitHorizontal size={18} />,
    };
  }

  if (!status.enabled && status.configured) {
    return {
      tone: 'warning' as const,
      title: (syncT?.healthPausedTitle as string) ?? 'Sync is paused',
      description: (syncT?.healthPausedDesc as string)
        ?? 'Auto-sync is disabled for this repository. Your existing Git configuration is still available.',
      next: (syncT?.healthPausedNext as string) ?? 'Next: enable auto-sync when you want background backups again',
      icon: <GitBranch size={18} />,
    };
  }

  if (!status.lastSync) {
    return {
      tone: 'warning' as const,
      title: (syncT?.healthReadyTitle as string) ?? 'Sync is ready',
      description: (syncT?.healthReadyDesc as string)
        ?? 'No completed sync has been recorded yet.',
      next: (syncT?.healthReadyNext as string) ?? 'Run Sync Now to create the first backup',
      icon: <GitBranch size={18} />,
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

export function healthToneClass(tone: SyncHealthTone) {
  switch (tone) {
    case 'success':
      return 'border-success/25 bg-success/10 text-success';
    case 'warning':
      return 'border-[var(--amber)]/30 bg-[var(--amber-subtle)] text-[var(--amber-text)]';
    case 'error':
      return 'border-destructive/25 bg-destructive/10 text-destructive';
  }
}
