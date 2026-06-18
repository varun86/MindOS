'use client';

import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Bot, BriefcaseBusiness, ChevronDown, ChevronUp, Layers3, Plus, X } from 'lucide-react';
import PathAutocompleteField from '@/components/shared/PathAutocompleteField';
import type { ChatSession, SessionContextSelection, SessionWorkDir } from '@/lib/types';
import {
  getEffectiveSessionContextSelection,
  getEffectiveSessionWorkDir,
  normalizeSessionContextSelectionForClient,
} from '@/lib/session-context';
import { cn } from '@/lib/utils';

type SessionContextLabels = {
  title: string;
  workDir: string;
  spaces: string;
  assistants: string;
  mindRoot: string;
  none: string;
  locked: string;
  editWorkDir: string;
  workDirPlaceholder: string;
  workDirBrowse: string;
  workDirBrowseUnavailable: string;
  addSpace: string;
  addAssistant: string;
  newSession: string;
  removeItem: (label: string) => string;
  spacePlaceholder: string;
  assistantPlaceholder: string;
  applyNextTurn: string;
  spacesCount: (n: number) => string;
  assistantsCount: (n: number) => string;
};

type SessionContextDockProps = {
  session: ChatSession | null;
  labels?: Partial<SessionContextLabels>;
  workDirEditable: boolean;
  compact?: boolean;
  onSetWorkDir: (workDir: SessionWorkDir) => boolean;
  onSetContextSelection: (selection: SessionContextSelection) => boolean;
  onNewSession: () => void;
};

const DEFAULT_LABELS: SessionContextLabels = {
  title: 'Context',
  workDir: 'WorkDir',
  spaces: 'Spaces',
  assistants: 'Assistants',
  mindRoot: 'Mind root',
  none: 'None',
  locked: 'Locked after first message',
  editWorkDir: 'Set work directory',
  workDirPlaceholder: '/path/to/project',
  workDirBrowse: 'Choose work directory',
  workDirBrowseUnavailable: 'Folder picker is available in the desktop app',
  addSpace: 'Add Space',
  addAssistant: 'Add Assistant',
  newSession: 'New',
  removeItem: (label) => `Remove ${label}`,
  spacePlaceholder: 'Space path',
  assistantPlaceholder: 'assistant-id',
  applyNextTurn: 'Changes apply to the next message.',
  spacesCount: (n) => `${n} space${n === 1 ? '' : 's'}`,
  assistantsCount: (n) => `${n} assistant${n === 1 ? '' : 's'}`,
};

function shortPath(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const parts = value.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.at(-1) ?? value;
}

function chipLabel(value: { label?: string; path?: string; name?: string; id?: string }): string {
  return value.label?.trim() || value.name?.trim() || value.path?.trim() || value.id?.trim() || '';
}

function pathLabel(path: string): string {
  return path.replace(/\\/g, '/').split('/').filter(Boolean).at(-1) || path;
}

function addSpace(selection: SessionContextSelection, raw: string): SessionContextSelection {
  const path = raw.trim().replace(/\\/g, '/');
  if (!path) return selection;
  return normalizeSessionContextSelectionForClient({
    ...selection,
    spaces: [
      ...selection.spaces,
      { path, label: pathLabel(path), source: 'manual' },
    ],
  });
}

function addAssistant(selection: SessionContextSelection, raw: string): SessionContextSelection {
  const id = raw.trim().toLowerCase();
  if (!id) return selection;
  return normalizeSessionContextSelectionForClient({
    ...selection,
    assistants: [
      ...selection.assistants,
      { id, name: id, kind: 'assistant', source: 'manual' },
    ],
  });
}

function workDirToDraftValue(workDir: SessionWorkDir | undefined): string {
  return workDir?.source === 'mind-root' ? '' : workDir?.path ?? '';
}

export default function SessionContextDock({
  session,
  labels,
  workDirEditable,
  compact = false,
  onSetWorkDir,
  onSetContextSelection,
  onNewSession,
}: SessionContextDockProps) {
  const [expanded, setExpanded] = useState(false);
  const [workDirDraftState, setWorkDirDraftState] = useState({ key: '', value: '' });
  const [spaceDraft, setSpaceDraft] = useState('');
  const [assistantDraft, setAssistantDraft] = useState('');
  const resolvedLabels = useMemo<SessionContextLabels>(() => ({
    ...DEFAULT_LABELS,
    ...labels,
  }), [labels]);

  const workDir = useMemo(() => session ? getEffectiveSessionWorkDir(session) : undefined, [session]);
  const selection = useMemo(() => session ? getEffectiveSessionContextSelection(session) : normalizeSessionContextSelectionForClient(null), [session]);
  const workDirDraftKey = `${session?.id ?? 'draft'}:${workDir?.source ?? 'mind-root'}:${workDir?.path ?? ''}`;
  const workDirDraft = workDirDraftState.key === workDirDraftKey
    ? workDirDraftState.value
    : workDirToDraftValue(workDir);
  const workDirDisplay = workDir?.source === 'mind-root'
    ? resolvedLabels.mindRoot
    : shortPath(workDir?.path, workDir?.label || resolvedLabels.mindRoot);

  const setWorkDirDraft = (value: string) => {
    setWorkDirDraftState({ key: workDirDraftKey, value });
  };

  const commitWorkDir = (nextValue = workDirDraft) => {
    if (!workDirEditable) return;
    const trimmed = nextValue.trim();
    onSetWorkDir(trimmed
      ? {
        source: 'manual',
        path: trimmed,
        label: shortPath(trimmed, trimmed),
      }
      : {
        source: 'mind-root',
        label: resolvedLabels.mindRoot,
      });
  };

  const submitSpace = () => {
    const next = addSpace(selection, spaceDraft);
    if (next !== selection && onSetContextSelection(next)) setSpaceDraft('');
  };

  const submitAssistant = () => {
    const next = addAssistant(selection, assistantDraft);
    if (next !== selection && onSetContextSelection(next)) setAssistantDraft('');
  };

  const removeSpace = (path: string) => {
    onSetContextSelection({
      ...selection,
      spaces: selection.spaces.filter((space) => space.path !== path),
    });
  };

  const removeAssistant = (id: string) => {
    onSetContextSelection({
      ...selection,
      assistants: selection.assistants.filter((assistant) => assistant.id !== id),
    });
  };

  return (
    <div className="border-b border-border/30">
      {expanded && (
        <div
          className={cn('px-3 pt-2.5 pb-2 space-y-2 bg-background/35', compact && 'px-2')}
          onKeyDownCapture={(event) => {
            if (event.key !== 'Escape') return;
            setExpanded(false);
            event.stopPropagation();
          }}
        >
          <div className="grid gap-1.5 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-center">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
              <BriefcaseBusiness size={13} />
              <span>{resolvedLabels.workDir}</span>
            </div>
            <div className="min-w-0 flex items-center gap-1.5">
              {workDirEditable ? (
                <PathAutocompleteField
                  value={workDirDraft}
                  onChange={setWorkDirDraft}
                  onCommit={commitWorkDir}
                  commitOnSelect
                  placeholder={resolvedLabels.workDirPlaceholder}
                  ariaLabel={resolvedLabels.editWorkDir}
                  browseLabel={resolvedLabels.workDirBrowse}
                  browseUnavailableLabel={resolvedLabels.workDirBrowseUnavailable}
                  wrapperClassName="min-w-0 flex-1"
                  inputClassName="h-8 rounded-lg border-border/40 bg-background/60 px-2 py-1 pr-9 text-xs"
                  browseButtonClassName="right-1 h-6 w-6 rounded-md"
                  suggestionsClassName="text-xs"
                  suggestionClassName="py-1.5 text-xs"
                />
              ) : (
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-lg bg-muted/35 px-2 py-1.5">
                  <span className="truncate text-xs text-foreground" title={workDir?.path || workDirDisplay}>{workDirDisplay}</span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{resolvedLabels.locked}</span>
                </div>
              )}
              {!workDirEditable && (
                <button
                  type="button"
                  onClick={onNewSession}
                  className="shrink-0 rounded-lg px-2 py-1 text-[11px] text-muted-foreground hover:bg-muted/60 hover:text-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {resolvedLabels.newSession}
                </button>
              )}
            </div>
          </div>

          <ContextRow
            icon={<Layers3 size={13} />}
            label={resolvedLabels.spaces}
            emptyLabel={resolvedLabels.none}
            inputValue={spaceDraft}
            inputPlaceholder={resolvedLabels.spacePlaceholder}
            addTitle={resolvedLabels.addSpace}
            onInputChange={setSpaceDraft}
            onSubmit={submitSpace}
            chips={selection.spaces.map((space) => ({
              id: space.path,
              label: chipLabel(space),
              title: space.path,
              removeLabel: resolvedLabels.removeItem(chipLabel(space)),
              onRemove: () => removeSpace(space.path),
            }))}
          />

          <ContextRow
            icon={<Bot size={13} />}
            label={resolvedLabels.assistants}
            emptyLabel={resolvedLabels.none}
            inputValue={assistantDraft}
            inputPlaceholder={resolvedLabels.assistantPlaceholder}
            addTitle={resolvedLabels.addAssistant}
            onInputChange={setAssistantDraft}
            onSubmit={submitAssistant}
            chips={selection.assistants.map((assistant) => ({
              id: assistant.id,
              label: chipLabel(assistant),
              title: assistant.id,
              removeLabel: resolvedLabels.removeItem(chipLabel(assistant)),
              onRemove: () => removeAssistant(assistant.id),
            }))}
          />

          <div className="pl-0 sm:pl-[82px] text-[11px] text-muted-foreground">
            {resolvedLabels.applyNextTurn}
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setExpanded(false);
        }}
        aria-expanded={expanded}
        className={cn(
          'w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact && 'px-2',
        )}
      >
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
        <span className="font-medium text-foreground">{resolvedLabels.title}</span>
        <span className="min-w-0 flex-1 truncate" title={workDir?.path || workDirDisplay}>
          {workDirDisplay}
        </span>
        <span className="hidden sm:inline">{resolvedLabels.spacesCount(selection.spaces.length)}</span>
        <span className="hidden sm:inline">{resolvedLabels.assistantsCount(selection.assistants.length)}</span>
      </button>
    </div>
  );
}

function ContextRow({
  icon,
  label,
  emptyLabel,
  inputValue,
  inputPlaceholder,
  addTitle,
  chips,
  onInputChange,
  onSubmit,
}: {
  icon: ReactNode;
  label: string;
  emptyLabel: string;
  inputValue: string;
  inputPlaceholder: string;
  addTitle: string;
  chips: Array<{ id: string; label: string; title: string; removeLabel: string; onRemove: () => void }>;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[82px_minmax(0,1fr)] sm:items-start">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground pt-1">
        {icon}
        <span>{label}</span>
      </div>
      <div className="min-w-0 flex flex-wrap items-center gap-1.5">
        {chips.length === 0 && (
          <span className="rounded-md bg-muted/25 px-2 py-1 text-[11px] text-muted-foreground">
            {emptyLabel}
          </span>
        )}
        {chips.map((chip) => (
          <span
            key={chip.id}
            title={chip.title}
            className="group max-w-[180px] inline-flex items-center gap-1 rounded-md bg-muted/45 px-2 py-1 text-[11px] text-foreground"
          >
            <span className="truncate">{chip.label}</span>
            <button
              type="button"
              onClick={chip.onRemove}
              className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
              aria-label={chip.removeLabel}
            >
              <X size={12} />
            </button>
          </span>
        ))}
        <div className="min-w-[150px] flex items-center gap-1 rounded-md border border-border/40 bg-background/60 px-2 py-1">
          <input
            value={inputValue}
            onChange={(event) => onInputChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                onSubmit();
              }
            }}
            placeholder={inputPlaceholder}
            className="min-w-0 flex-1 bg-transparent text-[11px] text-foreground outline-none placeholder:text-muted-foreground"
            aria-label={addTitle}
          />
          <button
            type="button"
            onClick={onSubmit}
            className="hit-target-box p-0.5 text-muted-foreground hover:text-foreground transition-colors [--hit-target-hover-bg:color-mix(in_srgb,var(--muted)_65%,transparent)] [--hit-target-radius:var(--radius-md)]"
            title={addTitle}
            aria-label={addTitle}
          >
            <Plus size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
