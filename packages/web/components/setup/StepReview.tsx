'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  Loader2, AlertTriangle, CheckCircle2, XCircle, Copy, Check,
  FolderOpen, Brain, Plug, Shield, Sparkles, Bot,
} from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import { toast } from '@/lib/toast';
import { fetchMindosHealth } from '@/lib/mindos-health';
import type { SetupState, SetupMessages, AgentInstallStatus } from './types';
import { PROVIDER_PRESETS } from '@/lib/agent/providers';
import { useLocale } from '@/lib/stores/locale-store';

// ─── Restart Block ────────────────────────────────────────────────────────────

/** Restart warning banner — shown in the content area */
export function RestartBanner({ s }: { s: SetupMessages }) {
  return (
    <div className="space-y-2">
      <div className="p-3 rounded-lg text-sm flex items-center gap-2"
        style={{ background: 'color-mix(in srgb, var(--amber) 10%, transparent)', color: 'var(--amber)' }}>
        <AlertTriangle size={14} /> {s.restartRequired}
      </div>
      <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
        {s.restartManual} <code className="font-mono">mindos start</code>
      </p>
    </div>
  );
}

/** Restart button — shown in the bottom navigation bar (same position as Complete/Saving button) */
export function RestartButton({ s, newPort, webPassword }: { s: SetupMessages; newPort: number; webPassword?: string }) {
  const [restarting, setRestarting] = useState(false);
  const [done, setDone] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>(undefined);
  const delayRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => () => { clearTimeout(delayRef.current); clearInterval(pollRef.current); }, []);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const restartRes = await fetch('/api/restart', { method: 'POST' });
      if (!restartRes.ok) throw new Error(`restart failed (${restartRes.status})`);
      setDone(true);
      const rawHost = window.location.hostname || 'localhost';
      const host = rawHost.includes(':') ? `[${rawHost}]` : rawHost;
      const baseUrl = `http://${host}:${newPort}`;
      const redirect = () => { window.location.href = `${baseUrl}/?welcome=1`; };

      let attempts = 0;
      clearInterval(pollRef.current);
      // Delay first poll to ensure the old server has been killed by `mindos restart`
      const startPoll = () => { pollRef.current = setInterval(async () => {
        attempts++;
        try {
          if (await fetchMindosHealth(`${baseUrl}/api/health`)) {
            clearInterval(pollRef.current);
            // Auto-authenticate so the user doesn't have to re-enter their password
            if (webPassword) {
              try {
                await fetch(`${baseUrl}/api/auth`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ password: webPassword }),
                  credentials: 'include',
                });
              } catch { /* auth failed — user will see login page instead */ }
            }
            redirect();
            return;
          }
        } catch { /* not ready yet */ }
        if (attempts >= 30) { clearInterval(pollRef.current); redirect(); }
      }, 800); };
      delayRef.current = setTimeout(startPoll, 2000);
    } catch (e) {
      console.warn('[SetupWizard] restart request failed:', e);
      setRestarting(false);
    }
  };

  if (done) {
    return (
      <span className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg"
        style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', color: 'var(--success)' }}>
        <CheckCircle2 size={14} /> {s.restartDone}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={handleRestart}
      disabled={restarting}
      className="flex items-center gap-1.5 px-5 py-2 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
      style={{ background: 'var(--amber)', color: 'var(--amber-foreground)' }}>
      {restarting ? <Loader2 size={13} className="animate-spin" /> : null}
      {restarting ? s.restarting : s.restartNow}
    </button>
  );
}

// ─── Step 6: Review ───────────────────────────────────────────────────────────
export interface StepReviewProps {
  state: SetupState;
  selectedAgents: Set<string>;
  agentStatuses: Record<string, AgentInstallStatus>;
  onRetryAgent: (key: string) => void;
  error: string;
  needsRestart: boolean;
  s: SetupMessages;
  setupPhase: 'review' | 'saving' | 'agents' | 'skills' | 'done';
  cliEnabled: boolean;
  mcpEnabled: boolean;
  skillInstallStatus?: 'pending' | 'installing' | 'ok' | 'error' | 'skipped';
}

type ReviewTone = 'default' | 'success' | 'warning';

interface ReviewStatusRow {
  title: string;
  value: string;
  icon: ReactNode;
  detail?: string;
  badge?: string;
  tone?: ReviewTone;
}

function ReviewBadge({ tone = 'default', children }: { tone?: ReviewTone; children: ReactNode }) {
  const color = tone === 'warning'
    ? 'var(--error)'
    : tone === 'success'
      ? 'var(--success)'
      : 'var(--muted-foreground)';
  const background = tone === 'warning'
    ? 'color-mix(in srgb, var(--error) 8%, transparent)'
    : tone === 'success'
      ? 'color-mix(in srgb, var(--success) 10%, transparent)'
      : 'var(--muted)';

  return (
    <span
      className="inline-flex shrink-0 items-center rounded-md px-1.5 py-0.5 text-2xs font-medium"
      style={{ background, color }}
    >
      {children}
    </span>
  );
}

function ReviewStatusList({ rows }: { rows: ReviewStatusRow[] }) {
  return (
    <div className="divide-y divide-border/70">
      {rows.map((row) => {
        const isWarning = row.tone === 'warning';
        const iconColor = isWarning ? 'var(--error)' : 'var(--amber)';
        const valueColor = isWarning ? 'var(--error)' : 'var(--foreground)';
        return (
          <div key={row.title} className="grid gap-1.5 px-4 py-3 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-4 sm:px-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md"
                style={{
                  background: isWarning
                    ? 'color-mix(in srgb, var(--error) 7%, transparent)'
                    : 'color-mix(in srgb, var(--amber) 7%, transparent)',
                  color: iconColor,
                }}>
                {row.icon}
              </span>
              <span>{row.title}</span>
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p
                  className="min-w-0 break-words text-sm font-medium leading-5"
                  style={{ color: valueColor }}
                >
                  {row.value}
                </p>
                {row.badge && <ReviewBadge tone={row.tone}>{row.badge}</ReviewBadge>}
              </div>
              {row.detail && (
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {row.detail}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function StepReview({
  state, selectedAgents, agentStatuses, onRetryAgent, error, needsRestart, s,
  setupPhase, cliEnabled, mcpEnabled, skillInstallStatus = 'pending',
}: StepReviewProps) {
  const { locale } = useLocale();

  const selectedKitNames = state.spaceKits.map(id => s.spaceKitLabels[id]).join(locale === 'zh' ? '、' : ', ');
  const activeProvider = state.providers.find(p => p.id === state.activeProvider);
  const providerLabel = activeProvider
    ? `${locale === 'zh' ? PROVIDER_PRESETS[activeProvider.protocol].nameZh : PROVIDER_PRESETS[activeProvider.protocol].name} · ${activeProvider.model || PROVIDER_PRESETS[activeProvider.protocol].defaultModel}`
    : s.aiSkipTitle;
  const aiSkipped = !activeProvider;
  const failedAgents = Object.entries(agentStatuses).filter(([, v]) => v.state === 'error');
  const modeLabel = cliEnabled && mcpEnabled ? 'CLI + MCP' : cliEnabled ? 'CLI' : mcpEnabled ? 'MCP' : (locale === 'zh' ? '未选择' : 'None');
  const showMcpAgentWork = mcpEnabled && selectedAgents.size > 0;
  const reviewRows: ReviewStatusRow[] = [
    {
      title: s.reviewSpaceKits,
      value: selectedKitNames || s.reviewSpaceKitsSkipped,
      icon: <Sparkles size={14} />,
      tone: state.spaceKits.length > 0 ? 'success' : 'default',
      badge: s.spaceKitCount(state.spaceKits.length),
    },
    {
      title: s.kbPath,
      value: state.mindRoot,
      icon: <FolderOpen size={14} />,
    },
    {
      title: s.healthAi,
      value: aiSkipped ? s.healthAiNone : providerLabel,
      icon: <Brain size={14} />,
      tone: aiSkipped ? 'warning' : 'success',
      badge: aiSkipped ? s.aiSkipTitle : s.aiModelTitle,
      detail: aiSkipped ? s.aiSkipWarning : undefined,
    },
    {
      title: s.agentToolsTitle,
      value: modeLabel,
      icon: <Bot size={14} />,
      tone: cliEnabled ? 'success' : 'default',
      badge: showMcpAgentWork ? s.agentCountSummary(selectedAgents.size) : modeLabel,
      detail: cliEnabled && !mcpEnabled
        ? s.agentRecommendationHint
        : showMcpAgentWork
          ? s.agentToolsHint
          : undefined,
    },
    {
      title: s.reviewLocalService,
      value: `${s.webPort} ${state.webPort}`,
      icon: <Plug size={14} />,
      detail: `${s.mcpPort} ${state.mcpPort}`,
    },
  ];

  type Phase = typeof setupPhase;
  const showAgentPhase = showMcpAgentWork;
  const showSkillPhase = showMcpAgentWork;
  const phases: { key: Phase; label: string }[] = [
    { key: 'saving', label: s.phaseSaving },
    ...(showAgentPhase ? [{ key: 'agents' as Phase, label: s.phaseAgents }] : []),
    ...(showSkillPhase ? [{ key: 'skills' as Phase, label: s.phaseSkill }] : []),
    { key: 'done', label: s.phaseDone },
  ];
  const phaseOrder: Phase[] = phases.map(p => p.key);
  const currentIdx = phaseOrder.indexOf(setupPhase);

  return (
    <div className="space-y-5">
      {setupPhase !== 'done' && (
        <div className="space-y-3">
          {setupPhase === 'review' && (
            <div
              className="overflow-hidden rounded-xl border"
              style={{
                borderColor: 'color-mix(in srgb, var(--amber) 22%, var(--border))',
                background: 'var(--card)',
              }}
            >
              <div className="border-b border-border/70 px-4 py-3.5 sm:px-5">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-base font-medium leading-6 text-foreground">{s.reviewReadyTitle}</p>
                    <p className="mt-0.5 max-w-[38rem] text-xs leading-relaxed text-muted-foreground">{s.reviewHint}</p>
                  </div>
                  <span
                    className="hidden shrink-0 rounded-md px-2 py-1 text-xs font-medium sm:inline-flex"
                    style={{
                      background: aiSkipped
                        ? 'color-mix(in srgb, var(--error) 8%, transparent)'
                        : 'color-mix(in srgb, var(--success) 10%, transparent)',
                      color: aiSkipped ? 'var(--error)' : 'var(--success)',
                    }}
                  >
                    {aiSkipped ? s.aiSkipTitle : s.aiModelTitle}
                  </span>
                </div>
              </div>
              <ReviewStatusList rows={reviewRows} />
            </div>
          )}
        </div>
      )}

      {/* Progress stepper — visible during setup, hidden once done */}
      {setupPhase !== 'review' && setupPhase !== 'done' && (
        <div className="space-y-2 py-2">
          {phases.map(({ key, label }, i) => {
            const idx = phaseOrder.indexOf(key);
            const isDone = currentIdx > idx;
            const isActive = setupPhase === key;
            const isPending = currentIdx < idx;
            return (
              <div key={key} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 text-2xs"
                  style={{
                    background: isDone ? 'color-mix(in srgb, var(--success) 15%, transparent)' : isActive ? 'color-mix(in srgb, var(--amber) 15%, transparent)' : 'var(--muted)',
                    color: isDone ? 'var(--success)' : isActive ? 'var(--amber)' : 'var(--muted-foreground)',
                  }}>
                  {isDone ? <CheckCircle2 size={12} /> : isActive ? <Loader2 size={12} className="animate-spin" /> : (i + 1)}
                </div>
                <span className="text-sm" style={{
                  color: isDone ? 'var(--success)' : isActive ? 'var(--foreground)' : 'var(--muted-foreground)',
                  fontWeight: isActive ? 500 : 400,
                  opacity: isPending ? 0.5 : 1,
                }}>
                  {label}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {error && (
        <div className="p-3 rounded-lg text-sm text-error" style={{ background: 'color-mix(in srgb, var(--error) 10%, transparent)' }}>
          {s.completeFailed}: {error}
        </div>
      )}

      {failedAgents.length > 0 && setupPhase === 'done' && (
        <div className="rounded-lg border p-3 space-y-2"
          style={{ borderColor: 'color-mix(in srgb, var(--error) 35%, transparent)', background: 'color-mix(in srgb, var(--error) 8%, transparent)' }}>
          <p className="text-xs font-medium" style={{ color: 'var(--error)' }}>
            {s.agentFailedCount(failedAgents.length)}
          </p>
          {failedAgents.map(([key, st]) => (
            <div key={key} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs flex items-center gap-1" style={{ color: 'var(--error)' }}>
                <XCircle size={11} className="shrink-0" /> {key}{st.message ? ` - ${st.message}` : ''}
              </span>
              <button
                type="button"
                onClick={() => onRetryAgent(key)}
                className="shrink-0 rounded-md border px-2 py-0.5 text-xs transition-colors hover:bg-background/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                style={{ borderColor: 'var(--error)', color: 'var(--error)' }}>
                {s.retryAgent}
              </button>
            </div>
          ))}
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{s.agentFailureNote}</p>
        </div>
      )}

      {/* Health Check Summary — shown when setup is done */}
      {setupPhase === 'done' && (
        <HealthCheckView
          state={state}
          selectedAgents={selectedAgents}
          agentStatuses={agentStatuses}
          needsRestart={needsRestart}
          skillInstallStatus={skillInstallStatus}
          cliEnabled={cliEnabled}
          mcpEnabled={mcpEnabled}
          s={s}
        />
      )}
    </div>
  );
}

/* ── Health Check Summary ─────────────────────────────────────────────────── */

function HealthCheckView({
  state, selectedAgents, agentStatuses, needsRestart, s,
  skillInstallStatus = 'pending', cliEnabled, mcpEnabled,
}: {
  state: SetupState;
  selectedAgents: Set<string>;
  agentStatuses: Record<string, AgentInstallStatus>;
  needsRestart: boolean;
  skillInstallStatus?: 'pending' | 'installing' | 'ok' | 'error' | 'skipped';
  cliEnabled: boolean;
  mcpEnabled: boolean;
  s: SetupMessages;
}) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const handleCopyToken = useCallback(async () => {
    if (!state.authToken) return;
    const ok = await copyToClipboard(state.authToken);
    if (ok) { setCopied(true); toast.copy(); }
  }, [state.authToken]);

  const { locale } = useLocale();

  // Derive health check statuses
  const kbOk = !!state.mindRoot;
  const hasSpaceKits = state.spaceKits.length > 0;
  const aiOk = state.activeProvider !== 'skip' && state.providers.length > 0;
  const hasToken = !!state.authToken;
  const selectedMcpAgentCount = mcpEnabled ? selectedAgents.size : 0;
  const successAgents = Object.values(agentStatuses).filter(a => a.state === 'ok').length;
  const mcpAgentsOk = selectedMcpAgentCount > 0 && successAgents > 0;
  const skillsRelevant = selectedMcpAgentCount > 0;
  const skillsOk = skillInstallStatus === 'ok';
  const agentConnectionOk = cliEnabled || mcpAgentsOk;
  const agentConnectionDetail = (() => {
    if (cliEnabled && !mcpEnabled) return s.healthAgentsCliReady ?? 'CLI direct access is enabled.';
    if (cliEnabled && mcpEnabled && !mcpAgentsOk) {
      return selectedMcpAgentCount > 0
        ? (s.healthAgentsPartial ?? 'Configuration in progress...')
        : (s.healthAgentsCliMcpOptional ?? 'CLI direct access is enabled. MCP agents can be added later.');
    }
    if (mcpAgentsOk) return s.healthAgentsOk?.(successAgents) ?? `${successAgents} agent(s) configured`;
    if (selectedMcpAgentCount > 0) return s.healthAgentsPartial ?? 'Configuration in progress...';
    return s.healthAgentsNone ?? 'No agents configured';
  })();

  // Resolve provider display name and model from unified Provider[]
  let providerDisplayName = '';
  let providerModelName = '';
  if (aiOk) {
    const activeP = state.providers.find(p => p.id === state.activeProvider);
    if (activeP) {
      const preset = PROVIDER_PRESETS[activeP.protocol];
      providerDisplayName = locale === 'zh' ? preset.nameZh : preset.name;
      providerModelName = activeP.model || preset.defaultModel;
    }
  }

  const readyLabel = locale === 'zh' ? '已完成' : 'Ready';
  const attentionLabel = locale === 'zh' ? '需处理' : 'Needs action';
  const checks: ReviewStatusRow[] = [
    {
      icon: <FolderOpen size={14} />,
      title: s.healthKb ?? 'Mind root',
      value: kbOk ? state.mindRoot : (s.healthKbNone ?? 'Not configured'),
      tone: kbOk ? 'success' : 'warning',
      badge: kbOk ? readyLabel : attentionLabel,
    },
    {
      icon: <Sparkles size={14} />,
      title: s.reviewSpaceKits,
      value: hasSpaceKits
        ? state.spaceKits.map(id => s.spaceKitLabels[id]).join(locale === 'zh' ? '、' : ', ')
        : s.reviewSpaceKitsSkipped,
      tone: hasSpaceKits ? 'success' : 'default',
      badge: s.spaceKitCount(state.spaceKits.length),
    },
    {
      icon: <Brain size={14} />,
      title: s.healthAi ?? 'AI Provider',
      value: aiOk
        ? `${providerDisplayName} (${providerModelName || 'default'})`
        : (s.healthAiNone ?? 'Not configured — AI features disabled'),
      detail: aiOk ? undefined : (s.healthAiAction ?? 'Add an API key in Settings → AI.'),
      tone: aiOk ? 'success' : 'warning',
      badge: aiOk ? readyLabel : attentionLabel,
    },
    {
      icon: <Plug size={14} />,
      title: s.reviewLocalService,
      value: `${s.webPort} ${state.webPort}`,
      detail: `${s.mcpPort} ${state.mcpPort}`,
      tone: 'success',
      badge: readyLabel,
    },
    {
      icon: <Bot size={14} />,
      title: s.healthAgents ?? 'Agent Connection',
      value: agentConnectionDetail,
      detail: agentConnectionOk ? undefined : (s.healthAgentsAction ?? 'You can add agents later in Settings -> Connections.'),
      tone: agentConnectionOk ? 'success' : 'warning',
      badge: agentConnectionOk ? readyLabel : attentionLabel,
    },
    ...(skillsRelevant ? [{
      icon: <Sparkles size={14} />,
      title: s.healthSkills ?? 'Skills',
      value: skillInstallStatus === 'ok'
        ? (s.healthSkillsOk ?? 'Skills installed successfully')
        : skillInstallStatus === 'error'
          ? (s.healthSkillsError ?? 'Skill installation failed')
          : skillInstallStatus === 'skipped'
            ? (s.healthSkillsSkipped ?? 'Skipped')
            : (s.healthSkillsInstalling ?? 'Installing skills...'),
      detail: skillInstallStatus === 'error' ? (s.healthSkillsAction ?? 'You can install skills manually later.') : undefined,
      tone: skillsOk ? 'success' as const : 'warning' as const,
      badge: skillsOk ? readyLabel : attentionLabel,
    }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-xl border" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
        <div className="border-b border-border/70 p-4 sm:p-5">
          <div className="flex items-start gap-3">
            <span
              className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
              style={{
                background: 'color-mix(in srgb, var(--success) 10%, transparent)',
                color: 'var(--success)',
              }}
            >
              <CheckCircle2 size={19} />
            </span>
            <div className="min-w-0">
              <p className="text-base font-medium leading-6 text-foreground">{s.completeDone}</p>
              <p className="mt-1 max-w-[36rem] text-sm leading-relaxed text-muted-foreground">{s.welcomeDesc}</p>
            </div>
          </div>
        </div>

        <ReviewStatusList rows={checks} />
      </div>

      {/* Auth Token — always shown prominently */}
      {hasToken && (
        <div className="rounded-xl border p-4 space-y-2" style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>
          <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--muted-foreground)' }}>
            <Shield size={11} />
            {s.healthTokenTitle ?? 'Auth Token'}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1 flex items-center px-3 py-2 rounded-lg min-h-[38px]"
              style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
              <code className="flex-1 text-xs font-mono break-all select-all leading-relaxed" style={{ color: 'var(--foreground)' }}>
                {state.authToken}
              </code>
            </div>
            <button
              type="button"
              onClick={handleCopyToken}
              className="shrink-0 p-2 rounded-lg border transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1"
              style={{
                borderColor: copied ? 'color-mix(in srgb, var(--success) 50%, transparent)' : 'var(--border)',
                background: copied ? 'color-mix(in srgb, var(--success) 10%, transparent)' : 'transparent',
                color: copied ? 'var(--success)' : 'var(--muted-foreground)',
              }}
              title={s.healthTokenCopy ?? 'Copy token'}>
              {copied ? <Check size={14} /> : <Copy size={14} />}
            </button>
          </div>
          <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {s.healthTokenHint ?? 'Use this token when connecting AI agents. Also available in Settings → Connections.'}
          </p>
        </div>
      )}

      {/* Restart banner */}
      {needsRestart && <RestartBanner s={s} />}
    </div>
  );
}
