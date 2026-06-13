import type { Locale } from '@/lib/i18n';
import type { PlatformDef, PlatformStatus } from './platforms';

export function getPlatformPurpose(platform: PlatformDef, locale: Locale): string {
  if (locale === 'zh') return platform.purposeZh ?? platform.purpose ?? '';
  return platform.purpose ?? platform.purposeZh ?? '';
}

export function getPlatformDisplaySubtitle({
  platform,
  status,
  locale,
  connectedFallback,
  disconnectedFallback,
}: {
  platform: PlatformDef;
  status: PlatformStatus | undefined;
  locale: Locale;
  connectedFallback: string;
  disconnectedFallback: string;
}): string {
  if (status?.connected && status.botName) return status.botName;
  const purpose = getPlatformPurpose(platform, locale);
  if (purpose) return purpose;
  return status?.connected ? connectedFallback : disconnectedFallback;
}
