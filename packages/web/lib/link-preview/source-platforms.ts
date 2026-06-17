export type SourcePlatformId =
  | 'youtube'
  | 'bilibili'
  | 'xiaohongshu'
  | 'zhihu'
  | 'github'
  | 'reddit'
  | 'x'
  | 'wechat'
  | 'arxiv'
  | 'chatgpt'
  | 'claude'
  | 'gemini'
  | 'deepseek'
  | 'kimi'
  | 'qwen'
  | 'zhipu'
  | 'minimax';

export interface SourcePlatformDefinition {
  id: SourcePlatformId;
  label: string;
  domains: string[];
  iconPath?: string;
  fallback: string;
}

export const SOURCE_PLATFORMS: SourcePlatformDefinition[] = [
  {
    id: 'youtube',
    label: 'YouTube',
    domains: ['youtube.com', 'youtu.be', 'youtube-nocookie.com'],
    iconPath: '/source-icons/youtube.ico',
    fallback: 'YT',
  },
  {
    id: 'bilibili',
    label: 'Bilibili',
    domains: ['bilibili.com', 'b23.tv'],
    iconPath: '/source-icons/bilibili.ico',
    fallback: 'B',
  },
  {
    id: 'xiaohongshu',
    label: 'Xiaohongshu',
    domains: ['xiaohongshu.com', 'xhslink.com'],
    fallback: '小',
  },
  {
    id: 'zhihu',
    label: 'Zhihu',
    domains: ['zhihu.com'],
    fallback: '知',
  },
  {
    id: 'github',
    label: 'GitHub',
    domains: ['github.com', 'gist.github.com'],
    iconPath: '/source-icons/github.svg',
    fallback: 'GH',
  },
  {
    id: 'reddit',
    label: 'Reddit',
    domains: ['reddit.com', 'redd.it'],
    fallback: 'r/',
  },
  {
    id: 'x',
    label: 'X',
    domains: ['x.com', 'twitter.com'],
    iconPath: '/source-icons/x.ico',
    fallback: 'X',
  },
  {
    id: 'wechat',
    label: 'WeChat',
    domains: ['mp.weixin.qq.com', 'weixin.qq.com'],
    fallback: '微',
  },
  {
    id: 'arxiv',
    label: 'arXiv',
    domains: ['arxiv.org'],
    fallback: 'ar',
  },
  {
    id: 'chatgpt',
    label: 'ChatGPT',
    domains: ['chatgpt.com', 'chat.openai.com'],
    iconPath: '/agent-icons/openai.svg',
    fallback: 'GPT',
  },
  {
    id: 'claude',
    label: 'Claude',
    domains: ['claude.ai'],
    iconPath: '/agent-icons/claude.svg',
    fallback: 'Cl',
  },
  {
    id: 'gemini',
    label: 'Gemini',
    domains: ['gemini.google.com'],
    iconPath: '/agent-icons/gemini.svg',
    fallback: 'Ge',
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    domains: ['chat.deepseek.com', 'deepseek.com'],
    fallback: 'DS',
  },
  {
    id: 'kimi',
    label: 'Kimi',
    domains: ['kimi.moonshot.cn', 'kimi.com'],
    iconPath: '/agent-icons/kimi-cli.png',
    fallback: 'K',
  },
  {
    id: 'qwen',
    label: 'Qwen',
    domains: ['chat.qwen.ai', 'tongyi.aliyun.com', 'qianwen.aliyun.com'],
    iconPath: '/agent-icons/qwen-code.svg',
    fallback: 'Q',
  },
  {
    id: 'zhipu',
    label: 'Zhipu GLM',
    domains: ['chatglm.cn', 'z.ai', 'chat.z.ai', 'bigmodel.cn'],
    fallback: 'GLM',
  },
  {
    id: 'minimax',
    label: 'MiniMax',
    domains: ['chat.minimax.io', 'minimax.io', 'chat.minimaxi.com', 'hailuoai.com'],
    fallback: 'MM',
  },
];

const PLATFORM_BY_ID = new Map(SOURCE_PLATFORMS.map(platform => [platform.id, platform]));

export function getSourcePlatformDefinition(id: string | null | undefined): SourcePlatformDefinition | null {
  if (!id) return null;
  return PLATFORM_BY_ID.get(id as SourcePlatformId) ?? null;
}

export function detectSourcePlatform(input: string | null | undefined): SourcePlatformDefinition | null {
  const hostname = normalizeSourceHostname(input);
  if (!hostname) return null;

  return SOURCE_PLATFORMS.find(platform => (
    platform.domains.some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
  )) ?? null;
}

export function normalizeSourceHostname(input: string | null | undefined): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  try {
    const parsed = trimmed.includes('://')
      ? new URL(trimmed)
      : new URL(`https://${trimmed}`);
    return parsed.hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return null;
  }
}
