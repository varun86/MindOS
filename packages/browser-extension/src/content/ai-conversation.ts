export type AiConversationRole = 'user' | 'assistant' | 'system' | 'tool' | 'unknown';

export interface AiConversationPlatform {
  id: string;
  label: string;
  domains: string[];
  rootSelectors: string[];
  messageSelectors: string[];
  userSelectors: string[];
  assistantSelectors: string[];
  contentSelectors: string[];
  fallbackStartRole?: 'user' | 'assistant';
}

export interface AiConversationMessage {
  role: AiConversationRole;
  html: string;
  text: string;
}

export interface AiConversationCapture {
  title: string;
  content: string;
  textContent: string;
  siteName: string;
  sourcePlatform: string;
  sourcePlatformLabel: string;
  messageCount: number;
  wordCount: number;
}

const DEFAULT_ROOT_SELECTORS = [
  '#thread',
  '#chat-history',
  'main',
  '[role="main"]',
  '[class*="conversation"]',
  '[class*="chat"]',
  'body',
];

const DEFAULT_CONTENT_SELECTORS = [
  '[data-message-author-role]',
  '[data-message-content]',
  '[data-testid="message-content"]',
  '[data-testid*="message-content"]',
  '[class*="markdown"]',
  '[class*="prose"]',
  '[class*="message-content"]',
  'message-content',
];

const NOISY_MESSAGE_SELECTORS = [
  'script',
  'style',
  'noscript',
  'svg',
  'button',
  'textarea',
  'input',
  'select',
  'form',
  '[role="button"]',
  '[aria-hidden="true"]',
  '[hidden]',
  '[data-testid*="copy"]',
  '[data-testid*="feedback"]',
  '[class*="copy"]',
  '[class*="feedback"]',
  '[class*="toolbar"]',
  '[class*="actions"]',
];

export const AI_CONVERSATION_PLATFORMS: AiConversationPlatform[] = [
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    domains: ['chatgpt.com', 'chat.openai.com'],
    rootSelectors: ['#thread', 'main'],
    messageSelectors: [
      '[data-message-author-role]',
      'article[data-testid^="conversation-turn-"]',
      '[data-testid^="conversation-turn-"]',
    ],
    userSelectors: ['[data-message-author-role="user"]'],
    assistantSelectors: ['[data-message-author-role="assistant"]'],
    contentSelectors: [
      '[data-message-author-role]',
      '.markdown',
      '[class*="markdown"]',
      '[class*="prose"]',
    ],
    fallbackStartRole: 'user',
  },
  {
    id: 'claude',
    label: 'Claude',
    domains: ['claude.ai'],
    rootSelectors: ['main', '[data-test-render-count]'],
    messageSelectors: [
      '[data-testid="user-message"], [data-testid="assistant-message"], .font-claude-response, .font-claude-message',
      '[data-testid*="message"]',
    ],
    userSelectors: ['[data-testid="user-message"]'],
    assistantSelectors: ['[data-testid="assistant-message"], .font-claude-response, .font-claude-message'],
    contentSelectors: [
      '[data-testid="user-message"]',
      '[data-testid="assistant-message"]',
      '.font-claude-response',
      '.font-claude-message',
      '.prose',
    ],
    fallbackStartRole: 'user',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    domains: ['gemini.google.com'],
    rootSelectors: ['#chat-history', 'main'],
    messageSelectors: [
      'user-query, user-query-content, model-response, message-content',
      '[data-testid="user-query"], [data-testid="model-response"], [data-testid*="message"]',
    ],
    userSelectors: ['user-query, user-query-content, [data-testid="user-query"]'],
    assistantSelectors: ['model-response, message-content, [data-testid="model-response"]'],
    contentSelectors: ['user-query-content', 'message-content', '.markdown', '[class*="markdown"]'],
    fallbackStartRole: 'user',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    domains: ['chat.deepseek.com', 'deepseek.com'],
    rootSelectors: ['main', '[class*="chat"]'],
    messageSelectors: [
      '[data-message-author-role], [data-role]',
      '[class*="message"], [class*="Message"], [class*="ds-markdown"]',
    ],
    userSelectors: ['[data-role="user"], [data-message-author-role="user"], [class*="user"]'],
    assistantSelectors: ['[data-role="assistant"], [data-message-author-role="assistant"], [class*="assistant"], [class*="ds-markdown"]'],
    contentSelectors: ['[class*="ds-markdown"]', '[class*="markdown"]', '[class*="message-content"]'],
    fallbackStartRole: 'user',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    domains: ['kimi.moonshot.cn', 'kimi.com'],
    rootSelectors: ['main', '[class*="chat"]', '[class*="conversation"]'],
    messageSelectors: [
      '[data-message-author-role], [data-role]',
      '[class*="chat-message"], [class*="message-item"], [class*="message-content"]',
    ],
    userSelectors: ['[data-role="user"], [data-message-author-role="user"], [class*="user"]'],
    assistantSelectors: ['[data-role="assistant"], [data-message-author-role="assistant"], [class*="assistant"], [class*="kimi"]'],
    contentSelectors: ['[class*="markdown"]', '[class*="message-content"]', '[class*="segment-content"]'],
    fallbackStartRole: 'user',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    domains: ['chat.qwen.ai', 'tongyi.aliyun.com', 'qianwen.aliyun.com'],
    rootSelectors: ['main', '[class*="chat"]'],
    messageSelectors: [
      '[data-message-author-role], [data-role]',
      '[class*="message"], [class*="chat-item"]',
    ],
    userSelectors: ['[data-role="user"], [data-message-author-role="user"], [class*="user"]'],
    assistantSelectors: ['[data-role="assistant"], [data-message-author-role="assistant"], [class*="assistant"], [class*="bot"]'],
    contentSelectors: ['[class*="markdown"]', '[class*="message-content"]'],
    fallbackStartRole: 'user',
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM',
    domains: ['chatglm.cn', 'z.ai', 'chat.z.ai', 'bigmodel.cn'],
    rootSelectors: ['main', '[class*="chat"]'],
    messageSelectors: [
      '[data-message-author-role], [data-role]',
      '[class*="message"], [class*="chat-item"]',
    ],
    userSelectors: ['[data-role="user"], [data-message-author-role="user"], [class*="user"]'],
    assistantSelectors: ['[data-role="assistant"], [data-message-author-role="assistant"], [class*="assistant"], [class*="bot"]'],
    contentSelectors: ['[class*="markdown"]', '[class*="message-content"]'],
    fallbackStartRole: 'user',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    domains: ['chat.minimax.io', 'minimax.io', 'chat.minimaxi.com', 'hailuoai.com'],
    rootSelectors: ['main', '[class*="chat"]'],
    messageSelectors: [
      '[data-message-author-role], [data-role]',
      '[class*="message"], [class*="chat-item"]',
    ],
    userSelectors: ['[data-role="user"], [data-message-author-role="user"], [class*="user"]'],
    assistantSelectors: ['[data-role="assistant"], [data-message-author-role="assistant"], [class*="assistant"], [class*="bot"]'],
    contentSelectors: ['[class*="markdown"]', '[class*="message-content"]'],
    fallbackStartRole: 'user',
  },
];

export function detectAiConversationPlatform(url: string): AiConversationPlatform | null {
  let hostname = '';
  try {
    hostname = new URL(url).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }

  return AI_CONVERSATION_PLATFORMS.find(platform => (
    platform.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  )) ?? null;
}

export function normalizeRole(input: string | null | undefined): AiConversationRole {
  if (!input) return 'unknown';
  const value = input.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-');
  if (/(^|-)user($|-)|(^|-)human($|-)|(^|-)you($|-)|用户|我/.test(value)) return 'user';
  if (/(^|-)assistant($|-)|(^|-)bot($|-)|chatgpt|claude|gemini|deepseek|kimi|qwen|glm|minimax|回答|助手/.test(value)) return 'assistant';
  if (/(^|-)system($|-)/.test(value)) return 'system';
  if (/(^|-)tool($|-)/.test(value)) return 'tool';
  return 'unknown';
}

export function buildConversationHtml(messages: AiConversationMessage[], platform: AiConversationPlatform): string {
  const sections = messages.map((message, index) => {
    const label = roleLabel(message.role, platform);
    return [
      `<section data-mindos-message-role="${message.role}" data-mindos-message-index="${index + 1}">`,
      `<h2>${escapeHtml(label)}</h2>`,
      `<div>${message.html}</div>`,
      '</section>',
    ].join('');
  });

  return [
    '<article data-mindos-ai-conversation="true">',
    `<p><strong>Platform:</strong> ${escapeHtml(platform.label)}</p>`,
    `<p><strong>Messages:</strong> ${messages.length}</p>`,
    ...sections,
    '</article>',
  ].join('\n');
}

export function extractAiConversationContent(doc: Document, url: string): AiConversationCapture | null {
  const platform = detectAiConversationPlatform(url);
  if (!platform) return null;

  const root = findConversationRoot(doc, platform);
  const messages = extractMessages(root, platform);
  if (!isConversationLike(messages)) return null;

  const title = conversationTitle(doc, platform);
  const content = buildConversationHtml(messages, platform);
  const textContent = messages.map(message => `${roleLabel(message.role, platform)}:\n${message.text}`).join('\n\n');

  return {
    title,
    content,
    textContent,
    siteName: platform.label,
    sourcePlatform: platform.id,
    sourcePlatformLabel: platform.label,
    messageCount: messages.length,
    wordCount: countWords(textContent),
  };
}

function findConversationRoot(doc: Document, platform: AiConversationPlatform): Element {
  const selectors = [...platform.rootSelectors, ...DEFAULT_ROOT_SELECTORS];
  let best: Element | null = null;
  let bestScore = -1;

  for (const selector of selectors) {
    for (const candidate of queryAll(doc, selector)) {
      const score = scoreRoot(candidate, platform);
      if (score > bestScore) {
        best = candidate;
        bestScore = score;
      }
    }
  }

  return best ?? doc.body ?? doc.documentElement;
}

function scoreRoot(root: Element, platform: AiConversationPlatform): number {
  const selector = platform.messageSelectors.join(', ');
  const candidates = queryAll(root, selector);
  const roleHits = queryAll(root, [...platform.userSelectors, ...platform.assistantSelectors].join(', ')).length;
  const textLength = normalizeWhitespace(root.textContent ?? '').length;
  return candidates.length * 1000 + roleHits * 250 + Math.min(textLength, 5000);
}

function extractMessages(root: Element, platform: AiConversationPlatform): AiConversationMessage[] {
  for (const selector of platform.messageSelectors) {
    const elements = dedupeElements(queryMessageElements(root, selector, platform));
    const messages = elementsToMessages(elements, platform);
    if (isConversationLike(messages)) return messages;
  }

  const roleSelector = [...platform.userSelectors, ...platform.assistantSelectors].join(', ');
  const roleElements = dedupeElements(queryMessageElements(root, roleSelector, platform));
  return elementsToMessages(roleElements, platform);
}

function elementsToMessages(elements: Element[], platform: AiConversationPlatform): AiConversationMessage[] {
  const roles = elements.map(element => inferRole(element, platform));
  const shouldAlternate = roles.every(role => role === 'unknown') && Boolean(platform.fallbackStartRole);

  return elements
    .map((element, index) => {
      const contentElement = pickContentElement(element, platform);
      const text = cleanMessageText(contentElement);
      if (!text || text.length < 2) return null;

      const role = shouldAlternate
        ? alternatingRole(platform.fallbackStartRole ?? 'user', index)
        : roles[index] ?? 'unknown';

      return {
        role,
        html: cleanMessageHtml(contentElement),
        text,
      } satisfies AiConversationMessage;
    })
    .filter((message): message is AiConversationMessage => Boolean(message));
}

function queryMessageElements(root: Element, selector: string, platform: AiConversationPlatform): Element[] {
  return queryAll(root, selector)
    .filter(element => isProbablyVisible(element))
    .filter(element => cleanMessageText(element).length >= 2)
    .filter(element => !isLikelyConversationContainer(element, platform));
}

function isLikelyConversationContainer(element: Element, platform: AiConversationPlatform): boolean {
  if (inferRoleFromSelf(element, platform) !== 'unknown') return false;

  const nestedRoles = queryAll(element, [...platform.userSelectors, ...platform.assistantSelectors].join(', '))
    .filter(child => child !== element)
    .length;
  if (nestedRoles >= 2) return true;

  const nestedMessages = queryAll(element, platform.messageSelectors.join(', '))
    .filter(child => child !== element)
    .length;
  return nestedMessages >= 2;
}

function isConversationLike(messages: AiConversationMessage[]): boolean {
  if (messages.length < 2) return false;
  const useful = messages.filter(message => message.text.length >= 2);
  if (useful.length < 2) return false;
  const roles = new Set(useful.map(message => message.role));
  return (roles.has('user') && roles.has('assistant')) || useful.length >= 4;
}

function inferRole(element: Element, platform: AiConversationPlatform): AiConversationRole {
  const selfRole = inferRoleFromSelf(element, platform);
  if (selfRole !== 'unknown') return selfRole;

  const roleDescendant = element.querySelector('[data-message-author-role], [data-role], [data-author], [data-testid*="user"], [data-testid*="assistant"]');
  if (roleDescendant) return inferRole(roleDescendant, platform);

  return 'unknown';
}

function inferRoleFromSelf(element: Element, platform: AiConversationPlatform): AiConversationRole {
  if (matchesAny(element, platform.userSelectors)) return 'user';
  if (matchesAny(element, platform.assistantSelectors)) return 'assistant';

  return [
    element.getAttribute('data-message-author-role'),
    element.getAttribute('data-role'),
    element.getAttribute('data-author'),
    element.getAttribute('aria-label'),
    element.getAttribute('data-testid'),
    element.className?.toString(),
  ].map(normalizeRole).find(role => role !== 'unknown') ?? 'unknown';
}

function alternatingRole(start: 'user' | 'assistant', index: number): AiConversationRole {
  const oddRole = start === 'user' ? 'assistant' : 'user';
  return index % 2 === 0 ? start : oddRole;
}

function pickContentElement(element: Element, platform: AiConversationPlatform): Element {
  const selectors = [...platform.contentSelectors, ...DEFAULT_CONTENT_SELECTORS];
  for (const selector of selectors) {
    const matches = queryAll(element, selector)
      .filter(candidate => isProbablyVisible(candidate))
      .filter(candidate => cleanMessageText(candidate).length >= 2);
    if (matches.length > 0) {
      return smallestReadableElement(matches);
    }
  }
  return element;
}

function smallestReadableElement(elements: Element[]): Element {
  return elements.reduce((best, current) => {
    const bestLength = cleanMessageText(best).length;
    const currentLength = cleanMessageText(current).length;
    if (currentLength < 2) return best;
    if (bestLength < 2) return current;
    return currentLength < bestLength ? current : best;
  });
}

function cleanMessageHtml(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  removeNoisyMessageNodes(clone);
  stripNoisyAttributes(clone);
  absolutizeLinks(clone);

  const html = clone.innerHTML.trim();
  if (html) return html;
  return `<p>${escapeHtml(normalizeWhitespace(clone.textContent ?? ''))}</p>`;
}

function cleanMessageText(element: Element): string {
  const clone = element.cloneNode(true) as Element;
  removeNoisyMessageNodes(clone);
  return normalizeWhitespace(clone.textContent ?? '');
}

function removeNoisyMessageNodes(root: Element): void {
  queryAll(root, NOISY_MESSAGE_SELECTORS.join(', ')).forEach(node => node.remove());
}

function stripNoisyAttributes(root: Element): void {
  const elements = [root, ...Array.from(root.querySelectorAll('*'))];
  for (const element of elements) {
    for (const attr of Array.from(element.attributes)) {
      if (['href', 'src', 'alt', 'title', 'colspan', 'rowspan'].includes(attr.name)) continue;
      if (attr.name === 'class' && element.tagName === 'CODE' && /\blanguage-[\w-]+/.test(attr.value)) continue;
      element.removeAttribute(attr.name);
    }
  }
}

function absolutizeLinks(root: Element): void {
  const baseURI = root.ownerDocument?.baseURI || globalThis.document?.baseURI || '';
  for (const anchor of Array.from(root.querySelectorAll('a[href]'))) {
    const href = anchor.getAttribute('href');
    if (!href) continue;
    try {
      anchor.setAttribute('href', new URL(href, baseURI).toString());
    } catch {
      // Keep the original href if the browser cannot resolve it.
    }
  }
}

function conversationTitle(doc: Document, platform: AiConversationPlatform): string {
  const heading = firstNonEmptyText([
    'main h1',
    '[role="main"] h1',
    'h1',
    '[data-testid="conversation-title"]',
    '[class*="conversation-title"]',
    '[class*="chat-title"]',
  ].flatMap(selector => queryAll(doc, selector)));

  const raw = heading || doc.title || `${platform.label} conversation`;
  const withoutPlatform = raw
    .replace(/\s*[-|–]\s*(ChatGPT|Claude|Gemini|DeepSeek|Kimi|Qwen|通义千问|智谱清言|MiniMax).*$/i, '')
    .trim();

  return withoutPlatform || `${platform.label} conversation`;
}

function firstNonEmptyText(elements: Element[]): string | null {
  for (const element of elements) {
    const text = normalizeWhitespace(element.textContent ?? '');
    if (text) return text;
  }
  return null;
}

function roleLabel(role: AiConversationRole, platform: AiConversationPlatform): string {
  if (role === 'user') return 'User';
  if (role === 'assistant') return platform.label;
  if (role === 'system') return 'System';
  if (role === 'tool') return 'Tool';
  return 'Message';
}

function matchesAny(element: Element, selectors: string[]): boolean {
  return selectors.some(selector => {
    try {
      return element.matches(selector);
    } catch {
      return false;
    }
  });
}

function isProbablyVisible(element: Element): boolean {
  if (element.hasAttribute('hidden')) return false;
  if (element.getAttribute('aria-hidden') === 'true') return false;
  const style = element.getAttribute('style')?.toLowerCase() ?? '';
  if (/\bdisplay\s*:\s*none\b/.test(style)) return false;
  if (/\bvisibility\s*:\s*hidden\b/.test(style)) return false;
  return true;
}

function dedupeElements(elements: Element[]): Element[] {
  const deduped: Element[] = [];
  for (const element of elements) {
    if (deduped.some(existing => existing === element || existing.contains(element))) continue;
    const containingIndex = deduped.findIndex(existing => element.contains(existing));
    if (containingIndex >= 0) {
      deduped.splice(containingIndex, 1, element);
      continue;
    }
    deduped.push(element);
  }
  return deduped;
}

function queryAll(root: ParentNode, selector: string): Element[] {
  try {
    return Array.from(root.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function countWords(text: string): number {
  const latinWords = text.split(/\s+/).filter(Boolean).length;
  const cjkChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf\uac00-\ud7af]/g) || []).length;
  return cjkChars > latinWords ? cjkChars : latinWords;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
