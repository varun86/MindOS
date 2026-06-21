import type { PluginManifest } from './types';

export type ObsidianCommunityManifestPolicySeverity = 'warning' | 'review';

export interface ObsidianCommunityManifestPolicyIssue {
  code: string;
  field: string;
  severity: ObsidianCommunityManifestPolicySeverity;
  message: string;
}

export interface ObsidianCommunityManifestPolicyReport {
  status: 'ok' | 'review';
  issues: ObsidianCommunityManifestPolicyIssue[];
}

const OFFICIAL_COMMUNITY_ID_PATTERN = /^[a-z][a-z-]*$/;

export function lintObsidianCommunityManifestPolicy(
  manifest: PluginManifest,
): ObsidianCommunityManifestPolicyReport {
  const issues: ObsidianCommunityManifestPolicyIssue[] = [];

  if (!OFFICIAL_COMMUNITY_ID_PATTERN.test(manifest.id)) {
    issues.push(policyIssue(
      'community-id-format',
      'id',
      'review',
      'Obsidian community submission policy currently expects plugin IDs to use lowercase letters and hyphens.',
    ));
  }

  if (manifest.id.includes('obsidian')) {
    issues.push(policyIssue(
      'community-id-contains-obsidian',
      'id',
      'review',
      'Obsidian community submission policy does not allow new plugin IDs to contain "obsidian".',
    ));
  }

  if (manifest.id.endsWith('plugin')) {
    issues.push(policyIssue(
      'community-id-ends-plugin',
      'id',
      'review',
      'Obsidian community submission policy does not allow new plugin IDs to end with "plugin".',
    ));
  }

  if (!manifest.author?.trim()) {
    issues.push(policyIssue(
      'manifest-author-missing',
      'author',
      'review',
      'Obsidian community manifests should include an author.',
    ));
  }

  if (!manifest.minAppVersion?.trim()) {
    issues.push(policyIssue(
      'manifest-min-app-version-missing',
      'minAppVersion',
      'review',
      'Obsidian community manifests should include minAppVersion so compatibility release selection is auditable.',
    ));
  }

  if (!manifest.description?.trim()) {
    issues.push(policyIssue(
      'manifest-description-missing',
      'description',
      'review',
      'Obsidian community manifests should include a description for review and catalog display.',
    ));
  }

  if (typeof manifest.isDesktopOnly !== 'boolean') {
    issues.push(policyIssue(
      'manifest-desktop-only-missing',
      'isDesktopOnly',
      'review',
      'Obsidian community manifests should explicitly declare isDesktopOnly.',
    ));
  }

  return {
    status: issues.some((issue) => issue.severity === 'review') ? 'review' : 'ok',
    issues,
  };
}

function policyIssue(
  code: string,
  field: string,
  severity: ObsidianCommunityManifestPolicySeverity,
  message: string,
): ObsidianCommunityManifestPolicyIssue {
  return { code, field, severity, message };
}
