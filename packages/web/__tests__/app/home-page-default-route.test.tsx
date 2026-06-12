import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import HomePage from '@/app/page';

const mockReadSetupPending = vi.hoisted(() => vi.fn(() => false));

vi.mock('@/lib/setup-state', () => ({
  readSetupPending: mockReadSetupPending,
}));

describe('HomePage default route', () => {
  beforeEach(() => {
    mockReadSetupPending.mockReset();
    mockReadSetupPending.mockReturnValue(false);
  });

  it('opens Echo by default after setup is complete', () => {
    const element = HomePage();

    expect(React.isValidElement(element)).toBe(true);
    expect(renderToStaticMarkup(element as React.ReactElement)).toContain('href="/echo/imprint"');
  });

  it('keeps setup as the first-run destination', () => {
    mockReadSetupPending.mockReturnValue(true);

    const element = HomePage();
    expect(React.isValidElement(element)).toBe(true);
    expect(renderToStaticMarkup(element as React.ReactElement)).toContain('href="/setup"');
  });
});
