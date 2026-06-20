'use client';

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { AlertCircle, CheckCircle2, ChevronDown, ChevronRight, FolderOpen, LayoutGrid, Monitor, Shield } from 'lucide-react';
import { PasswordInput } from '@/components/settings/Primitives';
import PathAutocompleteField from '@/components/shared/PathAutocompleteField';
import type { Messages } from '@/lib/i18n';
import { useLocale } from '@/lib/stores/locale-store';
import type { PortStatus, SetupState, InitialSpaceId } from './types';
import { INITIAL_SPACES } from './constants';
import { PortField } from './StepPorts';
import { cn } from '@/lib/utils';
import { setupChoiceCardClass, setupNoticeClass, setupOutlineButtonClass } from './setupStyles';

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

type PathInfo = {
  exists: boolean;
  empty: boolean;
  count: number;
  unsafe?: boolean;
  reason?: string;
  reasonZh?: string;
};

export default function StepMindSpace({ state, update, t, homeDir, platformName, webPortStatus, setWebPortStatus, checkPort }: StepMindSpaceProps) {
  const { locale } = useLocale();
  const isZh = locale === 'zh';
  const s = t.setup;
  const currentMindRoot = state.mindRoot.trim();
  const [pathInfoResult, setPathInfoResult] = useState<{ path: string; info: PathInfo } | null>(null);
  const pathInfo = pathInfoResult?.path === currentMindRoot ? pathInfoResult.info : null;
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const placeholder = buildDocumentsMindPath(homeDir, platformName, s.kbPathDefault);

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
  }, [currentMindRoot]);

  const selected = new Set(state.initialSpaces);
  const toggleSpace = (id: InitialSpaceId) => {
    const next = selected.has(id)
      ? state.initialSpaces.filter(item => item !== id)
      : [...state.initialSpaces, id];
    update('initialSpaces', next);
  };

  return (
    <div className="space-y-6">
      <section className="space-y-3" aria-labelledby="mind-location-title">
        <SectionHeading
          id="mind-location-title"
          icon={<FolderOpen size={13} />}
          title={s.mindLocationTitle}
          desc={s.mindLocationDesc}
        />

        <div className="space-y-3">
          <PathAutocompleteField
            value={state.mindRoot}
            onChange={(value) => update('mindRoot', value)}
            homeDir={homeDir}
            placeholder={placeholder}
            ariaLabel={s.kbPath}
            browseLabel={s.kbPathBrowse}
            browseUnavailableLabel={s.kbPathBrowseUnavailable}
            inputClassName={cn(
              'w-full rounded-lg border bg-background px-3 py-2 pr-11 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-ring',
              pathInfo?.unsafe ? 'border-error' : 'border-border',
            )}
          />
          {state.mindRoot !== placeholder && placeholder !== s.kbPathDefault && (
            <button
              type="button"
              onClick={() => update('mindRoot', placeholder)}
              className={setupOutlineButtonClass('amber', 'mt-1.5')}
            >
              {s.kbPathUseDefault(placeholder)}
            </button>
          )}

          {pathInfo?.unsafe && (
            <div className={setupNoticeClass('error', 'mt-3 flex items-start gap-2 p-3 text-sm')}>
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-medium">{isZh ? '路径不安全' : 'Unsafe path'}</p>
                <p className="mt-1 text-muted-foreground">{isZh ? pathInfo.reasonZh : pathInfo.reason}</p>
              </div>
            </div>
          )}
        </div>
      </section>

      <section className="space-y-3.5" aria-labelledby="initial-spaces-title">
        <div className="flex items-start justify-between gap-3">
          <SectionHeading
            id="initial-spaces-title"
            icon={<LayoutGrid size={13} />}
            title={s.initialSpaceTitle}
            desc={s.initialSpaceDesc}
          />
          <span className="shrink-0 rounded-md border border-border/70 bg-card/70 px-2 py-1 text-xs text-muted-foreground">
            {s.initialSpaceCount(state.initialSpaces.length)}
          </span>
        </div>
        <p className="rounded-md border border-border/60 bg-muted/35 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
          {s.builtinMindSystemHint}
        </p>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {INITIAL_SPACES.map((space) => {
            const isSelected = selected.has(space.id);
            const label = s.initialSpaceLabels[space.id];
            const desc = s.initialSpaceDescriptions[space.id];
            return (
              <button
                key={space.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => toggleSpace(space.id)}
                className={setupChoiceCardClass(isSelected, 'group relative grid min-h-[5rem] grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 rounded-lg px-3 py-2.5 text-left duration-150 hover:border-[var(--amber)]/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[4.5rem]')}
              >
                <span
                  className={cn(
                    'flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-transparent transition-colors duration-150',
                    isSelected ? 'bg-[var(--amber-subtle)] text-[var(--amber)]' : 'bg-muted text-muted-foreground',
                  )}
                >
                  {space.icon}
                </span>
                <span className="min-w-0 pr-5 sm:pr-4">
                  <span className="block truncate text-sm font-semibold leading-5 text-foreground">{label}</span>
                  <span className="mt-0.5 block truncate whitespace-nowrap text-xs leading-4 text-muted-foreground" title={desc}>{desc}</span>
                </span>
                <span className="absolute right-2.5 top-2.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-background/75 transition-opacity duration-150">
                  <CheckCircle2 size={14} className={cn('text-[var(--amber)]', isSelected ? 'opacity-100' : 'opacity-0')} />
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="border-t border-border/70 pt-3" aria-label={s.advancedMindSettings}>
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
      </section>
    </div>
  );
}
