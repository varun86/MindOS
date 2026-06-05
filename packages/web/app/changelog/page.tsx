import { readSetupPending } from '@/lib/setup-state';
import ChangelogClient from './ChangelogClient';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default async function ChangelogPage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;
  return <ChangelogClient />;
}
