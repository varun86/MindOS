import { describe, expect, it } from 'vitest';
import { recoverStaleCapturePanel } from '@/lib/navigation-panel';

describe('navigation panel route recovery', () => {
  it('recovers the Files panel when a pending Inbox navigation later commits to Wiki', () => {
    expect(recoverStaleCapturePanel('/wiki', 'capture')).toBe('files');
    expect(recoverStaleCapturePanel('/view/Notes/example.md', 'capture')).toBe('files');
  });

  it('recovers sibling destination panels when leaving Inbox', () => {
    expect(recoverStaleCapturePanel('/agents', 'capture')).toBe('agents');
    expect(recoverStaleCapturePanel('/explore', 'capture')).toBe('discover');
    expect(recoverStaleCapturePanel('/echo/about-you', 'capture')).toBe('echo');
  });

  it('does not reopen panels the user already closed or replace non-Inbox panels', () => {
    expect(recoverStaleCapturePanel('/wiki', null)).toBeUndefined();
    expect(recoverStaleCapturePanel('/wiki', 'search')).toBeUndefined();
    expect(recoverStaleCapturePanel('/capture', 'capture')).toBeUndefined();
  });
});
