'use client';

import { X } from 'lucide-react';
import type { AiTabProps } from '../types';
import { useLocale } from '@/lib/stores/locale-store';
import { type Provider } from '@/lib/custom-endpoints';
import { useCustomProviderForm } from '../useCustomProviderForm';
import CustomProviderFields from '../CustomProviderFields';
import { TestButton } from '../TestButton';

export function CustomProviderForm({
  onSave, onCancel, t, existingNames,
}: {
  onSave: (provider: Provider) => void;
  onCancel: () => void;
  t: AiTabProps['t'];
  existingNames: string[];
}) {
  const { locale } = useLocale();
  const form = useCustomProviderForm({ onSave, locale, existingNames });
  const formTitle = locale === 'zh' ? '添加 Provider' : 'Add Provider';

  const missingFields: string[] = [];
  if (!form.model.trim()) missingFields.push(locale === 'zh' ? '模型' : 'Model');

  return (
    <div className="mt-3 rounded-lg border border-border overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border">
        <span className="text-sm font-medium text-foreground">{formTitle}</span>
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label={locale === 'zh' ? '关闭' : 'Close'}
        >
          <X size={14} />
        </button>
      </div>

      <div className="p-4">
        <CustomProviderFields form={form} t={t} locale={locale} />

        <div className="flex items-center gap-2 pt-4">
          <TestButton result={form.testResult} disabled={!form.canSave} onTest={form.handleTest} t={t} />

          <div className="flex-1">
            {form.isDuplicateName && (
              <span className="text-2xs text-destructive pl-2">
                {locale === 'zh' ? '名称已存在' : 'Name already exists'}
              </span>
            )}
            {!form.isDuplicateName && !form.canSave && missingFields.length > 0 && (
              <span className="text-2xs text-muted-foreground/60 pl-2">
                {locale === 'zh' ? `需要: ${missingFields.join('、')}` : `Required: ${missingFields.join(', ')}`}
              </span>
            )}
          </div>

          <button
            type="button"
            onClick={onCancel}
            className="px-3 py-1.5 text-sm rounded-lg text-muted-foreground hover:text-foreground transition-colors"
          >
            {locale === 'zh' ? '取消' : 'Cancel'}
          </button>
          <button
            type="button"
            onClick={form.handleSave}
            disabled={!form.canSave}
            className="px-4 py-1.5 text-sm font-medium rounded-lg bg-[var(--amber)] text-[var(--amber-foreground)] hover:bg-[var(--amber)]/90 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {locale === 'zh' ? '保存' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  );
}
