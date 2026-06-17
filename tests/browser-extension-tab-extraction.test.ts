import { describe, expect, it } from 'vitest';
import {
  isClipSupportedUrl,
  unsupportedClipUrlMessage,
} from '../packages/browser-extension/src/popup/tab-extraction';

describe('browser extension tab extraction guards', () => {
  it('allows ordinary web and local file URLs that Chrome can grant through activeTab', () => {
    expect(isClipSupportedUrl('https://example.com/read')).toBe(true);
    expect(isClipSupportedUrl('http://127.0.0.1:4567')).toBe(true);
    expect(isClipSupportedUrl('file:///Users/me/note.html')).toBe(true);
  });

  it('blocks browser-owned pages before trying to inject scripts', () => {
    expect(isClipSupportedUrl('chrome://extensions')).toBe(false);
    expect(isClipSupportedUrl('edge://settings')).toBe(false);
    expect(isClipSupportedUrl('about:blank')).toBe(false);
    expect(isClipSupportedUrl('chrome-extension://abc/popup.html')).toBe(false);
    expect(unsupportedClipUrlMessage('chrome://extensions')).toBe('Cannot clip browser internal pages');
  });

  it('returns clear messages for missing or invalid tab URLs', () => {
    expect(isClipSupportedUrl('')).toBe(false);
    expect(unsupportedClipUrlMessage('')).toBe('Cannot clip this tab because it has no readable URL');
    expect(unsupportedClipUrlMessage('not a url')).toBe('Cannot clip this tab because its URL is invalid');
  });
});
