// @vitest-environment jsdom
import { readFileSync } from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

import TitlebarRow from '@/components/TitlebarRow';

// Phase 2: the row hosts TitlebarTabStrip, whose sync hook reads the route and
// fires the initial session fetch — mock both so the row renders standalone.
vi.mock('next/navigation', () => ({
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), back: vi.fn(), prefetch: vi.fn() }),
}));

const webRoot = path.join(__dirname, '..', '..');

(globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;

describe('TitlebarRow (spec-titlebar-row Phase 1 + 2)', () => {
  let container: HTMLDivElement | null = null;
  let root: Root | null = null;

  beforeEach(() => {
    // Keep the strip's refreshSessions pending: these tests only assert geometry.
    vi.stubGlobal('fetch', vi.fn(() => new Promise<never>(() => {})));
  });

  afterEach(() => {
    if (root) act(() => root!.unmount());
    container?.remove();
    container = null;
    root = null;
    vi.unstubAllGlobals();
  });

  function render(): HTMLElement {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    act(() => root!.render(React.createElement(TitlebarRow)));
    const el = container.firstElementChild as HTMLElement | null;
    expect(el).not.toBeNull();
    return el!;
  }

  it('renders a fixed full-row strip gated by the titlebar-row class', () => {
    const el = render();
    expect(el.className).toContain('titlebar-row');
    expect(el.className).toContain('fixed');
    expect(el.className).toContain('top-0');
    expect(el.className).toContain('right-0');
    expect(el.className).toContain('z-30');
  });

  it('binds geometry to the shell CSS variables', () => {
    const el = render();
    const style = el.getAttribute('style') ?? '';
    expect(style).toContain('left: var(--rail-width)');
    expect(style).toContain('height: var(--app-titlebar-h)');
    expect(style).toContain('max(0px, calc(var(--window-controls-left) - var(--rail-width)))');
  });

  it('is draggable and animates in sync with the rail (200ms ease-out)', () => {
    const el = render();
    // jsdom does not serialize -webkit-app-region into the style attribute;
    // React assigns it as a camelCase expando on the style object
    expect((el.style as unknown as Record<string, string>).WebkitAppRegion).toBe('drag');
    const style = el.getAttribute('style') ?? '';
    expect(style).toMatch(/transition:[^;]*left 200ms ease-out/);
    expect(style).toMatch(/transition:[^;]*padding-left 200ms ease-out/);
  });

  it('hosts the tab strip and reserves >=110px of pure drag space at the right end', () => {
    const el = render();
    // Phase 2: interactive content lives inside, so the row is no longer aria-hidden
    expect(el.getAttribute('aria-hidden')).toBeNull();
    expect(el.querySelector('[role="tablist"]')).not.toBeNull();
    expect(el.querySelector('button[aria-label="New chat"]')).not.toBeNull();

    const spacer = el.querySelector<HTMLElement>('[data-drag-spacer]');
    expect(spacer).not.toBeNull();
    expect(spacer!.style.minWidth).toBe('110px');
    expect((spacer!.style as unknown as Record<string, string>).WebkitAppRegion).toBe('drag');
    // The spacer is the last child: nothing can render to its right
    expect(el.lastElementChild).toBe(spacer);
  });

  it('globals.css gates display and defines the shell variables', () => {
    const css = readFileSync(path.join(webRoot, 'app', 'globals.css'), 'utf-8');
    // Hidden unless the mac shell declares the capability
    expect(css).toMatch(/\.titlebar-row\s*\{\s*display:\s*none;?\s*\}/);
    expect(css).toMatch(/html\[data-mac-titlebar-row\]\s+\.titlebar-row\s*\{\s*display:\s*flex;?\s*\}/);
    // Variables default to 0 (browser/win/linux/old shell = zero diff)
    expect(css).toContain('--app-titlebar-h: 0px');
    expect(css).toContain('--window-controls-left: 0px');
    expect(css).toContain('--rail-titlebar-offset: 0px');
    // Mac shell geometry
    expect(css).toMatch(/html\[data-mac-titlebar-row\]\s*\{[^}]*--app-titlebar-h:\s*46px/);
    expect(css).toMatch(/html\[data-mac-titlebar-row\]\s*\{[^}]*--window-controls-left:\s*70px/);
    // Fullscreen hides traffic lights: clearance collapses to 0
    expect(css).toMatch(/html\[data-mac-titlebar-row\]\[data-mac-fullscreen\]\s*\{[^}]*--window-controls-left:\s*0px/);
    expect(css).toMatch(/html\[data-mac-titlebar-row\]\[data-mac-fullscreen\]\s*\{[^}]*--rail-titlebar-offset:\s*0px/);
    // Legacy injected-CSS fallback is gone
    expect(css).not.toContain('.electron-mac-titlebar-pad');
  });
});
