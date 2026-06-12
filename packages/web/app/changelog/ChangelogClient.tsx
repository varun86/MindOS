'use client';

import { ChangeLogRenderer } from '@/components/renderers/change-log/ChangeLogRenderer';
import { NarrowPageShell } from '@/components/shared/ContentPageShell';
import type { RendererContext } from '@/lib/renderers/registry';

const noop = async () => {};
const ctx: RendererContext = { filePath: '.mindos/change-log.json', content: '', extension: 'json', saveAction: noop };

export default function ChangelogClient() {
  return (
    <NarrowPageShell>
      <ChangeLogRenderer {...ctx} />
    </NarrowPageShell>
  );
}
