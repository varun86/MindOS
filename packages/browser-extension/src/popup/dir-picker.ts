export const INBOX_VALUE = '__inbox__';

export function formatDirLabel(path: string): string {
  if (!path || path === INBOX_VALUE) return 'Inbox';
  return path.split('/').join(' / ');
}

export function getBreadcrumbSegments(path: string): string[] {
  return path ? path.split('/').filter(Boolean) : [];
}

export function getChildDirectories(allDirs: string[], browsingPath: string): string[] {
  const prefix = browsingPath ? `${browsingPath}/` : '';

  return allDirs
    .filter((dirPath) => {
      if (!dirPath.startsWith(prefix)) return false;
      const rest = dirPath.slice(prefix.length);
      return rest.length > 0 && !rest.includes('/');
    })
    .sort((a, b) => a.localeCompare(b));
}

export function hasChildDirectories(allDirs: string[], path: string): boolean {
  const prefix = path ? `${path}/` : '';
  return allDirs.some((dirPath) => {
    if (!dirPath.startsWith(prefix)) return false;
    const rest = dirPath.slice(prefix.length);
    return rest.length > 0 && !rest.includes('/');
  });
}

