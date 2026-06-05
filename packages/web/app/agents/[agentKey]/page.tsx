import { readSetupPending } from '@/lib/setup-state';
import AgentDetailContent from '@/components/agents/AgentDetailContent';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default async function AgentDetailPage({
  params,
}: {
  params: Promise<{ agentKey: string }>;
}) {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  const { agentKey } = await params;
  return <AgentDetailContent agentKey={decodeURIComponent(agentKey)} />;
}
