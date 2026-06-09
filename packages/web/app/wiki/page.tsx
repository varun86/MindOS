import { readSetupPending } from '@/lib/setup-state';
import { getRecentlyModified } from '@/lib/fs';
import { getSpaceOverview } from '@/lib/space-records';
import WikiHomeContent from '@/components/WikiHomeContent';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default function WikiPage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  let recent: { path: string; mtime: number }[] = [];
  try {
    recent = getRecentlyModified(20);
  } catch (err) {
    console.error('[WikiPage] Failed to load recent files:', err);
  }

  const { workspaceSpaces, builtInMindSystemSpaces } = getSpaceOverview();

  return (
    <WikiHomeContent
      spaces={workspaceSpaces}
      recent={recent}
      mindSystemSpaces={builtInMindSystemSpaces}
    />
  );
}
