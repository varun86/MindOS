export const INBOX_VALUE = '__inbox__';

export interface DirectoryIndex {
  childrenByParent: Map<string, string[]>;
  parentsWithChildren: Set<string>;
}

export interface DirectoryEntry {
  path: string;
  name: string;
  hasChildren: boolean;
}

export function formatDirLabel(path: string): string {
  if (!path || path === INBOX_VALUE) return 'Inbox';
  return path.split('/').join(' / ');
}

export function getBreadcrumbSegments(path: string): string[] {
  return path ? path.split('/').filter(Boolean) : [];
}

export function normalizeDirPath(path: string): string {
  return path
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean)
    .join('/');
}

export function buildDirectoryIndex(allDirs: string[]): DirectoryIndex {
  const normalizedPaths = new Set<string>();

  for (const rawPath of allDirs) {
    const segments = getBreadcrumbSegments(normalizeDirPath(rawPath));
    for (let i = 1; i <= segments.length; i += 1) {
      normalizedPaths.add(segments.slice(0, i).join('/'));
    }
  }

  const childrenByParent = new Map<string, string[]>();
  const parentsWithChildren = new Set<string>();

  for (const path of normalizedPaths) {
    const segments = getBreadcrumbSegments(path);
    const parent = segments.slice(0, -1).join('/');
    const children = childrenByParent.get(parent) ?? [];
    children.push(path);
    childrenByParent.set(parent, children);
    parentsWithChildren.add(parent);
  }

  for (const children of childrenByParent.values()) {
    children.sort((a, b) => a.localeCompare(b));
  }

  return { childrenByParent, parentsWithChildren };
}

export function getChildDirectoryEntries(index: DirectoryIndex, browsingPath: string): DirectoryEntry[] {
  const parent = normalizeDirPath(browsingPath);
  return (index.childrenByParent.get(parent) ?? []).map(path => ({
    path,
    name: path.split('/').pop() ?? path,
    hasChildren: index.parentsWithChildren.has(path),
  }));
}

export function getChildDirectories(allDirs: string[], browsingPath: string): string[] {
  return getChildDirectoryEntries(buildDirectoryIndex(allDirs), browsingPath).map(entry => entry.path);
}

export function hasChildDirectories(allDirs: string[], path: string): boolean {
  return buildDirectoryIndex(allDirs).parentsWithChildren.has(normalizeDirPath(path));
}
