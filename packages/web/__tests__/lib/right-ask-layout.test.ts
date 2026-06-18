import { describe, expect, it } from 'vitest';
import { resolveRightAskLayout } from '@/lib/right-ask-layout';

describe('resolveRightAskLayout', () => {
  it('keeps the panel fully docked while the main content stays comfortable', () => {
    const layout = resolveRightAskLayout({
      viewportWidth: 1600,
      leftOffset: 348,
      askOpen: true,
      askWidth: 380,
      askFocused: false,
    });

    expect(layout.mode).toBe('docked');
    expect(layout.availableWidth).toBe(1252);
    expect(layout.askVisualWidth).toBe(380);
    expect(layout.reservedRightWidth).toBe(380);
    expect(layout.overlapWidth).toBe(0);
    expect(layout.mainContentWidth).toBe(872);
  });

  it('protects the main content width instead of reserving an over-wide panel', () => {
    const layout = resolveRightAskLayout({
      viewportWidth: 1440,
      leftOffset: 348,
      askOpen: true,
      askWidth: 760,
      askFocused: false,
    });

    expect(layout.mode).toBe('protected');
    expect(layout.availableWidth).toBe(1092);
    expect(layout.askVisualWidth).toBe(760);
    expect(layout.reservedRightWidth).toBe(372);
    expect(layout.overlapWidth).toBe(388);
    expect(layout.mainContentWidth).toBe(720);
  });

  it('treats Focus as an explicit primary chat workspace without squeezing content', () => {
    const layout = resolveRightAskLayout({
      viewportWidth: 1440,
      leftOffset: 348,
      askOpen: true,
      askWidth: 760,
      askFocused: true,
      agentDetailOpen: true,
      agentDetailWidth: 400,
    });

    expect(layout.mode).toBe('focus');
    expect(layout.askVisualWidth).toBe(1092);
    expect(layout.stackVisualWidth).toBe(1492);
    expect(layout.reservedRightWidth).toBe(0);
    expect(layout.mainContentWidth).toBe(1092);
  });

  it('accounts for the agent detail panel as part of the same right-side stack', () => {
    const layout = resolveRightAskLayout({
      viewportWidth: 1440,
      leftOffset: 348,
      askOpen: true,
      askWidth: 380,
      askFocused: false,
      agentDetailOpen: true,
      agentDetailWidth: 400,
    });

    expect(layout.mode).toBe('protected');
    expect(layout.stackVisualWidth).toBe(780);
    expect(layout.reservedRightWidth).toBe(372);
    expect(layout.overlapWidth).toBe(408);
    expect(layout.mainContentWidth).toBe(720);
  });
});
