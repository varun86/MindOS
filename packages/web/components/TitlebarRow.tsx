import React from 'react';

// macOS desktop shell titlebar row (spec-titlebar-row Phase 1).
// display: none by default; html[data-mac-titlebar-row] flips it to flex
// (globals.css), so browser/win/linux/old shells never see it.
// All geometry comes from shell CSS variables — when they are 0 the row is a
// zero-height no-op. Phase 1 renders an empty drag strip; the tab strip lands
// in Phase 2.
const ROW_STYLE = {
  left: 'var(--rail-width)',
  height: 'var(--app-titlebar-h)',
  // Clear the traffic lights only when the rail does not already cover them
  paddingLeft: 'max(0px, calc(var(--window-controls-left) - var(--rail-width)))',
  // Same duration/easing as the rail width transition so expand/collapse stays in sync
  transition: 'left 200ms ease-out, padding-left 200ms ease-out',
  WebkitAppRegion: 'drag',
} as React.CSSProperties;

export default function TitlebarRow() {
  return (
    <div
      className="titlebar-row fixed top-0 right-0 z-30 bg-background border-b border-border"
      style={ROW_STYLE}
      aria-hidden="true"
    />
  );
}
