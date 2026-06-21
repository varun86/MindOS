import { describe, expect, it } from 'vitest';
import { lintObsidianCommunityManifestPolicy } from '@/lib/obsidian-compat/manifest-policy';
import { validateManifest } from '@/lib/obsidian-compat/manifest';

describe('Obsidian community manifest policy', () => {
  it('keeps the package parser permissive while flagging legacy community policy issues', () => {
    const manifest = validateManifest({
      id: 'obsidian-legacy_plugin',
      name: 'Legacy Plugin',
      version: '1.0.0',
    });

    const policy = lintObsidianCommunityManifestPolicy(manifest);

    expect(manifest.id).toBe('obsidian-legacy_plugin');
    expect(policy).toMatchObject({
      status: 'review',
      issues: expect.arrayContaining([
        expect.objectContaining({ code: 'community-id-format', field: 'id' }),
        expect.objectContaining({ code: 'community-id-contains-obsidian', field: 'id' }),
        expect.objectContaining({ code: 'manifest-author-missing', field: 'author' }),
        expect.objectContaining({ code: 'manifest-min-app-version-missing', field: 'minAppVersion' }),
        expect.objectContaining({ code: 'manifest-description-missing', field: 'description' }),
        expect.objectContaining({ code: 'manifest-desktop-only-missing', field: 'isDesktopOnly' }),
      ]),
    });
  });

  it('accepts a modern community manifest policy shape without warnings', () => {
    const manifest = validateManifest({
      id: 'quickadd',
      name: 'QuickAdd',
      version: '1.2.3',
      minAppVersion: '1.7.2',
      description: 'Capture and automate notes.',
      author: 'Example Author',
      isDesktopOnly: false,
    });

    expect(lintObsidianCommunityManifestPolicy(manifest)).toEqual({
      status: 'ok',
      issues: [],
    });
  });
});
