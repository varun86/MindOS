import React from 'react';
import TitlebarTabStrip from './TitlebarTabStrip';

// Titlebar row (spec-titlebar-row Phase 1 + 2).
// display: none by default; globals.css flips it to flex for the mac shell
// (html[data-mac-titlebar-row]) and for desktop-width browsers, so mobile and
// old shells never see it. All geometry comes from shell CSS variables — when
// they are 0 the row is a zero-height no-op.
// Phase 2: the row hosts the workspace tab strip. The row background stays a
// window drag region; every interactive element inside the strip opts out
// individually, and the trailing spacer guarantees >=110px of pure drag space
// at the row's right end no matter how many tabs are open.
const ROW_STYLE = {
  left: 'var(--rail-width)',
  height: 'var(--app-titlebar-h)',
  // Clear the traffic lights only when the rail does not already cover them
  paddingLeft: 'max(0px, calc(var(--window-controls-left) - var(--rail-width)))',
  // Same duration/easing as the rail width transition so expand/collapse stays in sync
  transition: 'left 200ms ease-out, padding-left 200ms ease-out',
  WebkitAppRegion: 'drag',
} as React.CSSProperties;

// Hard guarantee from the spec box model: the right end of the row always
// keeps >=110px the user can grab to drag the window.
const DRAG_SPACER_STYLE = {
  minWidth: 110,
  WebkitAppRegion: 'drag',
} as React.CSSProperties;

export default function TitlebarRow() {
  return (
    <div
      className="titlebar-row fixed top-0 right-0 z-30 bg-background border-b border-border"
      style={ROW_STYLE}
    >
      <TitlebarTabStrip />
      <div aria-hidden="true" data-drag-spacer className="h-full shrink-0" style={DRAG_SPACER_STYLE} />
    </div>
  );
}
