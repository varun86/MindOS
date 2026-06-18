import {
  addUniqueContextItem,
  contextChipLabel,
  contextItemIcon,
  contextPathLabel,
  type ContextSelectableItem,
} from '@/components/shared/ContextTokenPicker';
import { normalizeSessionContextSelectionForClient } from '@/lib/session-context';
import type { ContextAssistantRef, ContextSpaceRef } from '@/lib/types';
import {
  getStudioProjectAssistantRefs,
  getStudioProjectSpaceRefs,
  localize,
  type StudioProject,
} from '@/lib/studio-projects';

export type StudioContextPickerKind = 'spaces' | 'assistants';

export const BUILT_IN_SPACES: ContextSelectableItem[] = [
  { id: 'MIND_DAO', label: '道', icon: '道', description: 'MindOS System' },
  { id: 'MIND_FA', label: '法', icon: '法', description: 'MindOS System' },
  { id: 'MIND_SHU', label: '术', icon: '术', description: 'MindOS System' },
  { id: 'MIND_QI', label: '器', icon: '器', description: 'MindOS System' },
];

export const BUILT_IN_ASSISTANTS: ContextSelectableItem[] = [
  { id: 'research-kit', label: 'Research Kit', icon: 'R' },
  { id: 'review-kit', label: 'Review Kit', icon: 'R' },
  { id: 'launch-writing-kit', label: 'Launch Writing Kit', icon: 'L' },
  { id: 'capture-organize-kit', label: 'Capture Organize Kit', icon: 'C' },
  { id: 'inbox-organizer', label: 'Inbox Organizer', icon: 'I' },
  { id: 'decision-synthesizer', label: 'Decision Synthesizer', icon: 'D' },
];

export const DEFAULT_SPACES: ContextSpaceRef[] = [
  { path: 'MIND_DAO', label: '道', icon: '道', source: 'project-default' },
];

export const DEFAULT_ASSISTANTS: ContextAssistantRef[] = [
  { id: 'research-kit', name: 'Research Kit', kind: 'team', source: 'builtin' },
];

export function normalizeSpaces(spaces: ContextSpaceRef[]): ContextSpaceRef[] {
  return normalizeSessionContextSelectionForClient({ version: 1, spaces, assistants: [] }).spaces;
}

export function normalizeAssistants(assistants: ContextAssistantRef[]): ContextAssistantRef[] {
  return normalizeSessionContextSelectionForClient({ version: 1, spaces: [], assistants }).assistants;
}

export function spaceToCandidate(space: ContextSpaceRef, description?: string): ContextSelectableItem {
  const label = contextChipLabel(space) || contextPathLabel(space.path);
  return {
    id: space.path,
    label,
    icon: space.icon || contextItemIcon(label),
    ...(description ? { description } : {}),
  };
}

export function assistantToCandidate(assistant: ContextAssistantRef, description?: string): ContextSelectableItem {
  const label = contextChipLabel(assistant) || assistant.id;
  return {
    id: assistant.id,
    label,
    icon: contextItemIcon(label),
    ...(description ? { description } : {}),
  };
}

export function spaceFromCandidate(candidate: ContextSelectableItem): ContextSpaceRef {
  return {
    path: candidate.id,
    label: candidate.label || contextPathLabel(candidate.id),
    icon: candidate.icon,
    source: 'manual',
  };
}

export function assistantFromCandidate(candidate: ContextSelectableItem): ContextAssistantRef {
  return {
    id: candidate.id.toLowerCase(),
    name: candidate.label || candidate.id,
    kind: 'team',
    source: 'manual',
  };
}

export function buildSpaceCandidates(projects: StudioProject[], locale: string, sourceLabel: string): ContextSelectableItem[] {
  return projects
    .flatMap((project) => getStudioProjectSpaceRefs(project, locale).map((space) => (
      spaceToCandidate(space, `${sourceLabel}: ${localize(project.title, project.titleZh, locale)}`)
    )))
    .reduce(addUniqueContextItem, BUILT_IN_SPACES);
}

export function buildAssistantCandidates(projects: StudioProject[], locale: string, sourceLabel: string): ContextSelectableItem[] {
  return projects
    .flatMap((project) => getStudioProjectAssistantRefs(project).map((assistant) => (
      assistantToCandidate(assistant, `${sourceLabel}: ${localize(project.title, project.titleZh, locale)}`)
    )))
    .reduce(addUniqueContextItem, BUILT_IN_ASSISTANTS);
}

export function studioContextPickerCopy(locale: string) {
  if (locale === 'zh') {
    return {
      mind: 'Mind',
      addSpace: '添加 Space',
      addAssistant: '添加 AI Kit',
      searchSpaces: '搜索 Space',
      searchAssistants: '搜索 AI Kit',
      noMatches: '没有匹配项',
      chooseWorkDir: '选择目录',
      chooseWorkDirUnavailable: '目录选择器仅在桌面端可用',
      remove: (label: string) => `移除 ${label}`,
    };
  }
  return {
    mind: 'Mind',
    addSpace: 'Add Space',
    addAssistant: 'Add AI Kit',
    searchSpaces: 'Search Spaces',
    searchAssistants: 'Search AI Kit',
    noMatches: 'No matches',
    chooseWorkDir: 'Choose folder',
    chooseWorkDirUnavailable: 'Folder picker is available in the desktop app',
    remove: (label: string) => `Remove ${label}`,
  };
}
