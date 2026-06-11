'use client';

import { useEffect, useRef, useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { type ProviderId, PROVIDER_PRESETS } from '@/lib/agent/providers';
import { useLocale } from '@/lib/stores/locale-store';
import type { AiTabProps } from '../types';
import type { TestResult } from '../useCustomProviderForm';
import { TestButton } from '../TestButton';

export function ProviderActions({
  provider, result, hasKey, hasEnv, hasConfig, onTest, onReset, onDelete, t,
}: {
  provider: ProviderId;
  result: TestResult;
  hasKey: boolean;
  hasEnv: boolean;
  hasConfig: boolean;
  onTest: () => void;
  onReset?: () => void;
  onDelete?: () => void;
  t: AiTabProps['t'];
}) {
  const [confirmAction, setConfirmAction] = useState<'reset' | 'delete' | null>(null);
  const confirmTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const hasFallback = !!PROVIDER_PRESETS[provider]?.apiKeyFallback;
  const canTest = hasKey || hasEnv || hasFallback;
  const { locale } = useLocale();

  useEffect(() => () => { if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); }, []);

  const startConfirm = (action: 'reset' | 'delete') => {
    if (confirmAction === action) {
      if (action === 'reset') onReset?.(); else onDelete?.();
      setConfirmAction(null);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
    } else {
      setConfirmAction(action);
      if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmAction(null), 3000);
    }
  };

  return (
    <div className="space-y-2 pt-2">
      <div className="flex items-center justify-between">
        <TestButton result={result} disabled={!canTest} onTest={onTest} t={t} />

        <div className="flex items-center gap-1">
          {onReset && hasConfig && (
            <button
              type="button"
              onClick={() => startConfirm('reset')}
              onBlur={() => { if (confirmAction === 'reset') { setConfirmAction(null); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); } }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                confirmAction === 'reset'
                  ? 'bg-destructive/10 text-destructive border border-destructive/25 font-medium'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <RotateCcw size={12} />
              {confirmAction === 'reset'
                ? (locale === 'zh' ? '确认重置？' : 'Confirm?')
                : (locale === 'zh' ? '重置' : 'Reset')}
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={() => startConfirm('delete')}
              onBlur={() => { if (confirmAction === 'delete') { setConfirmAction(null); if (confirmTimerRef.current) clearTimeout(confirmTimerRef.current); } }}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs rounded-lg transition-all duration-200 ${
                confirmAction === 'delete'
                  ? 'bg-destructive/10 text-destructive border border-destructive/25 font-medium'
                  : 'text-muted-foreground/60 hover:text-muted-foreground hover:bg-muted/50'
              }`}
            >
              <Trash2 size={12} />
              {confirmAction === 'delete'
                ? (locale === 'zh' ? '确认删除？' : 'Confirm?')
                : (locale === 'zh' ? '删除' : 'Delete')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
