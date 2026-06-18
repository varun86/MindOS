import { RIGHT_ASK_PANEL } from '@/lib/config/panel-sizes';

export type RightAskLayoutMode = 'docked' | 'protected' | 'focus';

export interface ResolveRightAskLayoutInput {
  viewportWidth: number;
  leftOffset: number;
  askOpen: boolean;
  askWidth: number;
  askFocused: boolean;
  agentDetailOpen?: boolean;
  agentDetailWidth?: number;
  mainComfortMin?: number;
}

export interface RightAskLayout {
  mode: RightAskLayoutMode;
  availableWidth: number;
  askVisualWidth: number;
  stackVisualWidth: number;
  reservedRightWidth: number;
  overlapWidth: number;
  mainContentWidth: number;
}

function finitePixels(value: number): number {
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

/**
 * Resolves the right-side panel layout contract.
 *
 * Visual width is what the Ask/detail panels render. Reserved width is how much
 * the main content gives up. Once the main content would fall below the comfort
 * width, the extra panel width overlaps instead of continuing to squeeze.
 */
export function resolveRightAskLayout(input: ResolveRightAskLayoutInput): RightAskLayout {
  const viewportWidth = finitePixels(input.viewportWidth);
  const leftOffset = finitePixels(input.leftOffset);
  const availableWidth = Math.max(0, viewportWidth - leftOffset);
  const mainComfortMin = finitePixels(input.mainComfortMin ?? RIGHT_ASK_PANEL.MAIN_COMFORT_MIN);

  const askVisualWidth = input.askOpen
    ? input.askFocused
      ? availableWidth
      : Math.min(finitePixels(input.askWidth), availableWidth)
    : 0;
  const agentDetailWidth = input.agentDetailOpen ? finitePixels(input.agentDetailWidth ?? 0) : 0;
  const stackVisualWidth = askVisualWidth + agentDetailWidth;

  if (input.askOpen && input.askFocused) {
    return {
      mode: 'focus',
      availableWidth,
      askVisualWidth,
      stackVisualWidth,
      reservedRightWidth: 0,
      overlapWidth: stackVisualWidth,
      mainContentWidth: availableWidth,
    };
  }

  const reserveLimit = Math.max(0, availableWidth - mainComfortMin);
  const reservedRightWidth = Math.min(stackVisualWidth, reserveLimit);
  const overlapWidth = Math.max(0, stackVisualWidth - reservedRightWidth);

  return {
    mode: overlapWidth > 0 ? 'protected' : 'docked',
    availableWidth,
    askVisualWidth,
    stackVisualWidth,
    reservedRightWidth,
    overlapWidth,
    mainContentWidth: Math.max(0, availableWidth - reservedRightWidth),
  };
}
