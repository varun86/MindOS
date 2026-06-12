'use client';

import { useEffect, useState } from 'react';
import { useLocaleStore } from '@/lib/stores/locale-store';
import type { Locale } from '@/lib/i18n';
import { messages } from '@/lib/i18n';

function syncStoreToSsrLocale(ssrLocale: Locale) {
  const state = useLocaleStore.getState();
  if (state.locale !== ssrLocale) {
    useLocaleStore.setState({
      locale: ssrLocale,
      t: messages[ssrLocale] as unknown as typeof state.t,
    });
  }
}

/**
 * Initializes locale store with SSR value and attaches event listeners.
 * Renders nothing. Place once near the root.
 *
 * During the first client render, synchronously updates the Zustand store
 * to match ssrLocale (from server cookie). This ensures the first client
 * render produces identical HTML to the server, preventing hydration mismatch.
 * After hydration, _init() reconciles with localStorage/navigator for
 * the true client preference.
 */
export default function LocaleStoreInit({ ssrLocale }: { ssrLocale: Locale }) {
  // Synchronous one-time store update during first render — before React commits.
  // The store defaults to 'en'; if ssrLocale is 'zh' (from cookie), update
  // immediately so all sibling/child components read 'zh' in the same pass.
  useState(() => {
    syncStoreToSsrLocale(ssrLocale);
    return null;
  });

  useEffect(() => {
    const cleanup = useLocaleStore.getState()._init(ssrLocale);
    return cleanup;
  }, [ssrLocale]);

  return null;
}
