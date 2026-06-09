import { describe, expect, it } from 'vitest';
import {
  formatDirLabel,
  getBreadcrumbSegments,
  getChildDirectories,
  hasChildDirectories,
  INBOX_VALUE,
} from '../packages/browser-extension/src/popup/dir-picker';

describe('browser extension directory picker helpers', () => {
  it('formats inbox and nested labels predictably', () => {
    expect(formatDirLabel('')).toBe('Inbox');
    expect(formatDirLabel(INBOX_VALUE)).toBe('Inbox');
    expect(formatDirLabel('Projects/Alpha')).toBe('Projects / Alpha');
  });

  it('splits breadcrumbs without empty segments', () => {
    expect(getBreadcrumbSegments('')).toEqual([]);
    expect(getBreadcrumbSegments('Projects/Alpha/Beta')).toEqual(['Projects', 'Alpha', 'Beta']);
  });

  it('lists only direct children at the current level', () => {
    const dirs = [
      'Projects',
      'Projects/Alpha',
      'Projects/Alpha/Deep',
      'Projects/Beta',
      'Archive',
      'Archive/2026',
    ];

    expect(getChildDirectories(dirs, '')).toEqual(['Archive', 'Projects']);
    expect(getChildDirectories(dirs, 'Projects')).toEqual(['Projects/Alpha', 'Projects/Beta']);
    expect(getChildDirectories(dirs, 'Projects/Alpha')).toEqual(['Projects/Alpha/Deep']);
  });

  it('detects whether a directory has nested children', () => {
    const dirs = ['Inbox', 'Projects', 'Projects/Alpha', 'Archive'];
    expect(hasChildDirectories(dirs, 'Projects')).toBe(true);
    expect(hasChildDirectories(dirs, 'Projects/Alpha')).toBe(false);
    expect(hasChildDirectories(dirs, '')).toBe(true);
  });
});
