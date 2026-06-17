import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Settings } from 'lucide-react';
import { describe, expect, it } from 'vitest';
import { SettingCard, SettingCardBody } from '@/components/settings/Primitives';

describe('settings card primitives', () => {
  it('uses the shared icon shell and indented content layout', () => {
    const html = renderToStaticMarkup(
      <SettingCard
        icon={<Settings />}
        title="AI"
        description="Model settings"
        actions={<span>v1</span>}
      >
        <button type="button">Save</button>
      </SettingCard>,
    );

    expect(html).toContain('h-8 w-8');
    expect(html).toContain('[&amp;_svg]:h-[15px]');
    expect(html).toContain('grid-cols-[2rem_minmax(0,1fr)]');
    expect(html).toContain('pl-11');
    expect(html).toContain('sm:col-start-3');
  });

  it('does not stack the default body gap over an explicit gap', () => {
    const html = renderToStaticMarkup(
      <SettingCardBody className="mt-4 space-y-2">
        <span>One</span>
        <span>Two</span>
      </SettingCardBody>,
    );

    expect(html).toContain('space-y-2');
    expect(html).not.toContain('space-y-4');
  });
});
