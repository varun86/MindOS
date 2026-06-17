/* ── Popup Controller — Orchestrates Setup / Clip / Save flows ── */

import TurndownService from 'turndown';
import { loadConfig, saveConfig, isConfigured } from '../lib/storage';
import { testConnection, listDirs, saveToInbox, createFile } from '../lib/api';
import { toClipDocument } from '../lib/markdown';
import type { ClipperConfig, PageContent } from '../lib/types';
import {
  formatDirLabel,
  getBreadcrumbSegments,
  getChildDirectories,
  hasChildDirectories,
  INBOX_VALUE,
} from './dir-picker';

/* ── DOM refs ── */

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

const viewSetup = $<HTMLDivElement>('view-setup');
const viewClip = $<HTMLDivElement>('view-clip');
const viewSuccess = $<HTMLDivElement>('view-success');
const viewLoading = $<HTMLDivElement>('view-loading');

// Setup
const setupUrl = $<HTMLInputElement>('setup-url');
const setupToken = $<HTMLInputElement>('setup-token');
const setupError = $<HTMLDivElement>('setup-error');
const btnConnect = $<HTMLButtonElement>('btn-connect');

// Clip
const clipTitle = $<HTMLInputElement>('clip-title');
const clipSourceLabel = $<HTMLParagraphElement>('clip-source-label');
const clipSiteBadge = $<HTMLSpanElement>('clip-site');
const clipSiteText = $<HTMLSpanElement>('clip-site-text');
const clipWordsBadge = $<HTMLSpanElement>('clip-words');
const clipWordsText = $<HTMLSpanElement>('clip-words-text');
const clipStatus = $<HTMLSpanElement>('clip-status');
const dirTrigger = $<HTMLButtonElement>('dir-trigger');
const dirLabel = $<HTMLSpanElement>('dir-label');
const dirPanel = $<HTMLDivElement>('dir-panel');
const dirBreadcrumb = $<HTMLDivElement>('dir-breadcrumb');
const dirList = $<HTMLDivElement>('dir-list');
const dirConfirm = $<HTMLButtonElement>('dir-confirm');
const clipError = $<HTMLDivElement>('clip-error');
const btnSave = $<HTMLButtonElement>('btn-save');
const btnSettings = $<HTMLButtonElement>('btn-settings');

// Success
const successDetail = $<HTMLParagraphElement>('success-detail');
const btnDone = $<HTMLButtonElement>('btn-done');
const btnClipAnother = $<HTMLButtonElement>('btn-clip-another');

/* ── State ── */

let config: ClipperConfig;
let extractedContent: PageContent | null = null;
let allDirs: string[] = [];
let selectedPath = INBOX_VALUE;  // '__inbox__' or a dir path
let browsingPath = '';           // current level being viewed in picker

/* ── View switching ── */

function showView(view: HTMLElement) {
  [viewSetup, viewClip, viewSuccess, viewLoading].forEach(v => v.hidden = true);
  view.hidden = false;
}

/* ── Button loading state ── */

function setButtonLoading(btn: HTMLButtonElement, loading: boolean) {
  const text = btn.querySelector('.btn-text') as HTMLElement;
  const spinner = btn.querySelector('.btn-loading') as HTMLElement;
  if (text) text.hidden = loading;
  if (spinner) spinner.hidden = !loading;
  btn.disabled = loading;
}

function setClipBusy(busy: boolean) {
  clipTitle.disabled = busy;
  dirTrigger.disabled = busy;
  dirConfirm.disabled = busy;
  btnSettings.disabled = busy;
}

/* ── Turndown instance ── */

const turndown = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
  emDelimiter: '*',
});

// Preserve code blocks
turndown.addRule('pre-code', {
  filter: (node) => node.nodeName === 'PRE' && !!node.querySelector('code'),
  replacement: (_content, node) => {
    const code = (node as Element).querySelector('code');
    const lang = code?.className?.match(/language-(\w+)/)?.[1] || '';
    const text = code?.textContent || '';
    return `\n\`\`\`${lang}\n${text}\n\`\`\`\n`;
  },
});

/* ── Extract content from active tab ── */

async function extractContent(): Promise<PageContent> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) throw new Error('No active tab');

  // Content scripts can't run on chrome://, edge://, about:, or extension pages
  const url = tab.url ?? '';
  if (url.startsWith('chrome') || url.startsWith('edge') || url.startsWith('about:') || url.startsWith('moz-extension')) {
    throw new Error('Cannot clip browser internal pages');
  }

  // Inject content script on demand (not always-on — saves memory on every page)
  // Step 1: inject Readability + extractor (IIFE, sets window.__mindosClipResult)
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ['content/extractor.js'],
    });
  } catch {
    throw new Error('Cannot read this page — try refreshing first');
  }

  // Step 2: read the result back (executeScript with func can return values)
  let results: chrome.scripting.InjectionResult[];
  try {
    results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => (window as any).__mindosClipResult,
    });
  } catch {
    throw new Error('Cannot read extraction result');
  }

  const result = results?.[0]?.result;
  if (!result || typeof result !== 'object') {
    throw new Error('Content extraction returned empty result');
  }

  return result as PageContent;
}

async function loadClipContext() {
  const [contentResult, dirsResult] = await Promise.allSettled([
    extractContent(),
    listDirs(config),
  ]);

  const content = contentResult.status === 'fulfilled' ? contentResult.value : null;
  const dirs = dirsResult.status === 'fulfilled' ? dirsResult.value : [];
  const dirsErrorMsg = dirsResult.status === 'rejected'
    ? 'Could not load spaces. Saving to Inbox is still available.'
    : undefined;
  const errorMsg = contentResult.status === 'rejected'
    ? (contentResult.reason instanceof Error ? contentResult.reason.message : 'Cannot read this page')
    : undefined;

  return { content, dirs, errorMsg, dirsErrorMsg };
}

/* ── Init ── */

async function init() {
  config = await loadConfig();

  if (!isConfigured(config)) {
    showView(viewSetup);
    setupUrl.value = config.mindosUrl;
    return;
  }

  // Configured — extract content
  showView(viewLoading);

  const context = await loadClipContext();
  extractedContent = context.content;
  allDirs = context.dirs;
  showClipView(context.errorMsg, context.dirsErrorMsg);
}

function showClipView(errorMsg?: string, dirsErrorMsg?: string) {
  showView(viewClip);

  const hasContent = !!extractedContent;
  const displayError = errorMsg ?? dirsErrorMsg;

  if (displayError && !hasContent) {
    showError(clipError, displayError);
    btnSave.disabled = true;
    setClipStatus('Read failed', 'status-chip-error');
  } else {
    if (displayError) {
      showError(clipError, displayError);
    } else {
      hideError(clipError);
    }
    btnSave.disabled = !hasContent;
    setClipStatus(hasContent ? 'Ready' : 'Read failed', hasContent ? 'status-chip-success' : 'status-chip-error');
  }

  if (extractedContent) {
    clipTitle.value = extractedContent.title;
    clipSourceLabel.textContent = extractedContent.captureType === 'ai-conversation'
      ? 'AI conversation'
      : 'Current page';

    try {
      const host = new URL(extractedContent.url).hostname.replace(/^www\./, '');
      clipSiteText.textContent = extractedContent.sourcePlatformLabel || host;
      clipSiteBadge.style.display = '';
    } catch {
      clipSiteBadge.style.display = 'none';
    }

    clipWordsText.textContent = extractedContent.captureType === 'ai-conversation' && extractedContent.messageCount != null
      ? `${extractedContent.messageCount.toLocaleString()} messages`
      : `${extractedContent.wordCount.toLocaleString()} words`;
    clipWordsBadge.style.display = '';
  } else {
    clipTitle.value = '';
    clipSourceLabel.textContent = 'Current page';
    clipSiteBadge.style.display = 'none';
    clipWordsBadge.style.display = 'none';
  }

  // Reset dir picker state
  selectedPath = INBOX_VALUE;
  browsingPath = '';
  updateDirLabel();
  toggleDirPanel(false);
  setClipBusy(false);
}

/** Render the hierarchical directory picker at the current browsing level */
function createSvgIcon(className: string, size: string, pathData?: string, polylinePoints?: string): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('class', className);
  svg.setAttribute('width', size);
  svg.setAttribute('height', size);
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');

  if (pathData) {
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', pathData);
    svg.appendChild(path);
  }

  if (polylinePoints) {
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', polylinePoints);
    svg.appendChild(polyline);
  }

  return svg;
}

function renderDirPicker() {
  // Breadcrumb
  const segments = getBreadcrumbSegments(browsingPath);
  dirBreadcrumb.replaceChildren();

  // Root / Inbox button
  const rootBtn = document.createElement('button');
  rootBtn.type = 'button';
  rootBtn.textContent = 'Inbox';
  rootBtn.className = selectedPath === INBOX_VALUE && !browsingPath ? 'active' : '';
  rootBtn.addEventListener('click', () => {
    browsingPath = '';
    selectedPath = INBOX_VALUE;
    updateDirLabel();
    renderDirPicker();
  });
  dirBreadcrumb.appendChild(rootBtn);

  segments.forEach((seg, i) => {
    const sep = document.createElement('span');
    sep.className = 'crumb-sep';
    sep.textContent = String.fromCharCode(8250);
    dirBreadcrumb.appendChild(sep);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = seg;
    const path = segments.slice(0, i + 1).join('/');
    btn.className = i === segments.length - 1 ? 'active' : '';
    btn.addEventListener('click', () => {
      browsingPath = path;
      selectedPath = path;
      updateDirLabel();
      renderDirPicker();
    });
    dirBreadcrumb.appendChild(btn);
  });

  // Child directories at current level
  const children = getChildDirectories(allDirs, browsingPath);

  dirList.replaceChildren();
  for (const childPath of children) {
    const childName = childPath.split('/').pop() || childPath;
    const hasChildren = hasChildDirectories(allDirs, childPath);

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'dir-item';
    if (selectedPath === childPath) {
      btn.classList.add('active');
    }
    btn.setAttribute('aria-label', hasChildren ? `Open ${childPath}` : `Select ${childPath}`);
    btn.appendChild(createSvgIcon('dir-item-icon', '12', 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z'));

    const name = document.createElement('span');
    name.className = 'dir-item-name';
    name.textContent = childName;
    btn.appendChild(name);

    if (hasChildren) {
      btn.appendChild(createSvgIcon('dir-item-arrow', '11', undefined, '9 18 15 12 9 6'));
    }

    btn.addEventListener('click', () => {
      selectedPath = childPath;
      updateDirLabel();
      if (hasChildren) {
        browsingPath = childPath;
        renderDirPicker();
        return;
      }
      toggleDirPanel(false);
    });
    dirList.appendChild(btn);
  }
}

function updateDirLabel() {
  dirLabel.textContent = formatDirLabel(selectedPath);
}

function setClipStatus(text: string, className: string) {
  clipStatus.textContent = text;
  clipStatus.className = `status-chip ${className}`;
}

function toggleDirPanel(show?: boolean) {
  const isOpen = show ?? dirPanel.hidden;
  dirPanel.hidden = !isOpen;
  dirTrigger.classList.toggle('active', isOpen);
  dirTrigger.setAttribute('aria-expanded', String(isOpen));
  if (isOpen) renderDirPicker();
}

/* ── Event Handlers ── */

// Connect button
btnConnect.addEventListener('click', async () => {
  const url = setupUrl.value.trim().replace(/\/+$/, '');
  const token = setupToken.value.trim();

  if (!url) { showError(setupError, 'Please enter your MindOS URL'); return; }
  if (!token) { showError(setupError, 'Please paste your auth token'); return; }

  hideError(setupError);
  setButtonLoading(btnConnect, true);

  try {
    const testConfig: ClipperConfig = {
      mindosUrl: url,
      authToken: token,
    };

    const result = await testConnection(testConfig);
    if (!result.ok) {
      showError(setupError, result.error || 'Connection failed');
      return;
    }

    // Save and proceed
    config = await saveConfig(testConfig);

    // Now extract content
    showView(viewLoading);

    const context = await loadClipContext();
    extractedContent = context.content;
    allDirs = context.dirs;
    showClipView(context.errorMsg, context.dirsErrorMsg);
  } catch {
    showError(setupError, 'Could not save connection settings');
  } finally {
    setButtonLoading(btnConnect, false);
  }
});

// Save button
btnSave.addEventListener('click', async () => {
  if (!extractedContent) {
    showError(clipError, 'No content extracted from this page');
    return;
  }

  hideError(clipError);
  setClipStatus('Saving…', 'status-chip-loading');
  setButtonLoading(btnSave, true);
  setClipBusy(true);

  try {
    // Override title if user edited
    const content = { ...extractedContent, title: clipTitle.value.trim() || extractedContent.title };
    const isInbox = selectedPath === INBOX_VALUE;

    const doc = toClipDocument(content, isInbox ? '' : selectedPath, (html) => turndown.turndown(html));

    // Route to Inbox API or File API based on user choice
    const result = isInbox
      ? await saveToInbox(config, doc.fileName, doc.markdown, doc.source)
      : await createFile(config, selectedPath, doc.fileName, doc.markdown, doc.source);

    if (result.error) {
      showError(clipError, result.error);
      setClipStatus('Save failed', 'status-chip-error');
      return;
    }

    // Success!
    const displayPath = isInbox ? `Inbox/${doc.fileName}` : `${selectedPath}/${doc.fileName}`;
    successDetail.textContent = displayPath;
    showView(viewSuccess);
  } catch {
    showError(clipError, 'Save failed unexpectedly');
    setClipStatus('Save failed', 'status-chip-error');
  } finally {
    setButtonLoading(btnSave, false);
    setClipBusy(false);
  }
});

// Settings button — go back to setup
btnSettings.addEventListener('click', () => {
  setupUrl.value = config.mindosUrl;
  setupToken.value = config.authToken;
  toggleDirPanel(false);
  showView(viewSetup);
});

// Done button — close popup
btnDone.addEventListener('click', () => {
  window.close();
});

// Clip Again — go back to clip view for same page
btnClipAnother.addEventListener('click', () => {
  showClipView();
});

// DirPicker — toggle panel
dirTrigger.addEventListener('click', () => toggleDirPanel());

// DirPicker — confirm selection
dirConfirm.addEventListener('click', () => {
  selectedPath = browsingPath || INBOX_VALUE;
  updateDirLabel();
  toggleDirPanel(false);
});

// DirPicker — Esc to close panel
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !dirPanel.hidden) {
    e.preventDefault();
    toggleDirPanel(false);
  }
});

document.addEventListener('click', (e) => {
  if (dirPanel.hidden) return;
  const target = e.target as Node | null;
  if (!target) return;
  if (dirPanel.contains(target) || dirTrigger.contains(target)) return;
  toggleDirPanel(false);
});

/* ── Error display helpers ── */

function showError(el: HTMLElement, msg: string) {
  el.textContent = msg;
  el.hidden = false;
}

function hideError(el: HTMLElement) {
  el.hidden = true;
}

/* ── Boot ── */
init();
