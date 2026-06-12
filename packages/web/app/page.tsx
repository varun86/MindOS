import ClientRedirect from '@/components/ClientRedirect';
import { defaultEchoPath } from '@/lib/echo-segments';
import { readSetupPending } from '@/lib/setup-state';

export const dynamic = 'force-dynamic';

export default function HomePage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;
  return <ClientRedirect href={defaultEchoPath()} label="Opening Echo..." />;
}
