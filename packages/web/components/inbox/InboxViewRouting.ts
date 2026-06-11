import type { InboxViewMode } from './InboxViewTypes';

export function getInitialInboxViewMode(): InboxViewMode {
  return getInboxHashState().view;
}

export function getInitialSelectedInboxPath(): string | null {
  return getInboxHashState().selectedPath;
}

export function getInboxHashState(): { view: InboxViewMode; selectedPath: string | null } {
  if (typeof window === 'undefined') return { view: 'capture', selectedPath: null };
  const hash = window.location.hash.replace('#', '');
  const [viewPart, query = ''] = hash.split('?', 2);
  const view = viewPart === 'queue' || viewPart === 'shelved' || viewPart === 'history' ? viewPart : 'capture';
  const selectedPath = view === 'queue' ? new URLSearchParams(query).get('path') : null;
  return { view, selectedPath };
}

export function dispatchSyntheticHashChange(oldUrl: string, newUrl: string) {
  if (oldUrl === newUrl) return;
  const event = typeof HashChangeEvent === 'function'
    ? new HashChangeEvent('hashchange', { oldURL: oldUrl, newURL: newUrl })
    : new Event('hashchange');
  window.dispatchEvent(event);
}
