import { describe, expect, it } from 'vitest';
import { readFileSync } from 'fs';
import path from 'path';

const webRoot = path.resolve(__dirname, '../..');

describe('Agents panel loading copy', () => {
  it('does not label the dynamic panel fallback as ACP registry loading', () => {
    const source = readFileSync(path.join(webRoot, 'components', 'SidebarLayout.tsx'), 'utf-8');
    const start = source.indexOf('function AgentsPanelLoading()');
    const end = source.indexOf('const AgentsPanel = dynamic');
    const fallbackSource = source.slice(start, end);

    expect(fallbackSource).not.toContain('p.acpLoading');
    expect(fallbackSource).toContain('aria-busy="true"');
  });
});
