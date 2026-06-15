import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  restartWalkthrough,
  useWalkthroughStore,
  WALKTHROUGH_DONE_STORAGE_KEY,
} from '@/lib/stores/walkthrough-store';

describe('walkthrough-store restartWalkthrough', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    useWalkthroughStore.setState({
      status: 'completed',
      currentStep: 3,
      totalSteps: 3,
    });
  });

  it('clears local completion and patches nested guideState before activating the walkthrough', async () => {
    localStorage.setItem(WALKTHROUGH_DONE_STORAGE_KEY, '1');
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    await restartWalkthrough();

    expect(localStorage.getItem(WALKTHROUGH_DONE_STORAGE_KEY)).toBeNull();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guideState: {
          active: true,
          dismissed: false,
          walkthroughStep: 0,
          walkthroughDismissed: false,
        },
      }),
    });
    expect(useWalkthroughStore.getState().status).toBe('active');
    expect(useWalkthroughStore.getState().currentStep).toBe(0);
  });
});
