import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('instrumentation runtime boundary', () => {
  it('does not import the Feishu long-connection client during ordinary page startup', () => {
    const source = readFileSync(resolve(__dirname, '../instrumentation.ts'), 'utf-8');

    expect(source).not.toContain('feishu-ws-client');
    expect(source).not.toContain('autoStartFeishuWSIfNeeded');
  });
});
