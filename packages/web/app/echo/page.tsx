import ClientRedirect from '@/components/ClientRedirect';
import { defaultEchoPath } from '@/lib/echo-segments';

export default function EchoIndexPage() {
  return <ClientRedirect href={defaultEchoPath()} label="Redirecting to Echo..." />;
}
