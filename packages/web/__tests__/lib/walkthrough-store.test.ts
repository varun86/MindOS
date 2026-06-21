// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  restartWalkthrough,
  useWalkthroughStore,
  WALKTHROUGH_DONE_STORAGE_KEY,
} from '@/lib/stores/walkthrough-store';
import { walkthroughSteps } from '@/components/walkthrough/steps';

describe('walkthrough-store restartWalkthrough', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1024 });
    delete document.documentElement.dataset.mindRootId;
    useWalkthroughStore.setState({
      status: 'idle',
      currentStep: 0,
      totalSteps: walkthroughSteps.length,
    });
  });

  it('clears local completion and patches nested guideState before activating the walkthrough', async () => {
    useWalkthroughStore.setState({
      status: 'completed',
      currentStep: walkthroughSteps.length,
      totalSteps: walkthroughSteps.length,
    });
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

  it('uses welcome=1 as an explicit start even when local completion exists', async () => {
    window.history.replaceState({}, '', '/?welcome=1');
    localStorage.setItem(WALKTHROUGH_DONE_STORAGE_KEY, '1');
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      if (url === '/api/setup' && init?.method === 'PATCH') {
        return new Response(JSON.stringify({ ok: true }), { status: 200 });
      }
      return new Response(JSON.stringify({
        guideState: {
          active: true,
          dismissed: false,
          walkthroughStep: undefined,
          walkthroughDismissed: false,
        },
      }), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const cleanup = useWalkthroughStore.getState()._init();
    await flushPromises();

    expect(localStorage.getItem(WALKTHROUGH_DONE_STORAGE_KEY)).toBeNull();
    expect(window.location.search).toBe('');
    expect(useWalkthroughStore.getState()).toMatchObject({
      status: 'active',
      currentStep: 0,
    });
    expect(fetchMock).toHaveBeenCalledWith('/api/setup', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        guideState: { walkthroughStep: 0, walkthroughDismissed: false },
      }),
    });
    cleanup();
  });

  it('does not reactivate an incomplete server step when local completion is set', async () => {
    localStorage.setItem(WALKTHROUGH_DONE_STORAGE_KEY, '1');
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const cleanup = useWalkthroughStore.getState()._init();
    await flushPromises();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useWalkthroughStore.getState().status).toBe('idle');
    cleanup();
  });

  it('resumes an in-progress server walkthrough on desktop', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      guideState: {
        active: true,
        dismissed: false,
        walkthroughStep: 1,
        walkthroughDismissed: false,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const cleanup = useWalkthroughStore.getState()._init();
    await flushPromises();

    expect(useWalkthroughStore.getState()).toMatchObject({
      status: 'active',
      currentStep: 1,
    });
    cleanup();
  });

  it('records server-side completion in the local safety net without activating', async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({
      guideState: {
        active: true,
        dismissed: false,
        walkthroughStep: walkthroughSteps.length,
        walkthroughDismissed: false,
      },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const cleanup = useWalkthroughStore.getState()._init();
    await flushPromises();

    expect(localStorage.getItem(WALKTHROUGH_DONE_STORAGE_KEY)).toBe('1');
    expect(useWalkthroughStore.getState().status).toBe('idle');
    cleanup();
  });
});

async function flushPromises() {
  await new Promise(resolve => setTimeout(resolve, 0));
  await new Promise(resolve => setTimeout(resolve, 0));
}
