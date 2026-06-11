'use client';

import { useEffect, useState } from 'react';
import { Monitor } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { Select, SettingCard } from '../Primitives';

export function AskDisplayModeCard() {
  const { t } = useLocale();
  const [mode, setMode] = useState<'panel' | 'popup'>('panel');

  useEffect(() => {
    try {
      const stored = localStorage.getItem('ask-mode');
      if (stored === 'popup') setMode('popup');
    } catch (err) {
      console.warn('[AskDisplayModeCard] localStorage getItem ask-mode failed:', err);
    }
  }, []);

  const handleChange = (value: string) => {
    const next = value as 'panel' | 'popup';
    setMode(next);
    try {
      localStorage.setItem('ask-mode', next);
    } catch (err) {
      console.warn('[AskDisplayModeCard] localStorage setItem ask-mode failed:', err);
    }
    window.dispatchEvent(new StorageEvent('storage', { key: 'ask-mode', newValue: next }));
  };

  return (
    <SettingCard
      icon={<Monitor size={15} />}
      title={t.settings.askDisplayMode?.label ?? 'Display Mode'}
      description={t.settings.askDisplayMode?.hint ?? 'Side panel stays docked on the right. Popup opens a floating dialog.'}
    >
      <Select value={mode} onChange={e => handleChange(e.target.value)}>
        <option value="panel">{t.settings.askDisplayMode?.panel ?? 'Side Panel'}</option>
        <option value="popup">{t.settings.askDisplayMode?.popup ?? 'Popup'}</option>
      </Select>
    </SettingCard>
  );
}
