import { readSetupPending } from '@/lib/setup-state';
import SettingsContent from '@/components/settings/SettingsContent';
import ClientRedirect from '@/components/ClientRedirect';
import type { Tab } from '@/components/settings/types';

export const dynamic = 'force-dynamic';

const SETTINGS_TABS = new Set<Tab>([
  'ai',
  'mcp',
  'plugins',
  'knowledge',
  'appearance',
  'sync',
  'update',
  'uninstall',
]);

function parseSettingsTab(tab: string | undefined): Tab | undefined {
  return tab && SETTINGS_TABS.has(tab as Tab) ? (tab as Tab) : undefined;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  const params = await searchParams;
  const initialTab = parseSettingsTab(params.tab);

  return (
    <div className="h-full min-h-0 flex flex-col">
      <SettingsContent visible variant="panel" initialTab={initialTab} />
    </div>
  );
}
