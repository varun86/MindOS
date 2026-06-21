/** Walkthrough step anchors — these data-walkthrough attributes are added to target components */
export type WalkthroughAnchor =
  | 'files-panel'
  | 'ask-button'
  | 'echo-panel'
  | 'agents-panel';

export interface WalkthroughStep {
  anchor: WalkthroughAnchor;
  /** Preferred tooltip position relative to anchor */
  position: 'right' | 'bottom';
}

/**
 * 4-step value-driven walkthrough:
 *   0. Project Memory (foundation)
 *   1. AI That Already Knows You (wedge)
 *   2. Echo People Context (human layer)
 *   3. Multi-Agent Sharing (differentiation)
 */
export const walkthroughSteps: WalkthroughStep[] = [
  { anchor: 'files-panel', position: 'right' },
  { anchor: 'ask-button', position: 'bottom' },
  { anchor: 'echo-panel', position: 'right' },
  { anchor: 'agents-panel', position: 'right' },
];
