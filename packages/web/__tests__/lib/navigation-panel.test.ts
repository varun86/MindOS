import { describe, expect, it } from 'vitest';
import { getActiveLeftPanel, getContentRoutePanel, getRouteControlledPanel, recoverStaleCapturePanel } from '@/lib/navigation-panel';

describe('navigation panel route recovery', () => {
  it('maps content routes to their matching rail panels', () => {
    expect(getContentRoutePanel('/wiki')).toBe('files');
    expect(getContentRoutePanel('/view/Notes/example.md')).toBe('files');
    expect(getContentRoutePanel('/capture')).toBe('capture');
    expect(getContentRoutePanel('/agents')).toBe('agents');
    expect(getContentRoutePanel('/agents/codex')).toBe('agents');
    expect(getContentRoutePanel('/explore')).toBe('discover');
    expect(getContentRoutePanel('/echo/about-you')).toBe('echo');
  });

  it('only route-controls workbench panels that must match their content route', () => {
    expect(getRouteControlledPanel('/wiki')).toBeNull();
    expect(getRouteControlledPanel('/view/Notes/example.md')).toBeNull();
    expect(getRouteControlledPanel('/capture')).toBe('capture');
    expect(getRouteControlledPanel('/agents')).toBe('agents');
    expect(getRouteControlledPanel('/explore')).toBe('discover');
    expect(getRouteControlledPanel('/echo/about-you')).toBe('echo');
  });

  it('uses route panels as defaults while allowing utility panels to temporarily override them', () => {
    expect(getActiveLeftPanel('/agents', null)).toBe('agents');
    expect(getActiveLeftPanel('/agents', 'files')).toBe('agents');
    expect(getActiveLeftPanel('/agents', 'search')).toBe('search');
    expect(getActiveLeftPanel('/agents', 'workflows')).toBe('workflows');
    expect(getActiveLeftPanel('/wiki', null)).toBeNull();
    expect(getActiveLeftPanel('/wiki', 'files')).toBe('files');
  });

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
