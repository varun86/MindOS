'use client';

import { useState, useMemo } from 'react';
import {
  Loader2, CheckCircle2, XCircle, Brain, ChevronDown, Terminal, Plug,
} from 'lucide-react';
import { Field, Select } from '@/components/settings/Primitives';
import type { SetupMessages, McpMessages, AgentEntry, AgentInstallStatus, ConnectionMode } from './types';
import { cn } from '@/lib/utils';
import { setupBadgeClass, setupChoiceCardClass, setupNoticeClass, setupOutlineButtonClass } from './setupStyles';

const AGENT_INSTALL_URLS: Record<string, string> = {
  'claude-code': 'https://docs.anthropic.com/en/docs/claude-code/overview',
  'cursor': 'https://www.cursor.com/',
  'windsurf': 'https://codeium.com/windsurf',
  'cline': 'https://github.com/cline/cline',
  'trae': 'https://www.trae.ai/',
  'gemini-cli': 'https://github.com/google-gemini/gemini-cli',
  'kilo-code': 'https://kilo.ai/',
  'warp': 'https://www.warp.dev/',
  'augment': 'https://www.augmentcode.com/',
};

export interface StepAgentsProps {
  agents: AgentEntry[];
  agentsLoading: boolean;
  selectedAgents: Set<string>;
  setSelectedAgents: React.Dispatch<React.SetStateAction<Set<string>>>;
  connectionMode: ConnectionMode;
  setConnectionMode: React.Dispatch<React.SetStateAction<ConnectionMode>>;
  agentTransport: 'auto' | 'stdio' | 'http';
  setAgentTransport: (v: 'auto' | 'stdio' | 'http') => void;
  agentScope: 'global' | 'project';
  setAgentScope: (v: 'global' | 'project') => void;
  agentStatuses: Record<string, AgentInstallStatus>;
  s: SetupMessages;
  settingsMcp: McpMessages;
  compact?: boolean;
}

export default function StepAgents({
  agents, agentsLoading, selectedAgents, setSelectedAgents,
  connectionMode, setConnectionMode,
  agentTransport, setAgentTransport, agentScope, setAgentScope,
  agentStatuses, s, settingsMcp, compact = false,
}: StepAgentsProps) {
  const toggleAgent = (key: string) => {
    const agent = agents.find(a => a.key === key);
    if (!agent?.present) return;
    setSelectedAgents(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  };

  const [showOtherAgents, setShowOtherAgents] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const getEffectiveTransport = (agent: AgentEntry) => {
    if (agentTransport === 'auto') return agent.preferredTransport;
    return agentTransport;
  };

  const getStatusBadge = (key: string, agent: AgentEntry) => {
    const st = agentStatuses[key];
    if (st) {
      if (st.state === 'installing') return (
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Loader2 size={10} className="animate-spin" /> {s.agentInstalling}
        </span>
      );
      if (st.state === 'ok') return (
        <span className={setupBadgeClass('success')}>
          <CheckCircle2 size={10} /> {s.agentStatusOk}
        </span>
      );
      if (st.state === 'error') return (
        <span className={setupBadgeClass('error')}>
          <XCircle size={10} /> {s.agentStatusError}
          {st.message && <span className="ml-1 text-2xs">({st.message})</span>}
        </span>
      );
    }
    if (agent.installed) return (
      <span className={setupBadgeClass('success')}>
        {settingsMcp.installed}
      </span>
    );
    if (agent.present) return (
      <span className={setupBadgeClass('amber')}>
        {s.agentDetected}
      </span>
    );
    const installUrl = AGENT_INSTALL_URLS[key];
    return (
      <span className="flex items-center gap-1.5">
        <span className={setupBadgeClass('muted')}>
          {s.agentNotFound}
        </span>
        {installUrl && (
          <a href={installUrl} target="_blank" rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            className="text-2xs text-[var(--amber)] hover:underline">
            {s.agentGetIt}
          </a>
        )}
      </span>
    );
  };

  const { detected, other } = useMemo(() => ({
    detected: agents.filter(a => a.installed || a.present),
    other: agents.filter(a => !a.installed && !a.present),
  }), [agents]);

  const renderAgentRow = (agent: AgentEntry, i: number) => (
    <label key={agent.key}
      className={cn(
        'flex items-center gap-3 transition-colors',
        compact ? 'px-3 py-2.5' : 'px-4 py-3',
        i % 2 === 0 ? 'bg-card' : 'bg-transparent',
        i > 0 && 'border-t border-border',
        agent.present ? 'cursor-pointer hover:bg-muted/50' : 'cursor-not-allowed opacity-60',
      )}
    >
      <input
        type="checkbox"
        checked={selectedAgents.has(agent.key)}
        onChange={() => toggleAgent(agent.key)}
        className="form-check"
        disabled={!agent.present || agentStatuses[agent.key]?.state === 'installing'}
      />
      <span className="flex-1 text-sm text-foreground">{agent.name}</span>
      {connectionMode.mcp && (
        <span className="rounded bg-muted/70 px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
          {getEffectiveTransport(agent)}
        </span>
      )}
      {getStatusBadge(agent.key, agent)}
    </label>
  );

  return (
    <div className={compact ? 'space-y-3' : 'space-y-5'}>
      {/* Connection Mode Toggle */}
      <div className="space-y-2">
        {!compact && (
          <p className="text-xs font-medium text-muted-foreground">
            {s.connectionModeTitle}
          </p>
        )}
        {compact && (
          <p className="text-xs leading-relaxed text-muted-foreground">
            {s.agentRecommendationHint}
          </p>
        )}
        <div className={`grid grid-cols-2 ${compact ? 'gap-2' : 'gap-3'}`}>
          <label
            className={setupChoiceCardClass(connectionMode.cli, cn(
              'flex cursor-pointer',
              compact ? 'items-center gap-2 rounded-lg px-3 py-2' : 'items-start gap-3 rounded-xl px-4 py-3',
            ))}
          >
            <input
              type="checkbox"
              checked={connectionMode.cli}
              onChange={() => setConnectionMode(prev => ({ ...prev, cli: !prev.cli }))}
              className={compact ? 'form-check' : 'form-check mt-0.5'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Terminal size={13} className={cn('shrink-0', connectionMode.cli ? 'text-[var(--amber)]' : 'text-muted-foreground')} /> CLI
              </div>
              <p className={`${compact ? 'hidden sm:block' : 'block'} mt-0.5 text-2xs text-muted-foreground`}>
                {s.connectionModeCliHint}
              </p>
            </div>
          </label>
          <label
            className={setupChoiceCardClass(connectionMode.mcp, cn(
              'flex cursor-pointer',
              compact ? 'items-center gap-2 rounded-lg px-3 py-2' : 'items-start gap-3 rounded-xl px-4 py-3',
            ))}
          >
            <input
              type="checkbox"
              checked={connectionMode.mcp}
              onChange={() => setConnectionMode(prev => ({ ...prev, mcp: !prev.mcp }))}
              className={compact ? 'form-check' : 'form-check mt-0.5'}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                <Plug size={13} className={cn('shrink-0', connectionMode.mcp ? 'text-[var(--amber)]' : 'text-muted-foreground')} /> MCP
              </div>
              <p className={`${compact ? 'hidden sm:block' : 'block'} mt-0.5 text-2xs text-muted-foreground`}>
                {s.connectionModeMcpHint}
              </p>
            </div>
          </label>
        </div>
      </div>

      {/* Hint — contextual based on connection mode */}
      {!connectionMode.cli && !connectionMode.mcp ? (
        <div className={setupNoticeClass('amber', 'flex items-center gap-2 px-3 py-2.5')}>
          <Brain size={13} className="shrink-0" />
          <span>{s.agentToolsHintNone}</span>
        </div>
      ) : (
        (!compact || connectionMode.mcp) && (
          <p className={compact ? 'text-xs leading-relaxed text-muted-foreground' : 'text-sm text-muted-foreground'}>
            {!connectionMode.mcp && connectionMode.cli ? s.agentToolsHintCliOnly : s.agentToolsHint}
          </p>
        )
      )}

      {!connectionMode.mcp ? (
        connectionMode.cli && !compact ? (
          <div className={`${compact ? 'rounded-lg px-3 py-2' : 'rounded-xl px-4 py-3'} flex items-start gap-3 border border-border bg-card`}>
            <div className={`${compact ? 'h-6 w-6' : 'h-7 w-7'} flex shrink-0 items-center justify-center rounded-lg bg-success/10 text-success`}>
              <Terminal size={compact ? 13 : 14} />
            </div>
            <div className="min-w-0">
              <p className={`${compact ? 'text-xs' : 'text-sm'} font-medium text-foreground`}>
                {s.agentCliModeTitle}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {s.agentCliModeDesc}
              </p>
            </div>
          </div>
        ) : null
      ) : agentsLoading ? (
        <div className="flex items-center gap-2 py-4 text-muted-foreground">
          <Loader2 size={14} className="animate-spin" />
          <span className="text-sm">{s.agentToolsLoading}</span>
        </div>
      ) : agents.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted-foreground">
          {s.agentToolsEmpty}
        </p>
      ) : (
        <>
          {/* Badge legend */}
          <div className="flex items-center gap-4 text-2xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-success" />
              {s.badgeInstalled}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--amber)]" />
              {s.badgeDetected}
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-muted-foreground" />
              {s.badgeNotFound}
            </span>
          </div>

          {/* Detected agents — always visible */}
          {detected.length > 0 ? (
            <div className="overflow-hidden rounded-xl border border-border">
              {detected.map((agent, i) => renderAgentRow(agent, i))}
            </div>
          ) : (
            <p className="py-2 text-xs text-muted-foreground">
              {s.agentNoneDetected}
            </p>
          )}
          {/* Other agents — collapsed by default */}
          {other.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowOtherAgents(!showOtherAgents)}
                aria-expanded={showOtherAgents}
                className="flex items-center gap-1.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDown size={12} className={`transition-transform ${showOtherAgents ? 'rotate-180' : ''}`} />
                {s.agentShowMore(other.length)}
              </button>
              {showOtherAgents && (
                <div className="mt-1 overflow-hidden rounded-xl border border-border">
                  {other.map((agent, i) => renderAgentRow(agent, i))}
                </div>
              )}
            </div>
          )}
          {/* Hint when no agents selected — only relevant for MCP mode */}
          {connectionMode.mcp && selectedAgents.size === 0 && (
            <div className={setupNoticeClass('amber', 'flex items-center gap-2 px-3 py-2.5')}>
              <Brain size={13} className="shrink-0" />
              <span>{s.agentNoneSelected}</span>
            </div>
          )}
          {/* Advanced options — only when MCP is enabled */}
          {connectionMode.mcp && (
            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                aria-expanded={showAdvanced}
                className="flex items-center gap-1.5 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                <ChevronDown size={12} className={`transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                {s.agentAdvanced}
              </button>
              {showAdvanced && (
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <Field label={s.agentTransport}>
                    <Select value={agentTransport} onChange={e => setAgentTransport(e.target.value as 'auto' | 'stdio' | 'http')}>
                      <option value="auto">{s.agentTransportAuto}</option>
                      <option value="stdio">{settingsMcp.transportStdio}</option>
                      <option value="http">{settingsMcp.transportHttp}</option>
                    </Select>
                  </Field>
                  <Field label={s.agentScope}>
                    <Select value={agentScope} onChange={e => setAgentScope(e.target.value as 'global' | 'project')}>
                      <option value="global">{s.agentScopeGlobal}</option>
                      <option value="project">{s.agentScopeProject}</option>
                    </Select>
                  </Field>
                </div>
              )}
            </div>
          )}
          <div className="mt-1 flex gap-2">
            <button
              type="button"
              onClick={() => setSelectedAgents(new Set(
                agents.filter(a => a.present).map(a => a.key)
              ))}
              className={setupOutlineButtonClass('amber')}>
              {s.agentSelectDetected}
            </button>
            <button
              type="button"
              onClick={() => setSelectedAgents(new Set())}
              className={setupOutlineButtonClass('neutral')}>
              {s.agentSkipLater}
            </button>
          </div>
        </>
      )}
    </div>
  );
}
