// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WalkthroughOverlay from '@/components/walkthrough/WalkthroughOverlay';
import { useWalkthroughStore } from '@/lib/stores/walkthrough-store';
import { walkthroughSteps } from '@/components/walkthrough/steps';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe('WalkthroughOverlay lifecycle fallbacks', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    useWalkthroughStore.setState({
      status: 'active',
      currentStep: 0,
      totalSteps: walkthroughSteps.length,
    });
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    document.body.querySelectorAll('[data-walkthrough]').forEach((el) => el.remove());
    vi.useRealTimers();
  });

  it('keeps the current step visible when its target anchor is missing', () => {
    act(() => {
      root.render(<WalkthroughOverlay />);
    });

    act(() => {
      vi.advanceTimersByTime(600);
    });

    expect(useWalkthroughStore.getState().currentStep).toBe(0);
    expect(container.textContent).toContain('Your Project Memory');
    expect(container.textContent).toContain('Next');
  });

  it('replaces the fallback card once a late target anchor appears', () => {
    act(() => {
      root.render(<WalkthroughOverlay />);
    });
    expect(container.querySelector('[role="dialog"]')).not.toBeNull();

    const anchor = document.createElement('button');
    anchor.dataset.walkthrough = 'files-panel';
    anchor.getBoundingClientRect = () => ({
      x: 20,
      y: 20,
      top: 20,
      right: 60,
      bottom: 60,
      left: 20,
      width: 40,
      height: 40,
      toJSON: () => ({}),
    } as DOMRect);
    document.body.appendChild(anchor);

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(container.querySelector('[role="dialog"]')).toBeNull();
    expect(container.textContent).toContain('Your Project Memory');
  });
});
