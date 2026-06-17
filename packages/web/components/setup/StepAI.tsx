'use client';

import { useState, useEffect, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { AlertTriangle, Bot, ChevronDown, ChevronRight, Copy, Cpu, ExternalLink, HelpCircle, Info, Key } from 'lucide-react';
import { Field, Input, PasswordInput } from '@/components/settings/Primitives';
import type { AgentEntry, AgentInstallStatus, ConnectionMode, McpMessages, SetupState, SetupProvider, SetupMessages, PortStatus } from './types';
import { PROVIDER_PRESETS, getApiKeyEnvVar, getDefaultBaseUrl } from '@/lib/agent/providers';
import ProviderSelect from '@/components/shared/ProviderSelect';
import ModelInput from '@/components/shared/ModelInput';
import StepPorts from './StepPorts';
import StepAgents from './StepAgents';
import { useLocale } from '@/lib/stores/locale-store';
import { resolveAiProviderSelection } from '@/lib/ai-provider-settings';
import { cn } from '@/lib/utils';
import { setupNoticeClass, setupOutlineButtonClass } from './setupStyles';

export interface StepAIProps {
  state: SetupState;
  update: <K extends keyof SetupState>(key: K, val: SetupState[K]) => void;
  s: SetupMessages;
  onCopyToken: () => void;
  webPortStatus: PortStatus;
  mcpPortStatus: PortStatus;
  setWebPortStatus: (s: PortStatus) => void;
  setMcpPortStatus: (s: PortStatus) => void;
  checkPort: (port: number, which: 'web' | 'mcp') => void;
  portConflict: boolean;
  agents: AgentEntry[];
  agentsLoading: boolean;
  selectedAgents: Set<string>;
  setSelectedAgents: Dispatch<SetStateAction<Set<string>>>;
  connectionMode: ConnectionMode;
  setConnectionMode: Dispatch<SetStateAction<ConnectionMode>>;
  agentTransport: 'auto' | 'stdio' | 'http';
  setAgentTransport: (v: 'auto' | 'stdio' | 'http') => void;
  agentScope: 'global' | 'project';
  setAgentScope: (v: 'global' | 'project') => void;
  agentStatuses: Record<string, AgentInstallStatus>;
  settingsMcp: McpMessages;
}

export default function StepAI({
  state, update, s, onCopyToken, webPortStatus, mcpPortStatus, setWebPortStatus, setMcpPortStatus, checkPort, portConflict,
  agents, agentsLoading, selectedAgents, setSelectedAgents, connectionMode, setConnectionMode,
  agentTransport, setAgentTransport, agentScope, setAgentScope, agentStatuses, settingsMcp,
}: StepAIProps) {
  const { locale } = useLocale();
  const [portsOpen, setPortsOpen] = useState(false);

  // Only auto-open Advanced if there's an unresolved port issue the user needs to see
  useEffect(() => {
    if (!portsOpen && portConflict) {
      setPortsOpen(true);
    }
  }, [portConflict, portsOpen]);

  // ── Current provider from unified Provider[] ──
  const isSkip = state.activeProvider === 'skip';
  const current = !isSkip ? state.providers.find(p => p.id === state.activeProvider) : null;
  const currentPreset = current ? PROVIDER_PRESETS[current.protocol] : null;

  // ── Patch a field on the current provider ──
  const patchProvider = useCallback((patch: Partial<SetupProvider>) => {
    if (!current) return;
    update('providers', state.providers.map(p =>
      p.id === current.id ? { ...p, ...patch } : p
    ));
  }, [current, state.providers, update]);

  // ── Handle provider selection from ProviderSelect ──
  // When user picks a protocol (e.g. "anthropic"), resolve it to a provider entry.
  const handleSelectProvider = useCallback((selectedId: string) => {
    if (selectedId === 'skip') {
      update('activeProvider', 'skip');
      return;
    }

    const next = resolveAiProviderSelection({
      activeProvider: state.activeProvider,
      providers: state.providers,
    }, selectedId, locale);
    update('providers', next.providers as SetupProvider[]);
    update('activeProvider', next.activeProvider);
  }, [state.activeProvider, state.providers, update, locale]);

  // ── Build configuredProviders set for the ProviderSelect UI ──
  // Shows green checkmark for providers that have been configured (have apiKey or apiKeyMask or fallback)
  const configuredProviders = new Set(
    state.providers
      .filter(p => p.apiKey || p.apiKeyMask || PROVIDER_PRESETS[p.protocol]?.apiKeyFallback)
      .map(p => p.protocol),
  );

  // ── Map activeProvider ID to protocol ID for ProviderSelect value ──
  // ProviderSelect expects a ProviderId string or 'skip'
  const selectValue = isSkip ? 'skip' : (current?.protocol ?? 'skip');

  return (
    <div className="space-y-5">
      <div className="space-y-3">
        <div className="inline-flex items-center gap-1.5">
          <Cpu size={14} className="text-[var(--amber)]" />
          <h3 className="text-sm font-semibold text-foreground">{s.aiModelTitle}</h3>
        </div>

        <ProviderSelect
          value={selectValue}
          onChange={handleSelectProvider}
          showSkip
          compact
          configuredProviders={configuredProviders}
        />
        {isSkip && (
          <div
            className={setupNoticeClass('error', 'flex items-start gap-2 px-3 py-2.5')}
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" />
            <span>{s.aiSkipWarning}</span>
          </div>
        )}
      </div>

      {current && currentPreset && (
        <div className="space-y-4 pt-2">
          {/* API Key */}
          <Field label={s.apiKey}>
            <PasswordInput
              value={current.apiKey}
              onChange={v => patchProvider({ apiKey: v })}
              placeholder={current.apiKeyMask || `${getApiKeyEnvVar(current.protocol) ?? 'API Key'}...`}
            />
            {current.apiKeyMask && !current.apiKey && (
              <p className="mt-1 text-xs text-muted-foreground">
                {s.apiKeyExisting ?? 'Existing key configured. Leave blank to keep it.'}
              </p>
            )}
            {currentPreset.signupUrl && !current.apiKey && !current.apiKeyMask && (
              <a
                href={currentPreset.signupUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 inline-flex items-center gap-1 text-xs text-[var(--amber)] hover:underline"
              >
                <ExternalLink size={10} />
                {currentPreset.apiKeyFallback
                  ? (locale === 'zh' ? `下载 ${currentPreset.nameZh}` : `Download ${currentPreset.name}`)
                  : (locale === 'zh' ? `获取 ${currentPreset.nameZh} API Key` : `Get ${currentPreset.name} API Key`)}
              </a>
            )}
          </Field>

          {/* Base URL — before Model so defaults are correct when listing models */}
          {currentPreset.supportsBaseUrl && (
            <Field label={s.baseUrl} hint={s.baseUrlHint}>
              <Input
                value={current.baseUrl ?? ''}
                onChange={e => patchProvider({ baseUrl: e.target.value })}
                placeholder={currentPreset.fixedBaseUrl || getDefaultBaseUrl(current.protocol) || 'https://api.openai.com/v1'}
              />
            </Field>
          )}

          {/* Model */}
          <Field label={s.model}>
            <ModelInput
              value={current.model}
              onChange={v => patchProvider({ model: v })}
              placeholder={currentPreset.defaultModel}
              provider={current.protocol}
              apiKey={current.apiKey}
              baseUrl={current.baseUrl}
              supportsListModels={currentPreset.supportsListModels}
              browseLabel={s.listModels}
              noModelsLabel={s.noModelsFound}
            />
          </Field>
        </div>
      )}

      <div className="border-t border-border/70 pt-4">
        <div className="mb-3 inline-flex items-center gap-1.5">
          <Bot size={14} className="text-[var(--amber)]" />
          <h3 className="text-sm font-semibold text-foreground">{s.agentToolsTitle}</h3>
          <span className="group relative inline-flex">
            <button
              type="button"
              aria-label={s.agentConnectionHelpLabel}
              className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[var(--amber)] transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <HelpCircle size={13} />
            </button>
            <span className="pointer-events-none absolute right-0 top-full z-20 mt-2 hidden w-72 rounded-lg border border-border bg-card p-3 text-xs leading-relaxed text-muted-foreground shadow-lg group-hover:block group-focus-within:block sm:left-1/2 sm:right-auto sm:-translate-x-1/2">
              {s.agentConnectionHelp}
            </span>
          </span>
        </div>
        <StepAgents
          compact
          agents={agents}
          agentsLoading={agentsLoading}
          selectedAgents={selectedAgents}
          setSelectedAgents={setSelectedAgents}
          connectionMode={connectionMode}
          setConnectionMode={setConnectionMode}
          agentTransport={agentTransport}
          setAgentTransport={setAgentTransport}
          agentScope={agentScope}
          setAgentScope={setAgentScope}
          agentStatuses={agentStatuses}
          s={s}
          settingsMcp={settingsMcp}
        />
      </div>

      {/* Advanced: Port Settings */}
      <div className="mt-1 border-t border-border pt-3">
        <button
          type="button"
          onClick={() => setPortsOpen(!portsOpen)}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {portsOpen ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          {s.advancedPorts}
        </button>
        {portsOpen && (
          <div className="mt-3 space-y-5">
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="inline-flex items-center gap-1.5 text-sm font-medium text-foreground">
                  <Key size={13} className="text-[var(--amber)]" />
                  {s.tokenSectionTitle}
                </p>
                <span className="inline-flex items-center gap-1 rounded-md border border-border/70 px-1.5 py-0.5 text-2xs text-muted-foreground">
                  <Info size={10} />
                  {s.tokenSectionAuto}
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                {s.tokenSectionHint}
              </p>
              <div className="flex items-center gap-2">
                <code
                  className={cn(
                    'flex-1 truncate rounded-lg bg-muted px-3 py-2 font-mono text-xs',
                    state.authToken ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
                  {state.authToken || s.tokenSectionGenerating}
                </code>
                <button type="button" onClick={onCopyToken} disabled={!state.authToken}
                  className={setupOutlineButtonClass('neutral', 'flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-2 text-foreground disabled:hover:bg-transparent')}>
                  <Copy size={12} /> {s.copyToken}
                </button>
              </div>
            </div>

            <StepPorts
              state={state} update={update}
              webPortStatus={webPortStatus} mcpPortStatus={mcpPortStatus}
              setWebPortStatus={setWebPortStatus} setMcpPortStatus={setMcpPortStatus}
              checkPort={checkPort} portConflict={portConflict} s={s}
              showWeb={false}
            />
          </div>
        )}
      </div>
    </div>
  );
}
