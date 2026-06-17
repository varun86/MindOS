'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, FolderOpen, LayoutGrid, Monitor, Shield } from 'lucide-react';
import { PasswordInput } from '@/components/settings/Primitives';
import type { Messages } from '@/lib/i18n';
import { useLocale } from '@/lib/stores/locale-store';
import type { PortStatus, SetupState, SpaceKitId } from './types';
import { SPACE_KITS } from './constants';
import { PortField } from './StepPorts';

interface MindosDesktopBridge {
  selectDirectory?: () => Promise<string | null>;
}

function getDesktopBridge(): MindosDesktopBridge | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { mindos?: MindosDesktopBridge };
  return w.mindos ?? null;
}

function getParentDir(p: string): string {
  if (!p.trim()) return '';
  const trimmed = p.trim();
  if (trimmed.endsWith('/') || trimmed.endsWith('\\')) return trimmed;
  const lastSlash = Math.max(trimmed.lastIndexOf('/'), trimmed.lastIndexOf('\\'));
  return lastSlash >= 0 ? trimmed.slice(0, lastSlash + 1) : '';
}

function buildDocumentsMindPath(homeDir: string, platformName: string, fallback: string): string {
  if (homeDir === '~') return fallback;
  const sep = homeDir.includes('\\') || platformName === 'win32' ? '\\' : '/';
  return [homeDir, 'Documents', 'MindOS', 'mind'].join(sep);
}

function SectionHeading({ id, icon, title, desc }: { id: string; icon: ReactNode; title: string; desc?: string }) {
  return (
    <div>
      <h3 id={id} className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground">
        <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--amber)]">
          {icon}
        </span>
        {title}
      </h3>
      {desc && <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{desc}</p>}
    </div>
  );
}

function InlineIconLabel({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center text-[var(--amber)]">
        {icon}
      </span>
      {children}
    </span>
  );
}

export interface StepMindSpaceProps {
  state: SetupState;
  update: <K extends keyof SetupState>(key: K, val: SetupState[K]) => void;
  t: Messages;
  homeDir: string;
  platformName: string;
  webPortStatus: PortStatus;
  setWebPortStatus: (s: PortStatus) => void;
  checkPort: (port: number, which: 'web' | 'mcp') => void;
}

export default function StepMindSpace({ state, update, t, homeDir, platformName, webPortStatus, setWebPortStatus, checkPort }: StepMindSpaceProps) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  const s = t.setup;
  const [pathInfo, setPathInfo] = useState<{ exists: boolean; empty: boolean; count: number; unsafe?: boolean; reason?: string; reasonZh?: string } | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [activeSuggestion, setActiveSuggestion] = useState(-1);
  const [canBrowseDirectory, setCanBrowseDirectory] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const justSelectedRef = useRef(false);

  const placeholder = buildDocumentsMindPath(homeDir, platformName, s.kbPathDefault);

  useEffect(() => {
    setCanBrowseDirectory(!!getDesktopBridge()?.selectDirectory);
  }, []);

  useEffect(() => {
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
        })
        .catch(e => { console.warn('[SetupWizard] check-path failed:', e); setPathInfo(null); });
    }, 600);
    return () => clearTimeout(timer);
  }, [state.mindRoot, update]);

  const selected = new Set(state.spaceKits);
  const toggleKit = (id: SpaceKitId) => {
    const next = selected.has(id)
      ? state.spaceKits.filter(item => item !== id)
      : [...state.spaceKits, id];
    update('spaceKits', next);
  };

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

  const browseDirectory = async () => {
    const selectedDir = await getDesktopBridge()?.selectDirectory?.();
    if (selectedDir) {
      justSelectedRef.current = true;
      update('mindRoot', selectedDir);
      hideSuggestions();
      inputRef.current?.focus();
    }
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
      <section className="space-y-3.5" aria-labelledby="space-kit-title">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading
            id="space-kit-title"
            icon={<LayoutGrid size={13} />}
            title={s.spaceKitTitle}
            desc={s.spaceKitDesc}
          />
          <span className="shrink-0 rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs text-muted-foreground">
            {s.spaceKitCount(state.spaceKits.length)}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {SPACE_KITS.map((kit) => {
            const isSelected = selected.has(kit.id);
            const label = s.spaceKitLabels[kit.id];
            const desc = s.spaceKitDescriptions[kit.id];
            return (
              <button
                key={kit.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleKit(kit.id)}
                className="group relative grid min-h-[5rem] grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 rounded-lg border px-3 py-2.5 text-left transition-[background-color,border-color] duration-150 hover:border-[var(--amber)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[4.5rem]"
                style={{
                  background: isSelected
                    ? 'color-mix(in srgb, var(--amber) 9%, var(--card))'
                    : 'color-mix(in srgb, var(--card) 86%, transparent)',
                  borderColor: isSelected ? 'var(--amber)' : 'var(--border)',
                }}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md border transition-colors duration-150"
                  style={{
                    background: isSelected ? 'color-mix(in srgb, var(--amber) 10%, var(--muted))' : 'var(--muted)',
                    color: isSelected ? 'var(--amber)' : 'var(--muted-foreground)',
                    borderColor: 'transparent',
                  }}>
                  {kit.icon}
                </span>
                <span className="min-w-0 pr-5 sm:pr-4">
                  <span className="block truncate text-sm font-semibold leading-5 text-foreground">{label}</span>
                  <span className="mt-0.5 block truncate whitespace-nowrap text-xs leading-4 text-muted-foreground" title={desc}>{desc}</span>
                </span>
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/75 transition-opacity duration-150">
                  <CheckCircle2 size={14} className={isSelected ? 'opacity-100' : 'opacity-0'} style={{ color: 'var(--amber)' }} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="space-y-3" aria-labelledby="mind-location-title">
        <SectionHeading
          id="mind-location-title"
          icon={<FolderOpen size={13} />}
          title={s.mindLocationTitle}
          desc={s.mindLocationDesc}
        />

        <div className="space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              value={state.mindRoot}
              onChange={e => { update('mindRoot', e.target.value); setShowSuggestions(true); }}
              onKeyDown={handleKeyDown}
              onBlur={() => setTimeout(() => hideSuggestions(), 150)}
              onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
              placeholder={placeholder}
              aria-label={s.kbPath}
              className="w-full rounded-lg border bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring"
              style={{ borderColor: pathInfo?.unsafe ? 'var(--error)' : 'var(--border)' }}
            />
            <button
              type="button"
              onClick={browseDirectory}
              disabled={!canBrowseDirectory}
              className="absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-muted-foreground"
              title={canBrowseDirectory ? s.kbPathBrowse : s.kbPathBrowseUnavailable}
              aria-label={s.kbPathBrowse}
            >
              <FolderOpen size={16} />
            </button>

            {showSuggestions && suggestions.length > 0 && (
              <div
                role="listbox"
                className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[220px] overflow-auto rounded-lg border border-border bg-card shadow-lg"
              >
                {suggestions.map((suggestion, i) => (
                  <button
                    key={suggestion}
                    type="button"
                    role="option"
                    aria-selected={i === activeSuggestion}
                    onMouseDown={() => selectSuggestion(suggestion)}
                    className="w-full px-3 py-2 text-left font-mono text-sm text-foreground transition-colors"
                    style={{
                      background: i === activeSuggestion ? 'var(--muted)' : 'transparent',
                      borderTop: i > 0 ? '1px solid var(--border)' : undefined,
                    }}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            )}
          </div>
          {state.mindRoot !== placeholder && placeholder !== s.kbPathDefault && (
            <button
              type="button"
              onClick={() => update('mindRoot', placeholder)}
              className="mt-1.5 rounded-md border px-2.5 py-1 text-xs transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              style={{ borderColor: 'var(--amber)', color: 'var(--amber)' }}
            >
              {s.kbPathUseDefault(placeholder)}
            </button>
          )}

          {pathInfo?.unsafe && (
            <div className="mt-3 flex items-start gap-2 rounded-lg border p-3 text-sm"
              style={{ borderColor: 'var(--error)', background: 'color-mix(in srgb, var(--error) 8%, transparent)' }}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--error)' }} />
              <div>
                <p className="font-medium" style={{ color: 'var(--error)' }}>{isZh ? '路径不安全' : 'Unsafe path'}</p>
                <p className="mt-1 text-muted-foreground">{isZh ? pathInfo.reasonZh : pathInfo.reason}</p>
              </div>
            </div>
          )}

          <div className="border-t border-border/70 pt-3">
            <button
              type="button"
              onClick={() => setAdvancedOpen(open => !open)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {advancedOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              {s.advancedMindSettings}
            </button>
            {advancedOpen && (
              <div className="mt-3 space-y-4">
                <PortField
                  label={<InlineIconLabel icon={<Monitor size={13} />}>{s.webPort}</InlineIconLabel>}
                  hint={s.portHint}
                  value={state.webPort}
                  onChange={v => {
                    update('webPort', v);
                    setWebPortStatus({ checking: false, available: null, isSelf: false, suggestion: null });
                  }}
                  status={webPortStatus}
                  onCheckPort={port => checkPort(port, 'web')}
                  s={s}
                />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground">
                    <InlineIconLabel icon={<Shield size={13} />}>{s.webPassword}</InlineIconLabel>
                  </label>
                  <p className="text-xs text-muted-foreground">{s.webPasswordHint}</p>
                  <PasswordInput
                    value={state.webPassword}
                    onChange={v => update('webPassword', v)}
                    placeholder={isZh ? '留空则不设置' : 'Leave blank to skip'}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
