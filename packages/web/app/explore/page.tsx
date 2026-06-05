import { readSetupPending } from '@/lib/setup-state';
import ExploreContent from '@/components/explore/ExploreContent';
import ClientRedirect from '@/components/ClientRedirect';

export const dynamic = 'force-dynamic';

export default function ExplorePage() {
  if (readSetupPending()) return <ClientRedirect href="/setup" label="Opening setup..." />;

  return <ExploreContent />;
}
