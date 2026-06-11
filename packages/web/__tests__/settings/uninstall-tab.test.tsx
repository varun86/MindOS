// @vitest-environment jsdom
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';

const mockApiFetch = vi.fn();

vi.mock('@/lib/api', () => ({
  apiFetch: mockApiFetch,
}));

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    t: {
      settings: {
        uninstall: {
          title: 'Uninstall MindOS',
          descCli: 'Remove MindOS CLI and background services from this machine. Configuration cleanup is optional below.',
          descDesktop: 'Remove MindOS Desktop and background services from this machine. Configuration cleanup is optional below.',
          stopServices: 'Stop services & remove daemon',
          stopServicesDesc: 'Stop all running MindOS processes and remove the background daemon.',
          removeConfig: 'Remove configuration',
          removeConfigDesc: 'Delete ~/.mindos/ directory (config, logs, PID files).',
          removeNpm: 'Uninstall CLI package',
          removeNpmDesc: 'Run npm uninstall -g @geminilight/mindos.',
          removeApp: 'Move Desktop app to Trash',
          removeAppDesc: 'Move MindOS.app to Trash. You can restore it later if needed.',
          confirmTitle: 'Confirm Uninstall',
          confirmButton: 'Uninstall',
          cancelButton: 'Cancel',
          running: 'Uninstalling...',
          success: 'MindOS has been uninstalled.',
          successDesktop: 'MindOS has been uninstalled. The app will quit now.',
          error: 'Uninstall failed. You can run `mindos uninstall` in terminal manually.',
          nothingSelected: 'Select at least one item to uninstall.',
          kbSafe: 'Your knowledge base files are always safe — they are never deleted by this action.',
        },
      },
    },
  }),
}));

describe('UninstallTab', () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    delete (window as unknown as { mindos?: unknown }).mindos;
    mockApiFetch.mockResolvedValue({ ok: true });
    host = document.createElement('div');
    document.body.appendChild(host);
    root = createRoot(host);
  });

  afterEach(async () => {
    await act(async () => { root.unmount(); });
    host.remove();
    delete (window as unknown as { mindos?: unknown }).mindos;
  });

  it('keeps configuration removal unchecked by default', async () => {
    const { UninstallTab } = await import('@/components/settings/UninstallTab');

    await act(async () => {
      root.render(<UninstallTab />);
    });

    const checkboxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const removeConfig = checkboxes.find(input => input.closest('label')?.textContent?.includes('Remove configuration'));
    expect(removeConfig).toBeTruthy();
    expect(removeConfig?.checked).toBe(false);

    const firstUninstall = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Uninstall'));
    await act(async () => {
      firstUninstall?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmUninstall = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Uninstall');
    await act(async () => {
      confirmUninstall?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/uninstall', expect.objectContaining({
      body: JSON.stringify({ removeConfig: false }),
    }));
  });

  it('sends removeConfig true only after the user explicitly selects configuration removal', async () => {
    const { UninstallTab } = await import('@/components/settings/UninstallTab');

    await act(async () => {
      root.render(<UninstallTab />);
    });

    const checkboxes = Array.from(host.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const removeConfig = checkboxes.find(input => input.closest('label')?.textContent?.includes('Remove configuration'));
    expect(removeConfig).toBeTruthy();

    await act(async () => {
      removeConfig?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(removeConfig?.checked).toBe(true);

    const firstUninstall = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.includes('Uninstall'));
    await act(async () => {
      firstUninstall?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const confirmUninstall = Array.from(host.querySelectorAll('button'))
      .find(button => button.textContent?.trim() === 'Uninstall');
    await act(async () => {
      confirmUninstall?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
    });

    expect(mockApiFetch).toHaveBeenCalledWith('/api/uninstall', expect.objectContaining({
      body: JSON.stringify({ removeConfig: true }),
    }));
  });
});
