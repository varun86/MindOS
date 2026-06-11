import { describe, expect, it } from 'vitest';
import {
  isAllowedMainWindowNavigation,
  isTrustedLocalRenderer,
  trustedLocalRendererError,
  type RendererTrustSnapshot,
} from './ipc-trust';

function snapshot(overrides: Partial<RendererTrustSnapshot> = {}): RendererTrustSnapshot {
  return {
    currentMode: 'local',
    currentWebPort: 3456,
    senderMatchesMainWindow: true,
    senderUrl: 'http://127.0.0.1:3456/settings',
    mainWindowUrl: 'http://127.0.0.1:3456/settings',
    ...overrides,
  };
}

describe('desktop IPC trust boundary', () => {
  it('allows local renderer calls from the managed local web origin', () => {
    expect(isTrustedLocalRenderer(snapshot())).toBe(true);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'http://localhost:3456/setup?force=1' }))).toBe(true);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'http://[::1]:3456/' }))).toBe(true);
  });

  it('rejects remote mode, wrong senders, wrong ports, and non-web origins', () => {
    expect(isTrustedLocalRenderer(snapshot({ currentMode: 'remote' }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ senderMatchesMainWindow: false }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ currentWebPort: undefined }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'https://remote.example.com/' }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'http://127.0.0.1:4567/' }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'file:///Applications/MindOS.app/index.html' }))).toBe(false);
    expect(isTrustedLocalRenderer(snapshot({ senderUrl: 'mindos-connect://bundle/connect.html' }))).toBe(false);
  });

  it('returns a user-safe denied error for blocked local-only capabilities', () => {
    expect(trustedLocalRendererError('uninstall-app').message).toBe(
      'Blocked desktop IPC capability from untrusted renderer: uninstall-app',
    );
  });

  it('keeps the main window on the active local or remote origin', () => {
    expect(isAllowedMainWindowNavigation('http://127.0.0.1:3456/echo', {
      currentMode: 'local',
      currentWebPort: 3456,
    })).toBe(true);
    expect(isAllowedMainWindowNavigation('http://127.0.0.1:4567/echo', {
      currentMode: 'local',
      currentWebPort: 3456,
    })).toBe(false);

    expect(isAllowedMainWindowNavigation('https://mindos.example.com/settings', {
      currentMode: 'remote',
      currentRemoteAddress: 'https://mindos.example.com',
    })).toBe(true);
    expect(isAllowedMainWindowNavigation('https://evil.example.com/settings', {
      currentMode: 'remote',
      currentRemoteAddress: 'https://mindos.example.com',
    })).toBe(false);
  });
});
