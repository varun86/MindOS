// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';

const mockRouterPush = vi.fn();
let mockPathname = '/';

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({
    locale: 'en' as const,
    t: {
      sidebar: {
        files: 'Files',
        capture: 'Inbox',
        searchTitle: 'Search',
        echo: 'Echo',
        agents: 'Agents',
        discover: 'Discover',
        workflows: 'Flows',
        help: 'Help',
        settingsTitle: 'Settings',
        syncLabel: 'Sync',
      },
    },
  }),
}));

vi.mock('next/link', () => ({
  default: ({ children, href, onClick, onNavigate, ...props }: any) => (
    <a
      href={href}
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (event.defaultPrevented) return;

        event.preventDefault();
        let navigatePrevented = false;
        onNavigate?.({ preventDefault: () => { navigatePrevented = true; } });
        if (!navigatePrevented && href) {
          mockRouterPush(String(href));
        }
      }}
    >
      {children}
    </a>
  ),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush, replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  usePathname: () => mockPathname,
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock('@/components/SyncStatusBar', () => ({
  DOT_COLORS: {
    synced: 'bg-success',
    syncing: 'bg-[var(--amber)]',
    error: 'bg-error',
    conflicts: 'bg-error',
    off: 'bg-muted',
  },
  getStatusLevel: () => 'synced',
}));

describe('ActivityBar rail navigation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockPathname = '/';
    (globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ hasUpdate: false, current: '1.0.0', latest: '1.0.0' }),
    }));
  });

  it('clicking Files on homepage navigates to /wiki instead of toggling sidebar', async () => {
    mockPathname = '/';
    const mockPanelChange = vi.fn();

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="files"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
          onSpacesClick={(event) => {
            // Simulate the SidebarLayout onSpacesClick logic with the fix
            const pathname = mockPathname;
            const isHome = pathname === '/';
            const activePanel = 'files';
            const wasActive = activePanel === 'files';
            const onFilesRoute = pathname === '/wiki' || pathname?.startsWith('/view/') || pathname?.startsWith('/wiki/');
            if (isHome || !wasActive) {
              mockPanelChange('files');
              mockRouterPush('/wiki');
            } else if (!onFilesRoute) {
              mockRouterPush('/wiki');
            } else {
              event.preventDefault();
              mockPanelChange(null);
            }
          }}
        />,
      );
    });

    // Find and click the Files button
    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');
    expect(filesButton).not.toBeNull();

    await act(async () => {
      filesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      // Wait for debounce
      await new Promise(r => setTimeout(r, 200));
    });

    // Should navigate to /wiki, not toggle off
    expect(mockRouterPush).toHaveBeenCalledWith('/wiki');
    // Should set activePanel to 'files', not null
    expect(mockPanelChange).toHaveBeenCalledWith('files');
    expect(mockPanelChange).not.toHaveBeenCalledWith(null);

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking Files on /wiki page toggles sidebar off', async () => {
    mockPathname = '/wiki';
    const mockPanelChange = vi.fn();

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="files"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
          onSpacesClick={(event) => {
            // Simulate the SidebarLayout onSpacesClick logic with the fix
            const pathname = mockPathname;
            const isHome = pathname === '/';
            const activePanel = 'files';
            const wasActive = activePanel === 'files';
            const onFilesRoute = pathname === '/wiki' || pathname?.startsWith('/view/') || pathname?.startsWith('/wiki/');
            if (isHome || !wasActive) {
              mockPanelChange('files');
              mockRouterPush('/wiki');
            } else if (!onFilesRoute) {
              mockRouterPush('/wiki');
            } else {
              event.preventDefault();
              mockPanelChange(null);
            }
          }}
        />,
      );
    });

    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');
    expect(filesButton).not.toBeNull();

    await act(async () => {
      filesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 200));
    });

    // On /wiki with files already active, should toggle off
    expect(mockPanelChange).toHaveBeenCalledWith(null);
    expect(mockRouterPush).not.toHaveBeenCalled();

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking Inbox opens the Inbox workbench as a first-class rail destination', async () => {
    mockPathname = '/wiki';
    const mockPanelChange = vi.fn();

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="files"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    expect(captureButton).not.toBeNull();

    await act(async () => {
      captureButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      await new Promise(r => setTimeout(r, 200));
    });

    expect(captureButton?.getAttribute('href')).toBe('/capture');
    expect(mockPanelChange).toHaveBeenCalledWith('capture');

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking collapsed Inbox rail button on Mind opens the Inbox workbench', async () => {
    mockPathname = '/wiki';
    const mockPanelChange = vi.fn();

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="files"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded={false}
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    expect(captureButton).not.toBeNull();

    await act(async () => {
      captureButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(captureButton?.getAttribute('href')).toBe('/capture');
    expect(mockPanelChange).toHaveBeenCalledWith('capture');

    await act(async () => {
      root.unmount();
    });
  });

  it('places Inbox above Files in the rail', async () => {
    mockPathname = '/capture';

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel={null}
          onPanelChange={vi.fn()}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');

    expect(captureButton).not.toBeNull();
    expect(filesButton).not.toBeNull();
    expect(
      captureButton!.compareDocumentPosition(filesButton!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();

    await act(async () => {
      root.unmount();
    });
  });

  it('does not keep Files highlighted on the Inbox route', async () => {
    mockPathname = '/capture';

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="capture"
          onPanelChange={vi.fn()}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');
    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');

    expect(filesButton?.getAttribute('aria-pressed')).toBe('false');
    expect(captureButton?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      root.unmount();
    });
  });

  it('optimistically highlights Inbox after clicking it from Mind before the route commits', async () => {
    mockPathname = '/wiki';

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="capture"
          onPanelChange={vi.fn()}
          syncStatus={null}
          expanded={false}
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');

    expect(captureButton?.getAttribute('aria-pressed')).toBe('true');
    expect(filesButton?.getAttribute('aria-pressed')).toBe('false');

    await act(async () => {
      root.unmount();
    });
  });

  it('allows leaving Inbox with an immediate rail click instead of swallowing the next destination', async () => {
    mockPathname = '/wiki';
    const mockPanelChange = vi.fn();
    const mockSpacesClick = vi.fn(() => {
      mockPanelChange('files');
      mockRouterPush('/wiki');
    });

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="files"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
          onSpacesClick={mockSpacesClick}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    expect(captureButton).not.toBeNull();

    await act(async () => {
      captureButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(captureButton?.getAttribute('href')).toBe('/capture');
    expect(mockPanelChange).toHaveBeenCalledWith('capture');

    mockPathname = '/capture';
    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="capture"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
          onSpacesClick={mockSpacesClick}
        />,
      );
    });

    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');
    expect(filesButton).not.toBeNull();

    await act(async () => {
      filesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(mockSpacesClick).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/wiki');

    await act(async () => {
      root.unmount();
    });
  });

  it('clicking collapsed Mind rail button on Inbox invokes the spaces navigation callback', async () => {
    mockPathname = '/capture';
    const mockPanelChange = vi.fn();
    const mockSpacesClick = vi.fn(() => {
      mockPanelChange('files');
      mockRouterPush('/wiki');
    });

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="capture"
          onPanelChange={mockPanelChange}
          syncStatus={null}
          expanded={false}
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
          onSpacesClick={mockSpacesClick}
        />,
      );
    });

    const filesButton = host.querySelector('[data-walkthrough="files-panel"]');
    expect(filesButton).not.toBeNull();

    await act(async () => {
      filesButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(mockSpacesClick).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/wiki');

    await act(async () => {
      root.unmount();
    });
  });

  it('allows leaving Inbox for another workbench without waiting for the debounce window', async () => {
    mockPathname = '/capture';
    const mockPanelChange = vi.fn();
    const mockAgentsClick = vi.fn(() => {
      mockPanelChange('agents');
      mockRouterPush('/agents');
    });

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="capture"
          onPanelChange={mockPanelChange}
          onAgentsClick={mockAgentsClick}
          syncStatus={null}
          expanded
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const captureButton = host.querySelector('[data-walkthrough="capture-page"]');
    const agentsButton = host.querySelector('[data-walkthrough="agents-panel"]');
    expect(captureButton).not.toBeNull();
    expect(agentsButton).not.toBeNull();

    await act(async () => {
      captureButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      agentsButton?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    });

    expect(mockAgentsClick).toHaveBeenCalledTimes(1);
    expect(mockRouterPush).toHaveBeenCalledWith('/agents');

    await act(async () => {
      root.unmount();
    });
  });

  it('marks Agents active and exposes a stable /agents rail href', async () => {
    mockPathname = '/agents';

    const ActivityBar = (await import('@/components/ActivityBar')).default;

    const host = document.createElement('div');
    document.body.appendChild(host);
    const root = createRoot(host);

    await act(async () => {
      root.render(
        <ActivityBar
          activePanel="agents"
          onPanelChange={vi.fn()}
          syncStatus={null}
          expanded={false}
          onExpandedChange={vi.fn()}
          onSettingsClick={vi.fn()}
          onSyncClick={vi.fn()}
        />,
      );
    });

    const agentsButton = host.querySelector('[data-walkthrough="agents-panel"]');
    expect(agentsButton?.getAttribute('href')).toBe('/agents');
    expect(agentsButton?.getAttribute('aria-pressed')).toBe('true');

    await act(async () => {
      root.unmount();
    });
  });
});
