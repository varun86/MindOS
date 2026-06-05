import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function readSource(relativePath: string) {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
}

describe('icon button hit areas', () => {
  it('keeps breadcrumb links large enough to click across the full visual target', () => {
    const source = readSource('components/Breadcrumb.tsx');

    expect(source).toContain('inline-flex h-8 w-8');
    expect(source).toContain('inline-flex min-h-8');
    expect(source).toContain('focus-visible:ring-2 focus-visible:ring-ring touch-manipulation');
  });

  it('keeps markdown header controls on stable full-button hit targets', () => {
    const source = readSource('app/view/[...path]/ViewPageClient.tsx');

    expect(source).toContain('inline-flex h-8 min-w-8');
    expect(source).toContain('inline-flex h-8 w-8');
    expect(source).toContain('hover:bg-card/60 hover:text-foreground');
    expect(source).toContain('transition-colors duration-75');
    expect(source).not.toContain('className={`flex items-center gap-1 px-2 py-1 rounded text-[11px]');
  });

  it('keeps side panel header tool buttons on full 32px hit targets', () => {
    const panelHeaderSource = readSource('components/panels/PanelHeader.tsx');
    const filesPanelSource = readSource('components/Panel.tsx');
    const agentsPanelSource = readSource('components/panels/AgentsPanel.tsx');

    expect(panelHeaderSource).toContain('inline-flex h-8 w-8');
    expect(panelHeaderSource).not.toContain('className="p-1 rounded hover:bg-muted');

    expect(filesPanelSource).toContain('inline-flex h-8 w-8');
    expect(filesPanelSource).not.toContain('className="p-1 rounded hover:bg-muted');

    expect(agentsPanelSource).toContain('inline-flex h-8 w-8');
    expect(agentsPanelSource).not.toContain('className="p-1 rounded hover:bg-muted');
  });

  it('keeps chat hover actions responsive and clickable beyond the icon glyph', () => {
    const actionsSource = readSource('components/ask/UserMessageActions.tsx');
    const messageListSource = readSource('components/ask/MessageList.tsx');
    const saveSource = readSource('components/ask/SaveSessionInline.tsx');
    const historyPanelSource = readSource('components/ask/SessionHistoryPanel.tsx');
    const historySource = readSource('components/ask/SessionHistory.tsx');
    const saveInsightSource = readSource('components/ask/SaveInsightInline.tsx');
    const providerCapsuleSource = readSource('components/ask/ProviderModelCapsule.tsx');

    for (const source of [
      actionsSource,
      messageListSource,
      saveSource,
      historyPanelSource,
      historySource,
      saveInsightSource,
      providerCapsuleSource,
    ]) {
      expect(source).toContain('inline-flex h-7 w-7');
      expect(source).toContain('focus-visible:ring-2 focus-visible:ring-ring');
    }
    expect(actionsSource).toContain('md:focus-within:opacity-100');
    expect(actionsSource).toContain('hover:bg-muted hover:text-foreground');
    expect(actionsSource).toContain('hover:bg-[var(--amber)]/10 hover:text-[var(--amber)]');
    expect(messageListSource).toContain('md:focus-within:opacity-100');
    expect(messageListSource).toContain('hover:bg-muted hover:text-foreground');
    expect(saveSource).toContain('hover:bg-[var(--amber)]/10 hover:text-[var(--amber)]');
  });

  it('does not make chat action tooltips feel delayed during fast pointer scans', () => {
    const source = readSource('components/ask/ActionTooltip.tsx');

    expect(source).toContain('delay = 140');
    expect(source).toContain('onPointerEnter={handleEnter}');
    expect(source).toContain('onPointerLeave={handleLeave}');
    expect(source).toContain('clearTimer()');
  });
});
