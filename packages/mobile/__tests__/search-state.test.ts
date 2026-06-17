import { describe, expect, it } from 'vitest';
import {
  canRunSearch,
  getNormalizedSearchQuery,
  getSearchEmptyState,
  getSearchErrorMessage,
} from '@/lib/search-state';

describe('search-state', () => {
  it('normalizes queries before deciding if search can run', () => {
    expect(getNormalizedSearchQuery('  note  ')).toBe('note');
    expect(canRunSearch(' n ')).toBe(false);
    expect(canRunSearch(' no ')).toBe(true);
  });

  it('shows the idle search prompt before the first search', () => {
    expect(getSearchEmptyState({
      query: '',
      searched: false,
      loading: false,
      resultCount: 0,
    })).toMatchObject({
      icon: 'search-outline',
      title: 'Search your MindOS',
    });
  });

  it('does not show an empty state while loading or when results exist', () => {
    expect(getSearchEmptyState({
      query: 'note',
      searched: true,
      loading: true,
      resultCount: 0,
    })).toBeNull();
    expect(getSearchEmptyState({
      query: 'note',
      searched: true,
      loading: false,
      resultCount: 2,
    })).toBeNull();
  });

  it('distinguishes short submitted queries from real no-result searches', () => {
    expect(getSearchEmptyState({
      query: ' n ',
      searched: true,
      loading: false,
      resultCount: 0,
    })).toMatchObject({
      title: 'Keep typing',
      message: 'Enter at least two characters to search.',
    });
  });

  it('shows a retryable error state without losing the underlying message', () => {
    expect(getSearchErrorMessage(new Error('HTTP 500'))).toBe('HTTP 500');
    expect(getSearchEmptyState({
      query: 'note',
      searched: true,
      loading: false,
      resultCount: 0,
      error: new Error('HTTP 500'),
    })).toMatchObject({
      icon: 'cloud-offline-outline',
      title: 'Search unavailable',
      message: 'HTTP 500',
      actionLabel: 'Retry search',
    });
  });

  it('uses a specific no-match state for completed searches', () => {
    expect(getSearchEmptyState({
      query: '  graph  ',
      searched: true,
      loading: false,
      resultCount: 0,
    })).toMatchObject({
      title: 'No matches',
      message: 'No notes matched "graph".',
    });
  });
});
