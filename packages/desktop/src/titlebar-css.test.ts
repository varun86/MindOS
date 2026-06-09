import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

describe('desktop macOS titlebar CSS contract', () => {
  it('keeps the app rail and side panel below the draggable titlebar layer', () => {
    const source = readFileSync(path.join(__dirname, 'main.ts'), 'utf-8');

    expect(source).toContain('[role="navigation"][aria-label="Navigation"]');
    expect(source).toContain('[role="navigation"][aria-label="Navigation"] ~ aside[role="region"]');
    expect(source).toContain('[role="toolbar"][aria-label="Navigation"]');
    expect(source).toContain('height: var(--electron-mac-titlebar-h);');
    expect(source).toContain('pointer-events: auto;');
    expect(source).toContain('-webkit-app-region: drag;');
  });
});
