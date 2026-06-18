// @vitest-environment jsdom
import React, { act, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PathAutocompleteField from '@/components/shared/PathAutocompleteField';

(globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function Harness({
  initialValue,
  changes,
  commits,
}: {
  initialValue: string;
  changes: string[];
  commits: string[];
}) {
  const [value, setValue] = useState(initialValue);
  return (
    <PathAutocompleteField
      value={value}
      onChange={(next) => {
        changes.push(next);
        setValue(next);
      }}
      onCommit={(next) => commits.push(next)}
      commitOnSelect
      homeDir="/Users/moonshot"
      ariaLabel="WorkDir"
      placeholder="/path/to/project"
      browseLabel="Choose folder"
      browseUnavailableLabel="Desktop only"
    />
  );
}

describe('PathAutocompleteField', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    document.body.innerHTML = '';
  });

  it('reuses setup-style directory suggestions and commits selected paths', async () => {
    const fetchMock = vi.fn(async () => ({
      json: async () => ({ dirs: ['product', 'projects', 'Downloads'] }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const changes: string[] = [];
    const commits: string[] = [];

    await act(async () => {
      root.render(<Harness initialValue="/Users/moonshot/pro" changes={changes} commits={commits} />);
    });

    await act(async () => {
      await vi.advanceTimersByTimeAsync(350);
    });

    expect(fetchMock).toHaveBeenCalledWith('/api/setup/ls', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ path: '/Users/moonshot/' }),
    }));
    const options = Array.from(host.querySelectorAll('[role="option"]')) as HTMLButtonElement[];
    expect(options.map((option) => option.textContent)).toEqual([
      '/Users/moonshot/product',
      '/Users/moonshot/projects',
    ]);

    await act(async () => {
      options[1].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });

    expect(changes.at(-1)).toBe('/Users/moonshot/projects');
    expect(commits.at(-1)).toBe('/Users/moonshot/projects');

    await act(async () => {
      root.unmount();
    });
  });

  it('commits the desktop directory picker selection when the bridge is available', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const selectedDir = '/Users/moonshot/projects/product/mindos-dev';
    (window as unknown as {
      mindos?: {
        checkUpdate: () => Promise<{ available: boolean }>;
        selectDirectory: () => Promise<string>;
      };
    }).mindos = {
      checkUpdate: async () => ({ available: false }),
      selectDirectory: async () => selectedDir,
    };

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);
    const changes: string[] = [];
    const commits: string[] = [];

    await act(async () => {
      root.render(<Harness initialValue="/tmp/stale-draft" changes={changes} commits={commits} />);
    });
    await act(async () => {
      await Promise.resolve();
    });

    const browse = host.querySelector('button[aria-label="Choose folder"]') as HTMLButtonElement;
    expect(browse.disabled).toBe(false);

    const mouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    browse.dispatchEvent(mouseDown);
    expect(mouseDown.defaultPrevented).toBe(true);

    await act(async () => {
      browse.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(changes.at(-1)).toBe(selectedDir);
    expect(commits).toEqual([selectedDir]);

    await act(async () => {
      root.unmount();
    });
  });
});
