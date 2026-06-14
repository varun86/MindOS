import { describe, expect, it } from 'vitest';
import {
  communityPreflightSupportClass,
  communityPreflightSupportLevel,
  communityPreflightSurfaces,
} from '@/components/settings/PluginsTabModel';
import {
  buildObsidianCommunityPreflightSupport,
  buildObsidianCommunitySurfacePreview,
} from '@/lib/obsidian-compat/community-support';
import type { ObsidianCommunityPluginPreflight } from '@/lib/obsidian-compat/community-catalog';

function preflight(
  overrides: Partial<ObsidianCommunityPluginPreflight> & {
    compatibility?: Partial<ObsidianCommunityPluginPreflight['compatibility']>;
  } = {},
): ObsidianCommunityPluginPreflight {
  const compatibility = overrides.compatibility ?? {};
  const { compatibility: _compatibilityOverride, ...restOverrides } = overrides;
  const report = compatibility.report ?? {
    obsidianApis: ['Plugin'],
    moduleImports: [],
    nodeModules: [],
    unsupportedModules: [],
    supportedApis: ['Plugin'],
    partialApis: [],
    unsupportedApis: [],
    blockers: [],
  };

  const result = {
    ok: true,
    plugin: {
      id: 'quickadd',
      name: 'QuickAdd',
      repo: 'chhoumann/quickadd',
      githubUrl: 'https://github.com/chhoumann/quickadd',
    },
    package: {
      manifest: {
        id: 'quickadd',
        name: 'QuickAdd',
        version: '1.0.0',
      },
      assets: {
        manifestJson: true,
        mainJs: true,
        stylesCss: false,
      },
      source: {
        manifestUrl: 'https://raw.githubusercontent.com/chhoumann/quickadd/HEAD/manifest.json',
        mainUrl: 'https://raw.githubusercontent.com/chhoumann/quickadd/HEAD/main.js',
        stylesUrl: 'https://raw.githubusercontent.com/chhoumann/quickadd/HEAD/styles.css',
      },
      digest: {
        algorithm: 'sha256',
        manifestJson: 'manifest-digest',
        mainJs: 'main-digest',
        package: 'package-digest',
      },
    },
    compatibility: {
      level: compatibility.level ?? 'compatible',
      report,
    },
    installable: restOverrides.installable ?? true,
    installBlockedReasons: restOverrides.installBlockedReasons ?? [],
    ...restOverrides,
  } as Omit<ObsidianCommunityPluginPreflight, 'support' | 'surfacePreview'>;

  const supportInput = {
    compatibility: result.compatibility,
    installable: result.installable,
    installBlockedReasons: result.installBlockedReasons,
    stylesCss: result.package.assets.stylesCss,
  };

  return {
    ...result,
    support: buildObsidianCommunityPreflightSupport(supportInput),
    surfacePreview: buildObsidianCommunitySurfacePreview(supportInput),
  };
}

describe('PluginsTabModel community preflight support preview', () => {
  it('marks fully supported command plugins as ready and predicts mounted hosts', () => {
    const result = preflight({
      compatibility: {
        level: 'compatible',
        report: {
          obsidianApis: ['Plugin', 'addCommand', 'addSettingTab', 'Vault.create'],
          moduleImports: [],
          nodeModules: [],
          unsupportedModules: [],
          supportedApis: ['Plugin', 'addCommand', 'addSettingTab', 'Vault.create'],
          partialApis: [],
          unsupportedApis: [],
          blockers: [],
        },
      },
    });

    expect(communityPreflightSupportLevel(result)).toBe('ready');
    expect(communityPreflightSurfaces(result)).toEqual([
      { id: 'commands', state: 'mounted', count: 1 },
      { id: 'settings', state: 'mounted', count: 1 },
      { id: 'vault', state: 'mounted', count: 1 },
    ]);
  });

  it('marks partial document and view APIs as limited, not ready', () => {
    const result = preflight({
      compatibility: {
        level: 'partial',
        report: {
          obsidianApis: ['Plugin', 'registerView', 'registerMarkdownCodeBlockProcessor', 'registerEditorExtension'],
          moduleImports: [],
          nodeModules: [],
          unsupportedModules: [],
          supportedApis: ['Plugin'],
          partialApis: ['registerView', 'registerMarkdownCodeBlockProcessor', 'registerEditorExtension'],
          unsupportedApis: [],
          blockers: [],
        },
      },
      package: {
        ...preflight().package,
        assets: {
          manifestJson: true,
          mainJs: true,
          stylesCss: true,
        },
      },
    });

    expect(communityPreflightSupportLevel(result)).toBe('limited');
    expect(communityPreflightSurfaces(result)).toEqual([
      { id: 'views', state: 'limited', count: 1 },
      { id: 'document', state: 'limited', count: 1 },
      { id: 'styles', state: 'mounted', count: 1 },
      { id: 'editor', state: 'catalog', count: 1 },
    ]);
  });

  it('marks unsupported APIs as review even without hard blockers', () => {
    const result = preflight({
      compatibility: {
        level: 'partial',
        report: {
          obsidianApis: ['Plugin', 'FileSystemAdapter'],
          moduleImports: [],
          nodeModules: [],
          unsupportedModules: [],
          supportedApis: ['Plugin'],
          partialApis: [],
          unsupportedApis: ['FileSystemAdapter'],
          blockers: [],
        },
      },
    });

    expect(communityPreflightSupportLevel(result)).toBe('review');
    expect(communityPreflightSupportClass('review')).toContain('var(--amber)');
  });

  it('marks blocked packages as blocked and turns predicted surfaces into blocked diagnostics', () => {
    const result = preflight({
      installable: false,
      installBlockedReasons: ['Requires unsupported runtime module: fs'],
      compatibility: {
        level: 'blocked',
        report: {
          obsidianApis: ['Plugin', 'addCommand'],
          moduleImports: ['fs'],
          nodeModules: ['fs'],
          unsupportedModules: ['fs'],
          supportedApis: ['Plugin', 'addCommand'],
          partialApis: [],
          unsupportedApis: [],
          blockers: ['Requires unsupported runtime module: fs'],
        },
      },
    });

    expect(communityPreflightSupportLevel(result)).toBe('blocked');
    expect(communityPreflightSurfaces(result)).toEqual([
      { id: 'commands', state: 'blocked', count: 1 },
    ]);
  });
});
