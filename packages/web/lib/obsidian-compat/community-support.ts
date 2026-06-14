import {
  getObsidianImportSupport,
  type ObsidianImportSupportKind,
} from './import-policy';
import type { CompatibilityLevel, PluginCompatibilityReport } from './compatibility-report';

export type ObsidianCommunityPreflightSupportLevel = ObsidianImportSupportKind;
export type ObsidianCommunitySurfacePreviewId =
  | 'commands'
  | 'settings'
  | 'entries'
  | 'views'
  | 'document'
  | 'styles'
  | 'editor'
  | 'vault'
  | 'network';
export type ObsidianCommunitySurfacePreviewState = 'mounted' | 'limited' | 'catalog' | 'blocked';

export interface ObsidianCommunityPreflightSupport {
  kind: ObsidianCommunityPreflightSupportLevel;
  label: string;
  reason: string;
  installable: boolean;
}

export interface ObsidianCommunitySurfacePreview {
  id: ObsidianCommunitySurfacePreviewId;
  state: ObsidianCommunitySurfacePreviewState;
  count: number;
}

export interface ObsidianCommunitySupportInput {
  compatibility: {
    level: CompatibilityLevel;
    report: PluginCompatibilityReport;
  };
  installable: boolean;
  installBlockedReasons?: string[];
  stylesCss: boolean;
}

interface CommunitySurfacePreviewDefinition {
  id: ObsidianCommunitySurfacePreviewId;
  state: ObsidianCommunitySurfacePreviewState;
  apiNames?: string[];
  countFrom?: (apiNames: Set<string>, input: ObsidianCommunitySupportInput) => number;
}

const COMMUNITY_SURFACE_PREVIEW_DEFINITIONS: CommunitySurfacePreviewDefinition[] = [
  {
    id: 'commands',
    state: 'mounted',
    apiNames: ['addCommand', 'removeCommand'],
  },
  {
    id: 'settings',
    state: 'mounted',
    apiNames: ['PluginSettingTab', 'Setting', 'addSettingTab'],
  },
  {
    id: 'entries',
    state: 'mounted',
    apiNames: [
      'addRibbonIcon',
      'addStatusBarItem',
      'Notice',
      'Modal',
      'Menu',
      'MenuItem',
      'SuggestModal',
      'FuzzySuggestModal',
    ],
  },
  {
    id: 'views',
    state: 'limited',
    apiNames: [
      'registerView',
      'registerExtensions',
      'ItemView',
      'WorkspaceLeaf',
      'Workspace.getLeaf',
      'Workspace.getLeavesOfType',
    ],
  },
  {
    id: 'document',
    state: 'limited',
    apiNames: [
      'registerMarkdownPostProcessor',
      'registerMarkdownCodeBlockProcessor',
      'MarkdownRenderer',
      'MarkdownView',
      'MarkdownRenderChild',
    ],
  },
  {
    id: 'styles',
    state: 'mounted',
    countFrom: (_apiNames, input) => input.stylesCss ? 1 : 0,
  },
  {
    id: 'editor',
    state: 'catalog',
    apiNames: ['registerEditorExtension'],
  },
  {
    id: 'vault',
    state: 'mounted',
    countFrom: countVaultLikeApis,
  },
  {
    id: 'network',
    state: 'limited',
    apiNames: ['request', 'requestUrl'],
  },
];

export function buildObsidianCommunityPreflightSupport(
  input: ObsidianCommunitySupportInput,
): ObsidianCommunityPreflightSupport {
  if (!input.installable) {
    return {
      kind: 'blocked',
      label: 'Blocked',
      reason: input.installBlockedReasons?.[0]
        ?? input.compatibility.report.blockers[0]
        ?? 'Blocked by preflight compatibility checks.',
      installable: false,
    };
  }

  const support = getObsidianImportSupport({
    compatibilityLevel: input.compatibility.level,
    compatibility: {
      partialApis: input.compatibility.report.partialApis,
      unsupportedApis: input.compatibility.report.unsupportedApis,
      blockers: input.compatibility.report.blockers,
    },
  });

  return {
    kind: support.kind,
    label: support.label,
    reason: support.reason,
    installable: input.installable,
  };
}

export function buildObsidianCommunitySurfacePreview(
  input: ObsidianCommunitySupportInput,
): ObsidianCommunitySurfacePreview[] {
  const apiNames = collectApiNames(input.compatibility.report);
  const blocked = !input.installable || input.compatibility.level === 'blocked';

  return COMMUNITY_SURFACE_PREVIEW_DEFINITIONS
    .map((definition) => {
      const count = definition.countFrom
        ? definition.countFrom(apiNames, input)
        : countMatchingApis(apiNames, definition.apiNames ?? []);
      if (count <= 0) return null;
      return {
        id: definition.id,
        state: blocked ? 'blocked' as const : definition.state,
        count,
      };
    })
    .filter((prediction): prediction is ObsidianCommunitySurfacePreview => prediction !== null);
}

function collectApiNames(report: PluginCompatibilityReport): Set<string> {
  return new Set([
    ...report.obsidianApis,
    ...report.supportedApis,
    ...report.partialApis,
    ...(report.unsupportedApis ?? []),
  ]);
}

function countMatchingApis(apiNames: Set<string>, names: string[]): number {
  return names.filter((name) => apiNames.has(name)).length;
}

function countVaultLikeApis(apiNames: Set<string>): number {
  let count = 0;
  for (const name of apiNames) {
    if (
      name === 'loadData'
      || name === 'saveData'
      || name === 'TFile'
      || name === 'TFolder'
      || name === 'TAbstractFile'
      || name.startsWith('Vault.')
      || name.startsWith('FileManager.')
      || name.startsWith('MetadataCache.')
    ) {
      count += 1;
    }
  }
  return count;
}
