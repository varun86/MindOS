// @vitest-environment jsdom
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GalleryView } from '@/components/renderers/csv/GalleryView';

describe('CSV Gallery responsive layout', () => {
  it('keeps gallery cards out of three columns until wide content space', () => {
    const html = renderToStaticMarkup(
      <GalleryView
        headers={['Title', 'Description', 'Tag']}
        rows={[
          ['One', 'First item', 'alpha'],
          ['Two', 'Second item', 'beta'],
          ['Three', 'Third item', 'gamma'],
        ]}
        cfg={{ titleField: 'Title', descField: 'Description', tagField: 'Tag' }}
      />,
    );

    expect(html).toContain('data-csv-gallery-grid="true"');
    expect(html).toContain('sm:grid-cols-2');
    expect(html).toContain('xl:grid-cols-3');
    expect(html).not.toContain('lg:grid-cols-3');
  });
});
