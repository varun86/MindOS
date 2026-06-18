'use client';

import { useState, useEffect } from 'react';
import { AlertCircle } from 'lucide-react';
import { Field } from '@/components/settings/Primitives';
import PathAutocompleteField from '@/components/shared/PathAutocompleteField';
import type { Messages } from '@/lib/i18n';
import { useLocale } from '@/lib/stores/locale-store';
import type { SetupState } from './types';
import { TEMPLATES } from './constants';
import { cn } from '@/lib/utils';
import { setupChoiceCardClass, setupNoticeClass, setupOutlineButtonClass } from './setupStyles';

export interface StepKBProps {
  state: SetupState;
  update: <K extends keyof SetupState>(key: K, val: SetupState[K]) => void;
  t: Messages;
  homeDir: string;
}

type PathInfo = {
  exists: boolean;
  empty: boolean;
  count: number;
  unsafe?: boolean;
  reason?: string;
  reasonZh?: string;
};

export default function StepKB({ state, update, t, homeDir }: StepKBProps) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  const s = t.setup;
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Build platform-aware placeholder, e.g. /Users/alice/MindOS/mind or C:\Users\alice\MindOS\mind
  // Windows homedir always contains \, e.g. C:\Users\Alice — safe to detect by separator
  const sep = homeDir.includes('\\') ? '\\' : '/';
  const placeholder = homeDir !== '~' ? [homeDir, 'MindOS', 'mind'].join(sep) : s.kbPathDefault;
  const currentMindRoot = state.mindRoot.trim();
  const [pathInfoResult, setPathInfoResult] = useState<{ path: string; info: PathInfo } | null>(null);
  const pathInfo = pathInfoResult?.path === currentMindRoot ? pathInfoResult.info : null;
  const [showTemplatePickerAnyway, setShowTemplatePickerAnyway] = useState(false);

  // Debounced path check
  useEffect(() => {
    if (!currentMindRoot) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      fetch('/api/setup/check-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: currentMindRoot }),
      })
        .then(r => r.json())
        .then(d => {
          if (cancelled) return;
          setPathInfoResult({ path: currentMindRoot, info: d });
          setShowTemplatePickerAnyway(false);
          // Non-empty directory: default to skip template (user can opt-in to merge)
          if (d?.exists && !d.empty) update('template', '');
        })
        .catch(e => {
          if (cancelled) return;
          console.warn('[SetupWizard] check-path failed:', e);
          setPathInfoResult(null);
        });
    }, 600);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [currentMindRoot, update]);

  return (
    <div className="space-y-6">
      <Field label={s.kbPath} hint={s.kbPathHint}>
        <PathAutocompleteField
          value={state.mindRoot}
          onChange={(value) => update('mindRoot', value)}
          homeDir={homeDir}
          placeholder={placeholder}
          ariaLabel={s.kbPath}
          browseLabel={s.kbPathBrowse}
          browseUnavailableLabel={s.kbPathBrowseUnavailable}
          inputClassName="w-full rounded-lg border border-border bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
        />
        {/* Recommended default — one-click accept */}
        {state.mindRoot !== placeholder && placeholder !== s.kbPathDefault && (
          <button type="button"
            onClick={() => update('mindRoot', placeholder)}
            className={setupOutlineButtonClass('amber', 'mt-1.5')}>
            {s.kbPathUseDefault(placeholder)}
          </button>
        )}
        {/* ⚠️ Unsafe path warning — blocks setup until user picks a safe path */}
        {pathInfo?.unsafe && (
          <div className={setupNoticeClass('error', 'mt-3 flex items-start gap-2 p-3 text-sm')}>
            <AlertCircle size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="font-medium">
                {isZh ? '路径不安全' : 'Unsafe Path'}
              </p>
              <p className="mt-1 text-muted-foreground">
                {isZh ? pathInfo.reasonZh : pathInfo.reason}
              </p>
            </div>
          </div>
        )}
      </Field>
      {/* Template selection — conditional on directory state */}
      {pathInfo && pathInfo.exists && !pathInfo.empty && !showTemplatePickerAnyway ? (
        <div>
          <label className="text-sm text-foreground font-medium mb-3 block">{s.template}</label>
          <div className={setupNoticeClass('amber', 'p-3 text-sm')}>
            <p>
              {s.kbPathHasFiles(pathInfo.count)}
            </p>
            <div className="flex gap-2 mt-2">
              <button type="button"
                onClick={() => update('template', '')}
                className={cn(
                  setupOutlineButtonClass('amber'),
                  state.template === '' && 'bg-[var(--amber)] text-[var(--amber-foreground)] hover:bg-[var(--amber)]/90',
                )}
              >
                {state.template === '' ? <>{s.kbTemplateSkip} ✓</> : s.kbTemplateSkip}
              </button>
              <button type="button"
                onClick={() => setShowTemplatePickerAnyway(true)}
                className={setupOutlineButtonClass('neutral')}>
                {s.kbTemplateMerge}
              </button>
            </div>
          </div>
        </div>
      ) : (
      <div>
        <label className="text-sm text-foreground font-medium mb-3 block">{s.template}</label>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {TEMPLATES.map(tpl => (
            <button key={tpl.id} onClick={() => update('template', tpl.id)}
              className={setupChoiceCardClass(state.template === tpl.id, 'flex flex-col items-start gap-2 rounded-xl p-4 text-left duration-150')}>
              <div className="flex items-center gap-2">
                <span className="text-[var(--amber)]">{tpl.icon}</span>
                <span className="text-sm font-medium text-foreground">
                  {t.onboarding.templates[tpl.id as 'en' | 'zh' | 'empty'].title}
                </span>
              </div>
              <div className="w-full rounded-lg bg-muted px-2.5 py-1.5 font-display text-xs leading-relaxed text-muted-foreground">
                {tpl.dirs.map(d => <div key={d}>{d}</div>)}
              </div>
            </button>
          ))}
        </div>
      </div>
      )}

      {/* ── Security ── */}
      <div className="mt-2 border-t border-border pt-2">
        <Field label={<>{s.webPassword} <span className="text-error">*</span></>} hint={s.webPasswordHint}>
          <input
            type="password"
            value={state.webPassword}
            onChange={e => { update('webPassword', e.target.value); setPasswordTouched(true); }}
            onBlur={() => setPasswordTouched(true)}
            placeholder="••••••••"
            className={cn(
              'w-full rounded-lg border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring',
              passwordTouched && !state.webPassword.trim() ? 'border-error' : 'border-border',
            )}
          />
          {passwordTouched && !state.webPassword.trim() && (
            <p className="mt-1 flex items-center gap-1 text-xs text-error">
              <AlertCircle size={11} /> {s.webPasswordRequired}
            </p>
          )}
        </Field>
      </div>
    </div>
  );
}
