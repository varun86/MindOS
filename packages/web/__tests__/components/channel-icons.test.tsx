import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { ChannelIcon } from '@/components/agents/ChannelIcon';
import { PLATFORMS } from '@/lib/im/platforms';

const EXPECTED_ICON_FILES: Record<string, string> = {
  telegram: 'telegram.svg',
  feishu: 'feishu.svg',
  discord: 'discord.svg',
  slack: 'slack.svg',
  wecom: 'wecom.svg',
  dingtalk: 'dingtalk.svg',
  wechat: 'wechat.svg',
  qq: 'qq.svg',
};

describe('channel icons', () => {
  it('assigns a bundled SVG logo to every supported IM platform', () => {
    expect(PLATFORMS).toHaveLength(Object.keys(EXPECTED_ICON_FILES).length);

    for (const platform of PLATFORMS) {
      expect(platform.iconFile).toBe(EXPECTED_ICON_FILES[platform.id]);
      expect(existsSync(join(process.cwd(), 'public', 'channel-icons', platform.iconFile ?? ''))).toBe(true);
    }
  });

  it.each(PLATFORMS)('renders the bundled logo for $name', (platform) => {
    const html = renderToStaticMarkup(<ChannelIcon platform={platform} />);

    expect(html).toContain(`/channel-icons/${platform.iconFile}`);
    expect(html).not.toContain(platform.icon);
  });

  it('keeps the emoji fallback for platforms without a bundled logo', () => {
    const html = renderToStaticMarkup(<ChannelIcon platform={{ name: 'Custom', icon: '💬' }} />);

    expect(html).toContain('💬');
    expect(html).not.toContain('/channel-icons/');
  });
});
