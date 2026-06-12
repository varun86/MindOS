import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LAYOUT_Z, LAYOUT_Z_CLASS } from '@/lib/config/layout-layers';

const webRoot = path.join(__dirname, '..', '..');
const scanDirs = ['app', 'components'];

function readSource(relativePath: string): string {
  return readFileSync(path.join(webRoot, relativePath), 'utf8');
}

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name === '__tests__' || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(tsx|ts)$/.test(entry.name) && !/\.test\.(tsx|ts)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function scanSources(): { rel: string; lines: string[] }[] {
  return scanDirs.flatMap((dir) =>
    walk(path.join(webRoot, dir)).map((file) => ({
      rel: path.relative(webRoot, file).split(path.sep).join('/'),
      lines: readFileSync(file, 'utf8').split('\n'),
    })),
  );
}

describe('layout rule contracts', () => {
  it('keeps app-level z-index semantics named and ordered', () => {
    expect(LAYOUT_Z.NAV).toBe(30);
    expect(LAYOUT_Z.RAIL).toBeGreaterThan(LAYOUT_Z.NAV);
    expect(LAYOUT_Z.RAIL_AFFORDANCE).toBeGreaterThan(LAYOUT_Z.RAIL);
    expect(LAYOUT_Z.MODAL).toBeGreaterThan(LAYOUT_Z.OVERLAY);
    expect(LAYOUT_Z.POPOVER).toBeGreaterThan(LAYOUT_Z.MODAL);
    expect(LAYOUT_Z.POPOVER_FLYOUT).toBeGreaterThan(LAYOUT_Z.POPOVER);
    expect(LAYOUT_Z.WALKTHROUGH_BACKDROP).toBeGreaterThan(LAYOUT_Z.POPOVER_FLYOUT);
    expect(LAYOUT_Z.WALKTHROUGH_SURFACE).toBeGreaterThan(LAYOUT_Z.WALKTHROUGH_BACKDROP);
    expect(LAYOUT_Z.WALKTHROUGH_TOOLTIP).toBeGreaterThan(LAYOUT_Z.WALKTHROUGH_SURFACE);
    expect(LAYOUT_Z.CRITICAL_OVERLAY).toBeGreaterThan(LAYOUT_Z.WALKTHROUGH_TOOLTIP);

    const globals = readSource('app/globals.css');
    for (const className of Object.values(LAYOUT_Z_CLASS)) {
      expect(globals, `${className} must be defined in globals.css`).toContain(`.${className}`);
    }
  });

  it('does not add unnamed app-level z-index escape hatches', () => {
    const forbidden =
      /(?:z-\[(?:31|32|5[1-9]|6\d|10\d|[2-9]\d{2,})\]|zIndex:\s*(?:51|6\d|[1-9]\d{2,}))/;
    const violations: string[] = [];
    for (const { rel, lines } of scanSources()) {
      lines.forEach((line, index) => {
        if (forbidden.test(line)) violations.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }

    expect(
      violations,
      `Use packages/web/lib/config/layout-layers.ts plus z-app-* utilities for app-level layer exceptions:\n${violations.join('\n')}`,
    ).toEqual([]);
  });

  it('keeps page containers on shared shell rules', () => {
    const shell = readSource('components/shared/ContentPageShell.tsx');
    expect(shell).toContain('WorkbenchPageShell');
    expect(shell).toContain('ReadingPageShell');
    expect(shell).toContain('NarrowPageShell');
    expect(shell).toContain('LoadingPageShell');

    const migratedPages: Record<string, string> = {
      'components/WikiHomeContent.tsx': 'ReadingPageShell',
      'components/explore/ExploreContent.tsx': 'WorkbenchPageShell',
      'components/agents/AgentDetailContent.tsx': 'WorkbenchPageShell',
      'app/changelog/ChangelogClient.tsx': 'NarrowPageShell',
      'app/loading.tsx': 'LoadingPageShell',
      'app/view/[...path]/loading.tsx': 'LoadingPageShell',
    };

    for (const [rel, shellName] of Object.entries(migratedPages)) {
      const src = readSource(rel);
      expect(src, `${rel} should use ${shellName}`).toContain(shellName);
      expect(src, `${rel} should not hand-write the old content shell`).not.toContain('content-width px-4 md:px-6');
    }
  });

  it('keeps TOC reserve behind the named utility', () => {
    const violations: string[] = [];
    for (const { rel, lines } of scanSources()) {
      lines.forEach((line, index) => {
        if (line.includes('xl:mr-[220px]')) violations.push(`${rel}:${index + 1}: ${line.trim()}`);
      });
    }
    expect(
      violations,
      `Use .toc-reserved-content instead of copying xl:mr-[220px]:\n${violations.join('\n')}`,
    ).toEqual([]);

    for (const rel of [
      'components/changes/ChangesContentPage.tsx',
      'components/TrashPageClient.tsx',
      'components/renderers/todo/TodoRenderer.tsx',
    ]) {
      expect(readSource(rel), `${rel} should opt in via toc-reserved-content`).toContain('toc-reserved-content');
    }
  });

  it('keeps compact app modals on ModalShell', () => {
    for (const rel of [
      'components/ExportModal.tsx',
      'components/CreateSpaceModal.tsx',
      'components/KeyboardShortcuts.tsx',
    ]) {
      const src = readSource(rel);
      expect(src, `${rel} should use the shared modal frame`).toContain('ModalShell');
      expect(src, `${rel} should not hand-roll the modal layer`).not.toContain('fixed inset-0 z-50');
      expect(src, `${rel} should not hand-roll modal-backdrop`).not.toContain('modal-backdrop');
    }
  });
});
