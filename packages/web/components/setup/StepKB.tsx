'use client';

import { useState, useEffect, useRef } from 'react';
import { AlertCircle, FolderOpen } from 'lucide-react';
import { Field } from '@/components/settings/Primitives';
import type { Messages } from '@/lib/i18n';
import { useLocale } from '@/lib/stores/locale-store';
import type { SetupState } from './types';
import { TEMPLATES } from './constants';
import { cn } from '@/lib/utils';
import { setupChoiceCardClass, setupNoticeClass, setupOutlineButtonClass } from './setupStyles';

// Desktop bridge for folder picker (Electron only)
interface MindosDesktopBridge {
  selectDirectory?: () => Promise<string | null>;
}
function getDesktopBridge(): MindosDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { mindos?: MindosDesktopBridge };
  return w.mindos ?? null;
}

// Derive parent dir from current input for ls — supports both / and \ separators
function getParentDir(p: string): string {
  if (!p.trim()) return '';
  const trimmed = p.trim();
  // Already a directory (ends with separator)
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) return trimmed;
  // Find last separator (/ or \)
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : '';
}

export interface StepKBProps {
  state: SetupState;
  update: <K extends keyof SetupState>(key: K, val: SetupState[K]) => void;
  t: Messages;
  homeDir: string;
}

export default function StepKB({ state, update, t, homeDir }: StepKBProps) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  const s = t.setup;
  const [passwordTouched, setPasswordTouched] = useState(false);
  // Build platform-aware placeholder, e.g. /Users/alice/MindOS/mind or C:\Users\alice\MindOS\mind
  // Windows homedir always contains \, e.g. C:\Users\Alice — safe to detect by separator
  const sep = homeDir.includes('\\') ? '\\' : '/';
  const placeholder = homeDir !== '~' ? [homeDir, 'MindOS', 'mind'].join(sep) : s.kbPathDefault;
  const [pathInfo, setPathInfo] = useState<{ exists: boolean; empty: boolean; count: number; unsafe?: boolean; reason?: string; reasonZh?: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [showTemplatePickerAnyway, setShowTemplatePickerAnyway] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

  // Debounced autocomplete
  useEffect(() => {
    // Skip when a suggestion was just selected — prevents dropdown flicker
    if (justSelectedRef.current) { justSelectedRef.current = false; return; }
    if (!state.mindRoot.trim()) { setSuggestions([]); return; }
    const timer = setTimeout(() => {
      const parent = getParentDir(state.mindRoot) || homeDir;
      fetch('/api/setup/ls', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: parent }),
      })
        .then(r => r.json())
        .then(d => {
          if (!d.dirs?.length) { setSuggestions([]); return; }
          // Normalize parent to end with a separator (preserve existing / or \)
          const endsWithSep = parent.endsWith('/') || parent.endsWith('\\');
          const localSep = parent.includes('\\') ? '\\' : '/';
          const parentNorm = endsWithSep ? parent : parent + localSep;
          const typed = state.mindRoot.trim();
          const full: string[] = (d.dirs as string[]).map((dir: string) => parentNorm + dir);
          const endsWithAnySep = typed.endsWith('/') || typed.endsWith('\\');
          const filtered = endsWithAnySep ? full : full.filter(f => f.startsWith(typed));
          setSuggestions(filtered.slice(0, 20));
          setShowSuggestions(filtered.length > 0);
          setActiveSuggestion(-1);
        })
        .catch(e => { console.warn('[SetupWizard] autocomplete fetch failed:', e); setSuggestions([]); });
    }, 300);
    return () => clearTimeout(timer);
  }, [state.mindRoot, homeDir]);

  // Debounced path check
  useEffect(() => {
    if (!state.mindRoot.trim()) { setPathInfo(null); return; }
    const timer = setTimeout(() => {
      fetch('/api/setup/check-path', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: state.mindRoot }),
      })
        .then(r => r.json())
        .then(d => {
          setPathInfo(d);
          setShowTemplatePickerAnyway(false);
          // Non-empty directory: default to skip template (user can opt-in to merge)
          if (d?.exists && !d.empty) update('template', '');
        })
        .catch(e => { console.warn('[SetupWizard] check-path failed:', e); setPathInfo(null); });
    }, 600);
    return () => clearTimeout(timer);
  }, [state.mindRoot, update]);

  const hideSuggestions = () => {
    setSuggestions([]);
    setShowSuggestions(false);
    setActiveSuggestion(-1);
  };

  const selectSuggestion = (val: string) => {
    justSelectedRef.current = true;
    update('mindRoot', val);
    hideSuggestions();
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggestion(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggestion(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeSuggestion >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[activeSuggestion]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div className="space-y-6">
      <Field label={s.kbPath} hint={s.kbPathHint}>
        <div className="relative">
          <div className="flex gap-2">
            <input
              ref={inputRef}
              value={state.mindRoot}
              onChange={e => { update('mindRoot', e.target.value); setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => hideSuggestions(), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={placeholder}
              className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus-visible:ring-1 focus-visible:ring-ring"
            />
            {/* Folder picker button — Desktop (Electron) only */}
            {getDesktopBridge()?.selectDirectory && (
              <button
                type="button"
                onClick={async () => {
                  const selected = await getDesktopBridge()?.selectDirectory?.();
                  if (selected) {
                    justSelectedRef.current = true;
                    update('mindRoot', selected);
                    hideSuggestions();
                  }
                }}
                className="rounded-lg border border-border px-3 py-2 text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                title={s.kbPathBrowse ?? 'Browse...'}
              >
                <FolderOpen size={16} />
              </button>
            )}
          </div>
          {showSuggestions && suggestions.length > 0 && (
            <div
              role="listbox"
              className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[220px] overflow-auto rounded-lg border border-border bg-card shadow-lg">
              {suggestions.map((suggestion, i) => (
                <button
                  key={suggestion}
                  type="button"
                  role="option"
                  aria-selected={i === activeSuggestion}
                  onMouseDown={() => selectSuggestion(suggestion)}
                  className={cn(
                    'w-full px-3 py-2 text-left font-mono text-sm text-foreground transition-colors',
                    i === activeSuggestion ? 'bg-muted' : 'bg-transparent',
                    i > 0 && 'border-t border-border',
                  )}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}
        </div>
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
