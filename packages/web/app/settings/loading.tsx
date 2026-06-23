import { Loader2 } from 'lucide-react';
import { LoadingPageShell } from '@/components/shared/ContentPageShell';

export default function SettingsLoading() {
  return (
    <LoadingPageShell className="flex min-h-[40vh] items-center justify-center">
      <Loader2 size={18} className="animate-spin text-muted-foreground" aria-hidden />
    </LoadingPageShell>
  );
}
