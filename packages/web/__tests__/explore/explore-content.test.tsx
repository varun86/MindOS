import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';

import ExploreContent from '@/components/explore/ExploreContent';
import { messages } from '@/lib/i18n';

vi.mock('@/lib/stores/locale-store', () => ({
  useLocale: () => ({ locale: 'en' as const, setLocale: () => {}, t: messages.en }),
}));

describe('ExploreContent', () => {
  it('keeps use-case cards out of the dense three-column layout until wide content space', () => {
    const html = renderToStaticMarkup(<ExploreContent />);

    expect(html).toContain('data-explore-use-case-grid="true"');
    expect(html).toContain('sm:grid-cols-2 xl:grid-cols-3');
    expect(html).not.toContain('lg:grid-cols-3');
  });
});
