import { describe, expect, it } from 'vitest';

import { isVisualDebugEnabled } from '../e2e/visual-debug';

describe('e2e visual debug screenshots', () => {
  it('keeps visual debug screenshots disabled by default', () => {
    expect(isVisualDebugEnabled(undefined)).toBe(false);
    expect(isVisualDebugEnabled('')).toBe(false);
    expect(isVisualDebugEnabled('0')).toBe(false);
    expect(isVisualDebugEnabled('false')).toBe(false);
  });

  it('enables visual debug screenshots only for explicit truthy values', () => {
    expect(isVisualDebugEnabled('1')).toBe(true);
    expect(isVisualDebugEnabled('true')).toBe(true);
    expect(isVisualDebugEnabled(' yes ')).toBe(true);
    expect(isVisualDebugEnabled('ON')).toBe(true);
  });
});
