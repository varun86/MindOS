import { readSetupPending } from '@/lib/setup-state';
import SetupWizard from '@/components/SetupWizard';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default async function SetupPage({ searchParams }: { searchParams: Promise<{ force?: string }> }) {
  const { force: forceParam } = await searchParams;
  const force = forceParam === '1';
  if (!readSetupPending() && !force) return <ClientRedirect href="/" label="Redirecting to MindOS..." />;
  return <SetupWizard />;
}
