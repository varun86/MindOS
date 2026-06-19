import { renderToStaticMarkup } from 'react-dom/server';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { AgentAvatar } from '@/components/agents/AgentsPrimitives';

describe('AgentAvatar icon mapping', () => {
  it('uses the Gemini icon for Gemini CLI instead of the generic Google icon', () => {
    const html = renderToStaticMarkup(<AgentAvatar name="Gemini CLI" />);

    expect(html).toContain('/agent-icons/gemini.svg');
    expect(html).not.toContain('/agent-icons/google.svg');
  });

  it('renders MindOS as the product avatar instead of a random green or teal fallback', () => {
    const html = renderToStaticMarkup(<AgentAvatar name="MindOS" status="connected" />);

    expect(html).toContain('/agent-icons/mindos.svg');
    expect(html).toContain('border-[var(--amber)]/35 bg-[var(--amber-subtle)] text-[var(--amber)]');
    expect(html).toContain('bg-[var(--amber)]');
    expect(html).not.toContain('bg-[var(--success)]');
    expect(html).not.toMatch(/emerald|teal|cyan|lime/);
  });

  it.each([
    ['MindOS', '/agent-icons/mindos.svg'],
    ['MindOS Agent', '/agent-icons/mindos.svg'],
    ['Claude Code', '/agent-icons/claude.svg'],
    ['Cursor', '/agent-icons/cursor.svg'],
    ['Windsurf', '/agent-icons/windsurf.svg'],
    ['Codex', '/agent-icons/openai.svg'],
    ['GitHub Copilot', '/agent-icons/github-copilot.svg'],
    ['Kimi Code', '/agent-icons/kimi-cli.png'],
    ['Kimi CLI', '/agent-icons/kimi-cli.png'],
    ['CodeBuddy', '/agent-icons/codebuddy.svg'],
    ['OpenClaw', '/agent-icons/openclaw.svg'],
    ['Qwen Code', '/agent-icons/qwen-code.svg'],
    ['Qoder', '/agent-icons/qoder.svg'],
    ['Trae', '/agent-icons/trae.png'],
    ['Trae CN', '/agent-icons/trae-cn.png'],
    ['Lingma', '/agent-icons/lingma.png'],
    ['WorkBuddy', '/agent-icons/workbuddy.svg'],
    ['OpenCode', '/agent-icons/opencode.svg'],
    ['Kilo Code', '/agent-icons/kilo-code.svg'],
    ['Kilo CLI', '/agent-icons/kilo-code.svg'],
    ['Warp', '/agent-icons/warp.svg'],
    ['Pi', '/agent-icons/pi.svg'],
    ['Augment', '/agent-icons/augment.svg'],
    ['Auggie', '/agent-icons/augment.svg'],
    ['Cline', '/agent-icons/cline.svg'],
    ['Roo Code', '/agent-icons/roo.svg'],
    ['QClaw', '/agent-icons/qclaw.jpg'],
    ['QuantumClaw', '/agent-icons/qclaw.jpg'],
    ['CoPaw', '/agent-icons/copaw.svg'],
    ['Hermes', '/agent-icons/hermes.svg'],
    ['Hermes Agent', '/agent-icons/hermes.svg'],
  ])('uses the bundled icon for %s', (name, iconPath) => {
    const html = renderToStaticMarkup(<AgentAvatar name={name} />);

    expect(html).toContain(iconPath);
    expect(existsSync(join(process.cwd(), 'public', iconPath))).toBe(true);
  });

  it.each(['Legacy Agent', 'Piper', 'Not Hermes Project'])('falls back to initials for %s without an active bundled icon', (name) => {
    const html = renderToStaticMarkup(<AgentAvatar name={name} />);

    expect(html).not.toContain('/agent-icons/');
  });
});
