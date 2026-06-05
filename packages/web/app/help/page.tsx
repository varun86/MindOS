import { readSetupPending } from '@/lib/setup-state';
import HelpContent from '@/components/help/HelpContent';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default function HelpPage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  return <HelpContent />;
}
