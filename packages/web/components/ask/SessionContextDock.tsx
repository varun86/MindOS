'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Layers3,
  Lock,
} from 'lucide-react';
import PathAutocompleteField from '@/components/shared/PathAutocompleteField';
import {
  addUniqueContextItem,
  contextChipLabel,
  contextItemIcon,
  contextPathLabel,
  ContextSelectionRow,
  type ContextSelectableItem,
} from '@/components/shared/ContextTokenPicker';
import type {
  ChatSession,
  ContextAssistantRef,
  ContextSpaceRef,
  SessionContextSelection,
  SessionWorkDir,
} from '@/lib/types';
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
  searchSpaces: string;
  searchAssistants: string;
  noMatches: string;
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
  mindRoot: 'Mind',
  none: 'None',
  locked: 'Locked after first message',
  editWorkDir: 'Set work directory',
  workDirPlaceholder: '/path/to/project',
  workDirBrowse: 'Choose work directory',
  workDirBrowseUnavailable: 'Folder picker is available in the desktop app',
  addSpace: 'Add Space',
  addAssistant: 'Add Assistant',
  searchSpaces: 'Search spaces',
  searchAssistants: 'Search assistants',
  noMatches: 'No matches',
  newSession: 'New',
  removeItem: (label) => `Remove ${label}`,
  spacePlaceholder: 'Space path',
  assistantPlaceholder: 'assistant-id',
  applyNextTurn: 'Changes apply to the next message.',
  spacesCount: (n) => `${n} space${n === 1 ? '' : 's'}`,
  assistantsCount: (n) => `${n} assistant${n === 1 ? '' : 's'}`,
};

type PickerKind = 'spaces' | 'assistants';

type TrayPosition = {
  left: number;
  width: number;
  bottom: number;
  maxHeight: number;
};

const BASE_SPACE_CANDIDATES: ContextSelectableItem[] = [
  { id: 'MIND_DAO', label: '道', icon: '道' },
  { id: 'MIND_FA', label: '法', icon: '法' },
  { id: 'MIND_SHU', label: '术', icon: '术' },
  { id: 'MIND_QI', label: '器', icon: '器' },
];

const BASE_ASSISTANT_CANDIDATES: ContextSelectableItem[] = [
  { id: 'inbox-organizer', label: 'Inbox Organizer', icon: 'I' },
  { id: 'dreaming', label: 'Dreaming', icon: 'D' },
  { id: 'daily-signal', label: 'Daily Signal', icon: 'D' },
  { id: 'decision-synthesizer', label: 'Decision Synthesizer', icon: 'D' },
  { id: 'rule-keeper', label: 'Rule Keeper', icon: 'R' },
  { id: 'method-organizer', label: 'Method Organizer', icon: 'M' },
  { id: 'tool-inventory', label: 'Tool Inventory', icon: 'T' },
];

function shortPath(value: string | undefined, fallback: string): string {
  if (!value?.trim()) return fallback;
  const parts = value.replace(/\\/g, '/').split('/').filter(Boolean);
  return parts.at(-1) ?? value;
}

function spaceToCandidate(space: ContextSpaceRef): ContextSelectableItem {
  const label = contextChipLabel(space) || contextPathLabel(space.path);
  return {
    id: space.path,
    label,
    icon: space.icon || contextItemIcon(label),
  };
}

function assistantToCandidate(assistant: ContextAssistantRef): ContextSelectableItem {
  const label = contextChipLabel(assistant) || assistant.id;
  return {
    id: assistant.id,
    label,
    icon: contextItemIcon(label),
  };
}

function buildSpaceCandidates(selection: SessionContextSelection): ContextSelectableItem[] {
  return selection.spaces
    .map(spaceToCandidate)
    .reduce(addUniqueContextItem, BASE_SPACE_CANDIDATES);
}

function buildAssistantCandidates(selection: SessionContextSelection): ContextSelectableItem[] {
  return selection.assistants
    .map(assistantToCandidate)
    .reduce(addUniqueContextItem, BASE_ASSISTANT_CANDIDATES);
}

function addSpace(selection: SessionContextSelection, candidate: ContextSelectableItem): SessionContextSelection {
  const path = candidate.id.trim().replace(/\\/g, '/');
  if (!path) return selection;
  return normalizeSessionContextSelectionForClient({
    ...selection,
    spaces: [
      ...selection.spaces,
      { path, label: candidate.label || contextPathLabel(path), icon: candidate.icon, source: 'manual' },
    ],
  });
}

function addAssistant(selection: SessionContextSelection, candidate: ContextSelectableItem): SessionContextSelection {
  const id = candidate.id.trim().toLowerCase();
  if (!id) return selection;
  return normalizeSessionContextSelectionForClient({
    ...selection,
    assistants: [
      ...selection.assistants,
      { id, name: candidate.label || id, kind: 'assistant', source: 'manual' },
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
  const rootRef = useRef<HTMLDivElement>(null);
  const trayRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState(false);
  const [trayPosition, setTrayPosition] = useState<TrayPosition | null>(null);
  const [workDirDraftState, setWorkDirDraftState] = useState({ key: '', value: '' });
  const [openPicker, setOpenPicker] = useState<PickerKind | null>(null);
  const [spaceQuery, setSpaceQuery] = useState('');
  const [assistantQuery, setAssistantQuery] = useState('');
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
  const workDirDisplay = !workDir || workDir.source === 'mind-root'
    ? resolvedLabels.mindRoot
    : shortPath(workDir?.path, workDir?.label || resolvedLabels.mindRoot);
  const workDirInputPlaceholder = !workDir || workDir.source === 'mind-root'
    ? resolvedLabels.mindRoot
    : resolvedLabels.workDirPlaceholder;
  const spaceCandidates = useMemo(() => buildSpaceCandidates(selection), [selection]);
  const assistantCandidates = useMemo(() => buildAssistantCandidates(selection), [selection]);

  useLayoutEffect(() => {
    if (!expanded) return;

    const updateTrayPosition = () => {
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect || typeof window === 'undefined') return;

      const viewportPadding = 8;
      const gap = 8;
      const width = Math.min(rect.width, window.innerWidth - viewportPadding * 2);
      const left = Math.max(
        viewportPadding,
        Math.min(rect.left, window.innerWidth - viewportPadding - width),
      );
      const bottom = Math.max(viewportPadding, window.innerHeight - rect.top + gap);
      const maxHeight = Math.max(120, rect.top - viewportPadding - gap);
      const next = { left, width, bottom, maxHeight };

      setTrayPosition((current) => (
        current
        && Math.abs(current.left - next.left) < 0.5
        && Math.abs(current.width - next.width) < 0.5
        && Math.abs(current.bottom - next.bottom) < 0.5
        && Math.abs(current.maxHeight - next.maxHeight) < 0.5
          ? current
          : next
      ));
    };

    updateTrayPosition();
    window.addEventListener('resize', updateTrayPosition);
    window.addEventListener('scroll', updateTrayPosition, true);
    return () => {
      window.removeEventListener('resize', updateTrayPosition);
      window.removeEventListener('scroll', updateTrayPosition, true);
    };
  }, [expanded]);

  useLayoutEffect(() => {
    if (!expanded) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (rootRef.current?.contains(target) || trayRef.current?.contains(target)) return;
      setOpenPicker(null);
      setExpanded(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [expanded]);

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

  const selectSpace = (candidate: ContextSelectableItem) => {
    const next = addSpace(selection, candidate);
    if (next !== selection && onSetContextSelection(next)) {
      setSpaceQuery('');
      setOpenPicker(null);
    }
  };

  const selectAssistant = (candidate: ContextSelectableItem) => {
    const next = addAssistant(selection, candidate);
    if (next !== selection && onSetContextSelection(next)) {
      setAssistantQuery('');
      setOpenPicker(null);
    }
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

  const trayStyle: CSSProperties = trayPosition
    ? {
      left: trayPosition.left,
      width: trayPosition.width,
      bottom: trayPosition.bottom,
      maxHeight: trayPosition.maxHeight,
    }
    : { left: 0, width: 0, bottom: 0, visibility: 'hidden' };

  return (
    <div ref={rootRef} className="relative border-b border-border/30">
      {expanded && typeof document !== 'undefined' && createPortal(
        <div
          ref={trayRef}
          className={cn(
            'fixed z-50 overflow-visible rounded-xl border border-border/50 bg-card/95 px-3 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90',
            compact && 'px-2.5',
          )}
          style={trayStyle}
          onKeyDownCapture={(event) => {
            if (event.key !== 'Escape') return;
            if (openPicker) setOpenPicker(null);
            else setExpanded(false);
            event.stopPropagation();
          }}
        >
          <div className="grid gap-2 sm:grid-cols-[88px_minmax(0,1fr)] sm:items-center">
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
                  placeholder={workDirInputPlaceholder}
                  ariaLabel={resolvedLabels.editWorkDir}
                  browseLabel={resolvedLabels.workDirBrowse}
                  browseUnavailableLabel={resolvedLabels.workDirBrowseUnavailable}
                  wrapperClassName="min-w-0 flex-1"
                  inputClassName="h-8 rounded-lg border-border/45 bg-background/70 px-2.5 py-1 pr-9 text-xs"
                  browseButtonClassName="right-1 h-6 w-6 rounded-md"
                  suggestionsClassName="text-xs"
                  suggestionClassName="py-1.5 text-xs"
                />
              ) : (
                <div className="min-w-0 flex-1 flex items-center justify-between gap-2 rounded-lg bg-muted/35 px-2 py-1.5">
                  <span className="truncate text-xs text-foreground" title={workDir?.path || workDirDisplay}>{workDirDisplay}</span>
                  <span
                    role="img"
                    aria-label={resolvedLabels.locked}
                    title={resolvedLabels.locked}
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-muted-foreground"
                  >
                    <Lock size={12} />
                  </span>
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

          <ContextSelectionRow
            kind="spaces"
            icon={<Layers3 size={13} />}
            label={resolvedLabels.spaces}
            addTitle={resolvedLabels.addSpace}
            searchLabel={resolvedLabels.searchSpaces}
            noMatchesLabel={resolvedLabels.noMatches}
            query={spaceQuery}
            onQueryChange={setSpaceQuery}
            open={openPicker === 'spaces'}
            onOpenChange={(open) => setOpenPicker(open ? 'spaces' : null)}
            candidates={spaceCandidates}
            selectedIds={new Set(selection.spaces.map((space) => space.path))}
            onSelect={selectSpace}
            chips={selection.spaces.map((space) => ({
              id: space.path,
              label: contextChipLabel(space),
              icon: space.icon || contextItemIcon(contextChipLabel(space), 'S'),
              title: space.path,
              removeLabel: resolvedLabels.removeItem(contextChipLabel(space)),
              onRemove: () => removeSpace(space.path),
            }))}
          />

          <ContextSelectionRow
            kind="assistants"
            icon={<Bot size={13} />}
            label={resolvedLabels.assistants}
            addTitle={resolvedLabels.addAssistant}
            searchLabel={resolvedLabels.searchAssistants}
            noMatchesLabel={resolvedLabels.noMatches}
            query={assistantQuery}
            onQueryChange={setAssistantQuery}
            open={openPicker === 'assistants'}
            onOpenChange={(open) => setOpenPicker(open ? 'assistants' : null)}
            candidates={assistantCandidates}
            selectedIds={new Set(selection.assistants.map((assistant) => assistant.id))}
            onSelect={selectAssistant}
            chips={selection.assistants.map((assistant) => ({
              id: assistant.id,
              label: contextChipLabel(assistant),
              icon: contextItemIcon(contextChipLabel(assistant), 'A'),
              title: assistant.id,
              removeLabel: resolvedLabels.removeItem(contextChipLabel(assistant)),
              onRemove: () => removeAssistant(assistant.id),
            }))}
          />

          <div className="pl-0 sm:pl-[88px]">
            <span
              role="img"
              aria-label={resolvedLabels.applyNextTurn}
              title={resolvedLabels.applyNextTurn}
              className="inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/75"
            >
              <CircleHelp size={13} />
            </span>
          </div>
        </div>,
        document.body,
      )}

      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        onKeyDown={(event) => {
          if (event.key === 'Escape') setExpanded(false);
        }}
        aria-label={resolvedLabels.title}
        aria-expanded={expanded}
        className={cn(
          'group w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted/35 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          compact && 'px-2',
        )}
      >
        <SummaryItem
          icon={<BriefcaseBusiness size={13} />}
          title={resolvedLabels.workDir}
          value={workDirDisplay}
          detail={workDir?.path}
          className="max-w-[44%] sm:max-w-[40%]"
        />
        <SummaryItem
          icon={<Layers3 size={13} />}
          title={resolvedLabels.spaces}
          value={resolvedLabels.spacesCount(selection.spaces.length)}
          compactValue={String(selection.spaces.length)}
        />
        <SummaryItem
          icon={<Bot size={13} />}
          title={resolvedLabels.assistants}
          value={resolvedLabels.assistantsCount(selection.assistants.length)}
          compactValue={String(selection.assistants.length)}
        />
        <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors group-hover:text-foreground">
          {expanded ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>
    </div>
  );
}

function SummaryItem({
  icon,
  title,
  value,
  compactValue,
  detail,
  className,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  compactValue?: string;
  detail?: string;
  className?: string;
}) {
  return (
    <span
      className={cn('inline-flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-0.5 text-muted-foreground', className)}
      title={detail || `${title}: ${value}`}
    >
      {icon}
      <span className="min-w-0 truncate font-normal text-muted-foreground">
        <span className="hidden sm:inline">{value}</span>
        <span className="sm:hidden">{compactValue ?? value}</span>
      </span>
    </span>
  );
}
