import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { Bot } from 'lucide-react';
import { PanelNavRow } from '@/components/panels/PanelNavRow';

function htmlFor(active: boolean): string {
  const html = renderToStaticMarkup(
    <PanelNavRow
      icon={<Bot size={14} />}
      title={active ? 'Active' : 'Inactive'}
      href="/agents?tab=agent"
      active={active}
    />,
  );
  return html;
}

function classNameFor(active: boolean): string {
  const html = htmlFor(active);
  const match = html.match(/class="([^"]+)"/);
  return match?.[1] ?? '';
}

describe('PanelNavRow layout stability', () => {
  it('keeps active and inactive rows on the same horizontal grid', () => {
    const activeClassName = classNameFor(true);
    const inactiveClassName = classNameFor(false);

    expect(activeClassName).toContain('px-4');
    expect(inactiveClassName).toContain('px-4');
    expect(activeClassName).toContain('py-2.5');
    expect(inactiveClassName).toContain('py-2.5');
    expect(activeClassName).not.toContain('pl-3.5');
    expect(activeClassName).not.toContain('pr-4');
  });

  it('uses the lightweight rectangular active state with a left amber rail', () => {
    const activeHtml = htmlFor(true);
    const activeClassName = classNameFor(true);

    expect(activeClassName).toContain('rounded-none');
    expect(activeClassName).toContain('bg-[var(--amber-subtle)]');
    expect(activeClassName).not.toContain('ring-2 ring-ring/50');
    expect(activeClassName).not.toContain('border-border');
    expect(activeClassName).not.toContain('shadow');
    expect(activeClassName).not.toContain('bg-[var(--amber-dim)]');
    expect(activeHtml).toContain('w-[3px] rounded-r-full bg-[var(--amber)]');
    expect(activeHtml).toContain('aria-current="page"');
  });
});
