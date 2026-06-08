import type { PanelId } from '@/components/ActivityBar';

export function getContentRoutePanel(pathname: string | null | undefined): PanelId | null {
  if (!pathname) return null;
  if (pathname === '/wiki' || pathname.startsWith('/wiki/') || pathname.startsWith('/view/')) {
    return 'files';
  }
  if (pathname.startsWith('/agents')) return 'agents';
  if (pathname.startsWith('/explore')) return 'discover';
  if (pathname.startsWith('/echo')) return 'echo';
  if (pathname.startsWith('/capture')) return 'capture';
  return null;
}

export function getRouteControlledPanel(pathname: string | null | undefined): PanelId | null {
  const panel = getContentRoutePanel(pathname);
  return panel === 'files' ? null : panel;
}

export function getActiveLeftPanel(
  pathname: string | null | undefined,
  localActivePanel: PanelId | null,
): PanelId | null {
  const routePanel = getRouteControlledPanel(pathname);
  if (!routePanel) return localActivePanel;
  if (localActivePanel === 'search' || localActivePanel === 'workflows') return localActivePanel;
  return routePanel;
}

export function recoverStaleCapturePanel(
  pathname: string | null | undefined,
  activePanel: PanelId | null,
): PanelId | undefined {
  if (activePanel !== 'capture') return undefined;
  const routePanel = getContentRoutePanel(pathname);
  if (!routePanel || routePanel === 'capture') return undefined;
  return routePanel;
}
