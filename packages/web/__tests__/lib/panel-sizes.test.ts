import { describe, expect, it } from 'vitest';
import {
  ACTIVITY_BAR,
  DEFAULT_LEFT_PANEL_WIDTH,
  LEFT_PANEL,
  MOBILE_SIDEBAR,
  SETTINGS_SIDEBAR,
  getLeftPanelWidth,
} from '@/lib/config/panel-sizes';

describe('getLeftPanelWidth', () => {
  it('uses the user-resized width for every panel once one is stored', () => {
    // Width is one global value — flipping to per-panel defaults during
    // local/route state mismatches was the rail-click flicker.
    expect(getLeftPanelWidth('agents', 360)).toBe(360);
    expect(getLeftPanelWidth('capture', 360)).toBe(360);
    expect(getLeftPanelWidth('files', 360)).toBe(360);
    expect(getLeftPanelWidth(null, 360)).toBe(360);
  });

  it('falls back to the per-panel default when the user never resized', () => {
    expect(getLeftPanelWidth('agents', null)).toBe(DEFAULT_LEFT_PANEL_WIDTH.agents);
    expect(getLeftPanelWidth('echo', null)).toBe(DEFAULT_LEFT_PANEL_WIDTH.echo);
    expect(getLeftPanelWidth(null, null)).toBe(LEFT_PANEL.DEFAULT);
  });

  it('keeps non-resizable sidebar chrome widths in the shared panel-size config', () => {
    expect(ACTIVITY_BAR.WIDTH_COLLAPSED).toBe(48);
    expect(ACTIVITY_BAR.WIDTH_EXPANDED).toBe(180);
    expect(SETTINGS_SIDEBAR.WIDTH).toBe(232);
    expect(MOBILE_SIDEBAR.WIDTH).toBe('85vw');
    expect(MOBILE_SIDEBAR.MAX_WIDTH).toBe(320);
  });
});
