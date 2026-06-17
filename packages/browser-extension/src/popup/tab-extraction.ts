import type { PageContent } from '../lib/types';

const EXTRACTOR_SCRIPT = 'content/extractor.js';

const UNSUPPORTED_PROTOCOLS = new Set([
  'about:',
  'chrome:',
  'chrome-extension:',
  'chrome-search:',
  'devtools:',
  'edge:',
  'moz-extension:',
  'view-source:',
]);

interface ClipResultWindow extends Window {
  __mindosClipResult?: unknown;
}

export function isClipSupportedUrl(url: string): boolean {
  if (!url.trim()) return false;
  try {
    return !UNSUPPORTED_PROTOCOLS.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

export function unsupportedClipUrlMessage(url: string): string {
  if (!url.trim()) return 'Cannot clip this tab because it has no readable URL';
  try {
    const { protocol } = new URL(url);
    if (UNSUPPORTED_PROTOCOLS.has(protocol)) {
      return 'Cannot clip browser internal pages';
    }
  } catch {
    return 'Cannot clip this tab because its URL is invalid';
  }
  return 'Cannot clip this tab';
}

export async function extractContentFromActiveTab(): Promise<PageContent> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab to clip');

  const url = tab.url ?? tab.pendingUrl ?? '';
  if (!isClipSupportedUrl(url)) {
    throw new Error(unsupportedClipUrlMessage(url));
  }

  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: [EXTRACTOR_SCRIPT],
    });
  } catch {
    throw new Error('Cannot read this page. Refresh it or check site permissions.');
  }

  let results: chrome.scripting.InjectionResult[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window as ClipResultWindow).__mindosClipResult,
    });
  } catch {
    throw new Error('Cannot read extraction result');
  }

  const result = results?.[0]?.result;
  if (!isPageContent(result)) {
    throw new Error('Content extraction returned invalid result');
  }

  return result;
}

function isPageContent(value: unknown): value is PageContent {
  if (!value || typeof value !== 'object') return false;
  const page = value as Partial<PageContent>;
  return typeof page.title === 'string'
    && typeof page.content === 'string'
    && typeof page.textContent === 'string'
    && typeof page.url === 'string'
    && typeof page.savedAt === 'string'
    && typeof page.wordCount === 'number';
}
