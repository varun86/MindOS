import { readFileSync } from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');

describe('browser extension popup HTML safety', () => {
  it('does not interpolate directory names through innerHTML', () => {
    const source = readFileSync(
      path.join(root, 'packages/browser-extension/src/popup/popup.ts'),
      'utf-8',
    );

    expect(source).not.toMatch(/innerHTML\s*=\s*`[\s\S]*\$\{childName\}/);
    expect(source).toContain('name.textContent = child.name');
  });
});
