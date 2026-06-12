/**
 * Semantic z-index layers for app-level chrome and overlays.
 *
 * Ordinary component internals should keep using the documented 10/20/30/40/50
 * scale. Values above that scale are named here because they encode real app
 * shell ordering, not arbitrary visual tweaks.
 */

export const LAYOUT_Z = {
  PAGE: 10,
  STICKY: 20,
  NAV: 30,
  RAIL: 31,
  RAIL_AFFORDANCE: 32,
  OVERLAY: 40,
  MODAL: 50,
  POPOVER: 60,
  POPOVER_FLYOUT: 61,
  WALKTHROUGH_BACKDROP: 100,
  WALKTHROUGH_SURFACE: 101,
  WALKTHROUGH_TOOLTIP: 102,
  CRITICAL_OVERLAY: 99999,
} as const;

export const LAYOUT_Z_CLASS = {
  rail: 'z-app-rail',
  railAffordance: 'z-app-rail-affordance',
  modal: 'z-app-modal',
  popover: 'z-app-popover',
  popoverFlyout: 'z-app-popover-flyout',
  walkthroughBackdrop: 'z-app-walkthrough-backdrop',
  walkthroughSurface: 'z-app-walkthrough-surface',
  walkthroughTooltip: 'z-app-walkthrough-tooltip',
  criticalOverlay: 'z-app-critical-overlay',
} as const;
