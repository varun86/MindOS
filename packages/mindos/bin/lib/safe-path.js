import { isAbsolute, relative, resolve, win32 } from 'node:path';

export function normalizeCliPath(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

export function resolveInsideRoot(root, filePath = '') {
  const rootResolved = resolve(root);
  const normalizedFilePath = normalizeCliPath(filePath);

  if (
    normalizedFilePath
    && (
      isAbsolute(normalizedFilePath)
      || win32.isAbsolute(String(filePath))
      || win32.isAbsolute(normalizedFilePath)
    )
  ) {
    throw new Error('Access denied: path outside knowledge base');
  }

  const resolved = normalizedFilePath ? resolve(rootResolved, normalizedFilePath) : rootResolved;
  const rel = relative(rootResolved, resolved);
  if (rel === '..' || rel.startsWith('../') || rel.startsWith('..\\') || isAbsolute(rel)) {
    throw new Error('Access denied: path outside knowledge base');
  }

  return resolved;
}
