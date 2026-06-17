'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  Blocks,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  ListChecks,
  MessageSquarePlus,
  Search,
  SlidersHorizontal,
  Target,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { StableRowTrailingSlot } from '@/components/shared/StableRowChrome';
import { useLocale } from '@/lib/stores/locale-store';
import { refreshSessions, useActiveSessionId, useSessions } from '@/lib/ask-session-store';
import { useSmoothRouterPush } from '@/hooks/useSmoothRouterPush';
import { cn } from '@/lib/utils';
import {
  createStudioProject,
  findStudioProject,
  getStudioProjectHref,
  localize,
  localizeList,
  readStudioProjects,
  sessionStatusLabel,
  stageLabel,
  STUDIO_NEW_PROJECT_REQUESTED_EVENT,
  type StudioProject,
  type StudioSessionSummary,
  type StudioProjectDraft,
} from '@/lib/studio-projects';
import { summarizeChatSession } from './studio-session-summaries';
import { StudioShell } from './StudioShell';
import StudioNewProjectDialog from './StudioNewProjectDialog';

const COPY = {
  en: {
    back: 'Studio',
    missingTitle: 'Project not found',
    missingText: 'This Project may have been archived or created in another browser profile.',
    returnStudio: 'Back to Studio',
    newSession: 'New Session',
    historicalSessions: 'Session history',
    sessionsHint: 'Work, artifacts, and review trail.',
    noSessions: 'No Sessions yet.',
    noMatchingSessions: 'No Sessions match this view.',
    untitledSession: 'Untitled Session',
    space: 'Space',
    kits: 'AI Kits',
    directory: 'Directory',
    workArea: 'Work Area',
    cadence: 'Cadence',
    nextAction: 'Next action',
    overview: 'Overview',
    overviewHint: 'Configuration, status, and the next durable move.',
    configuration: 'Configuration',
    status: 'Status',
    goal: 'Goal',
    progress: 'Progress',
    searchSessions: 'Search Sessions',
    searchPlaceholder: 'Search title, artifact, or summary',
    filterByAgent: 'Filter by agent',
    allAgents: 'All agents',
    sessionMetric: 'Sessions',
    reviewMetric: 'Review',
    review: 'Review queue',
    growth: 'Growth',
    artifact: 'Artifact',
    updated: 'Updated',
    createTitle: 'New Project',
    createDescription: 'Set the goal, work area, memory, and AI.',
    titleLabel: 'Project name',
    goalLabel: 'Goal',
    spaceLabel: 'Mind Space',
    kitLabel: 'AI Kit',
    workAreaLabel: 'Work Area',
    titlePlaceholder: 'Launch practice',
    goalPlaceholder: 'Turn product evidence into launch decisions',
    spacePlaceholder: 'Product Strategy',
    kitPlaceholder: 'Research Kit',
    workAreaPlaceholder: 'Session drafts',
    cancel: 'Cancel',
    create: 'Create Project',
    required: 'Add a project name and goal.',
    setupTitle: 'Project setup',
    setupDescription: 'Pick defaults for new Sessions.',
    workAreaDescription: 'Drafts and artifacts land here.',
    spaceDescription: 'Long-term context for this Project.',
    kitDescription: 'Default AI capability for new Sessions.',
    customValue: 'Custom value',
    projectDetailsTitle: 'Project details',
    projectDetailsDescription: 'Name it, then set one concrete goal.',
    selectedSummary: 'Selected setup',
    fromRecentProject: 'Recent Project',
  },
  zh: {
    back: 'Studio',
    missingTitle: '找不到 Project',
    missingText: '这个 Project 可能已归档，或是在另一个浏览器配置里创建的。',
    returnStudio: '返回 Studio',
    newSession: '新建 Session',
    historicalSessions: 'Session 历史',
    sessionsHint: '工作、产物和复盘记录。',
    noSessions: '还没有 Session。',
    noMatchingSessions: '没有匹配这个视图的 Session。',
    untitledSession: '未命名 Session',
    space: 'Space',
    kits: 'AI Kits',
    directory: '目录',
    workArea: 'Work Area',
    cadence: '节奏',
    nextAction: '下一步',
    overview: '总览',
    overviewHint: 'Project 的配置、状态和下一步。',
    configuration: '配置',
    status: '状态',
    goal: '目标',
    progress: '进度',
    searchSessions: '搜索 Sessions',
    searchPlaceholder: '搜索标题、产物或摘要',
    filterByAgent: '按 Agent 过滤',
    allAgents: '全部 Agent',
    sessionMetric: 'Sessions',
    reviewMetric: '待复盘',
    review: 'Review queue',
    growth: '可复用经验',
    artifact: '产物',
    updated: '更新',
    createTitle: '新建 Project',
    createDescription: '设定目标、工作区、记忆和 AI。',
    titleLabel: 'Project 名称',
    goalLabel: '目标',
    spaceLabel: 'Mind Space',
    kitLabel: 'AI Kit',
    workAreaLabel: 'Work Area',
    titlePlaceholder: '发布实践',
    goalPlaceholder: '把产品证据整理成发布决策',
    spacePlaceholder: '产品策略',
    kitPlaceholder: 'Research Kit',
    workAreaPlaceholder: 'Session 草稿',
    cancel: '取消',
    create: '创建 Project',
    required: '需要填写 Project 名称和目标。',
    setupTitle: 'Project 设置',
    setupDescription: '为新 Session 选择默认设置。',
    workAreaDescription: '草稿和产物放这里。',
    spaceDescription: '这个 Project 的长期上下文。',
    kitDescription: '新 Session 默认使用的 AI 能力。',
    customValue: '自定义',
    projectDetailsTitle: 'Project 细节',
    projectDetailsDescription: '名称要短，目标要具体。',
    selectedSummary: '已选设置',
    fromRecentProject: '来自近期 Project',
  },
} as const;

type ProjectCopy = (typeof COPY)[keyof typeof COPY];

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(value, 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-[var(--amber)]" style={{ width: `${width}%` }} />
    </div>
  );
}

function OverviewCell({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 border-t border-border/60 px-4 py-3 first:border-t-0 md:border-l md:border-t-0 md:first:border-l-0">
      <div className="mb-2 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="text-[var(--amber)]" aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground" title={value}>{value}</div>
    </div>
  );
}

function StatusRow({
  icon,
  label,
  children,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 gap-3 border-t border-border/60 px-4 py-3 first:border-t-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--amber-subtle)] text-[var(--amber)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="mt-1 text-sm leading-relaxed text-foreground">{children}</div>
      </div>
    </div>
  );
}

function sessionAgentName(session: StudioSessionSummary): string {
  return session.agentName?.trim() || 'MindOS';
}

function sessionAgentId(session: StudioSessionSummary): string {
  return session.agentId?.trim() || sessionAgentName(session).toLowerCase().replace(/\s+/g, '-');
}

function SessionRow({
  session,
  locale,
  copy,
  active,
}: {
  session: StudioSessionSummary;
  locale: string;
  copy: ProjectCopy;
  active?: boolean;
}) {
  const title = localize(session.title, session.titleZh, locale);
  const artifact = localize(session.artifact, session.artifactZh, locale);
  const agentName = sessionAgentName(session);
  const dotClass = session.status === 'active'
    ? 'bg-success'
    : session.status === 'review'
      ? 'bg-[var(--amber)]'
      : session.status === 'paused'
        ? 'bg-muted-foreground/55'
        : 'bg-muted-foreground/35';
  const statusDot = <span className={cn('h-2 w-2 rounded-full', dotClass)} title={sessionStatusLabel(session.status, locale)} />;
  const className = cn(
    'group grid gap-3 border-t border-border/60 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_140px_112px_2.5rem]',
    session.href ? 'transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring' : '',
    active ? 'bg-[var(--amber-subtle)]' : '',
  );
  const content = (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 truncate text-sm font-semibold text-foreground">{title}</h3>
          <span className="inline-flex h-6 items-center rounded-md border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground">
            {sessionStatusLabel(session.status, locale)}
          </span>
          <span className="inline-flex h-6 max-w-32 items-center rounded-md border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground">
            <span className="truncate">{agentName}</span>
          </span>
        </div>
        <p className="mt-1 max-w-[64ch] text-xs leading-relaxed text-muted-foreground">
          {localize(session.summary, session.summaryZh, locale)}
        </p>
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{copy.artifact}</div>
        <div className="mt-1 flex min-w-0 items-center gap-2 text-xs text-foreground">
          <FileText size={13} className="shrink-0 text-[var(--amber)]" />
          <span className="truncate">{artifact}</span>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium text-muted-foreground">{copy.updated}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-foreground">
          <Clock3 size={13} className="text-[var(--amber)]" />
          {session.updated}
        </div>
      </div>
      <StableRowTrailingSlot
        reserveClassName="w-10"
        status={statusDot}
        actions={session.href ? <ArrowRight size={14} className="text-[var(--amber)]" aria-hidden="true" /> : statusDot}
      />
    </>
  );

  if (session.href) {
    return (
      <Link
        href={session.href}
        className={className}
        aria-label={`${title} · ${agentName}`}
      >
        {content}
      </Link>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}

function MissingProject({ copy }: { copy: ProjectCopy }) {
  return (
    <div className="flex min-h-[calc(100dvh-var(--app-titlebar-h)-5rem)] items-center justify-center">
      <div className="w-full max-w-3xl rounded-xl border border-border/60 bg-card/55 p-6">
        <h1 className="text-2xl font-semibold text-foreground">{copy.missingTitle}</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{copy.missingText}</p>
        <Link
          href="/studio"
          className="mt-5 inline-flex h-9 items-center gap-2 rounded-lg bg-[var(--amber)] px-3.5 text-sm font-medium text-[var(--amber-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <ArrowLeft size={15} />
          {copy.returnStudio}
        </Link>
      </div>
    </div>
  );
}

export default function StudioProjectContent({ projectId }: { projectId: string }) {
  const push = useSmoothRouterPush();
  const { locale } = useLocale();
  const copy = locale === 'zh' ? COPY.zh : COPY.en;
  const [projects, setProjects] = useState<StudioProject[]>(() => readStudioProjects());
  const [isCreating, setIsCreating] = useState(false);
  const [sessionSearch, setSessionSearch] = useState('');
  const [agentFilter, setAgentFilter] = useState('all');
  const sessions = useSessions();
  const activeSessionId = useActiveSessionId();

  useEffect(() => {
    setProjects(readStudioProjects());
  }, [projectId]);

  useEffect(() => {
    void refreshSessions();
  }, []);

  useEffect(() => {
    const openCreate = () => setIsCreating(true);
    window.addEventListener(STUDIO_NEW_PROJECT_REQUESTED_EVENT, openCreate);
    return () => window.removeEventListener(STUDIO_NEW_PROJECT_REQUESTED_EVENT, openCreate);
  }, []);

  const project = useMemo(
    () => findStudioProject(projects, projectId) ?? null,
    [projectId, projects],
  );

  const localized = useMemo(() => {
    if (!project) return null;
    return {
      title: localize(project.title, project.titleZh, locale),
      goal: localize(project.goal, project.goalZh, locale),
      space: localize(project.space, project.spaceZh, locale),
      workArea: localize(project.workArea, project.workAreaZh, locale),
      cadence: localize(project.cadence, project.cadenceZh, locale),
      nextAction: localize(project.nextAction, project.nextActionZh, locale),
      kits: localizeList(project.kits, undefined, locale),
      reviewItems: localizeList(project.reviewItems, project.reviewItemsZh, locale),
      lessons: localizeList(project.lessons, project.lessonsZh, locale),
    };
  }, [locale, project]);

  const realProjectSessions = useMemo(() => (
    sessions
      .filter((session) => session.projectId === projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((session) => summarizeChatSession(session, activeSessionId, copy.untitledSession))
  ), [activeSessionId, copy.untitledSession, projectId, sessions]);

  const displaySessions = useMemo(() => (
    realProjectSessions.length > 0 ? realProjectSessions : (project?.sessions ?? [])
  ), [project, realProjectSessions]);

  const agentOptions = useMemo(() => {
    const options = new Map<string, { id: string; label: string; count: number }>();
    for (const session of displaySessions) {
      const id = sessionAgentId(session);
      const existing = options.get(id);
      if (existing) {
        existing.count += 1;
      } else {
        options.set(id, { id, label: sessionAgentName(session), count: 1 });
      }
    }
    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label));
  }, [displaySessions]);

  const filteredSessions = useMemo(() => {
    const query = sessionSearch.trim().toLowerCase();
    return displaySessions.filter((session) => {
      if (agentFilter !== 'all' && sessionAgentId(session) !== agentFilter) return false;
      if (!query) return true;
      const haystack = [
        localize(session.title, session.titleZh, locale),
        localize(session.summary, session.summaryZh, locale),
        localize(session.artifact, session.artifactZh, locale),
        sessionAgentName(session),
        sessionStatusLabel(session.status, locale),
      ].join(' ').toLowerCase();
      return haystack.includes(query);
    });
  }, [agentFilter, displaySessions, locale, sessionSearch]);

  useEffect(() => {
    if (agentFilter === 'all') return;
    if (agentOptions.some((option) => option.id === agentFilter)) return;
    setAgentFilter('all');
  }, [agentFilter, agentOptions]);

  const handleCreate = (draft: StudioProjectDraft) => {
    const nextProject = createStudioProject(draft);
    setProjects(readStudioProjects());
    setIsCreating(false);
    push(getStudioProjectHref(nextProject.id));
  };

  if (!project || !localized) {
    return (
      <StudioShell>
        <MissingProject copy={copy} />
        <StudioNewProjectDialog
          open={isCreating}
          onClose={() => setIsCreating(false)}
          onCreate={handleCreate}
          copy={copy}
          locale={locale}
          projects={projects}
        />
      </StudioShell>
    );
  }

  return (
    <StudioShell>
      <div className="min-w-0 space-y-6">
        <header>
          <Link
            href="/studio"
            className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ArrowLeft size={15} aria-hidden="true" />
            {copy.returnStudio}
          </Link>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="inline-flex h-6 items-center rounded-md border border-border/60 bg-card/70 px-2 text-[11px] font-medium text-muted-foreground">
                  {stageLabel(project.stage, locale)}
                </span>
                <span className="text-[11px] font-medium text-muted-foreground">{project.updated}</span>
              </div>
              <h1 className="text-2xl font-semibold text-foreground">
                {localized.title}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">{localized.goal}</p>
            </div>
            <Button
              render={<Link href={`/chat/new?projectId=${encodeURIComponent(project.id)}`} />}
              nativeButton={false}
              variant="amber"
              size="xl"
              className="w-fit"
            >
              <MessageSquarePlus size={15} aria-hidden="true" />
              {copy.newSession}
            </Button>
          </div>
        </header>

        <section className="overflow-hidden rounded-xl border border-border/60 bg-card/45" aria-labelledby="studio-project-overview">
          <div className="border-b border-border/60 px-4 py-4">
            <div className="flex items-center gap-2">
              <Target size={15} className="text-[var(--amber)]" aria-hidden="true" />
              <h2 id="studio-project-overview" className="text-sm font-semibold text-foreground">{copy.overview}</h2>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">{copy.overviewHint}</p>
          </div>

          <div className="grid md:grid-cols-4">
            <OverviewCell icon={<FolderOpen size={13} />} label={copy.directory} value={localized.workArea} />
            <OverviewCell icon={<BookOpenText size={13} />} label={copy.space} value={localized.space} />
            <OverviewCell icon={<Blocks size={13} />} label={copy.kits} value={localized.kits.join(' / ') || 'Basic assistant'} />
            <OverviewCell icon={<Clock3 size={13} />} label={copy.cadence} value={localized.cadence} />
          </div>

          <div className="grid border-t border-border/60 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)]">
            <div className="min-w-0">
              <StatusRow icon={<Target size={14} aria-hidden="true" />} label={copy.goal}>
                {localized.goal}
              </StatusRow>
              <StatusRow icon={<ArrowRight size={14} aria-hidden="true" />} label={copy.nextAction}>
                {localized.nextAction}
              </StatusRow>
            </div>
            <div className="min-w-0 border-t border-border/60 lg:border-l lg:border-t-0">
              <StatusRow icon={<CheckCircle2 size={14} aria-hidden="true" />} label={copy.progress}>
                <div className="flex items-center gap-3">
                  <div className="min-w-0 flex-1">
                    <ProgressBar value={project.progress} />
                  </div>
                  <span className="shrink-0 text-sm font-semibold [font-variant-numeric:tabular-nums]">{project.progress}%</span>
                </div>
              </StatusRow>
              <StatusRow icon={<MessageSquarePlus size={14} aria-hidden="true" />} label={copy.sessionMetric}>
                {displaySessions.length}
              </StatusRow>
              <StatusRow icon={<ListChecks size={14} aria-hidden="true" />} label={copy.reviewMetric}>
                {project.reviewItems.length}
              </StatusRow>
            </div>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-border/60 bg-card/45" aria-labelledby="studio-project-sessions">
          <div className="border-b border-border/60 px-4 py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
              <div className="min-w-0">
                <h2 id="studio-project-sessions" className="text-sm font-semibold text-foreground">{copy.historicalSessions}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{copy.sessionsHint}</p>
              </div>
              <div className="flex w-full flex-col gap-2 sm:flex-row xl:w-auto">
                <label className="relative min-w-0 flex-1 xl:w-72 xl:flex-none">
                  <span className="sr-only">{copy.searchSessions}</span>
                  <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <input
                    value={sessionSearch}
                    onChange={(event) => setSessionSearch(event.target.value)}
                    placeholder={copy.searchPlaceholder}
                    className="h-9 w-full rounded-lg border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-[var(--amber)] focus-visible:ring-2 focus-visible:ring-ring/40"
                  />
                </label>
                <label className="relative sm:w-44">
                  <span className="sr-only">{copy.filterByAgent}</span>
                  <SlidersHorizontal size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                  <select
                    value={agentFilter}
                    onChange={(event) => setAgentFilter(event.target.value)}
                    className="h-9 w-full appearance-none rounded-lg border border-border bg-background pl-8 pr-8 text-sm text-foreground outline-none transition-colors focus-visible:border-[var(--amber)] focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    <option value="all">{copy.allAgents}</option>
                    {agentOptions.map((agent) => (
                      <option key={agent.id} value={agent.id}>
                        {agent.label} ({agent.count})
                      </option>
                    ))}
                  </select>
                </label>
                <Button
                  render={<Link href={`/chat/new?projectId=${encodeURIComponent(project.id)}`} />}
                  nativeButton={false}
                  variant="outline"
                  size="lg"
                  className="justify-center"
                >
                  <MessageSquarePlus size={15} aria-hidden="true" />
                  {copy.newSession}
                </Button>
              </div>
            </div>
          </div>
          {filteredSessions.length ? (
            filteredSessions.map((session) => (
              <SessionRow
                key={session.id}
                session={session}
                locale={locale}
                copy={copy}
                active={session.id === activeSessionId}
              />
            ))
          ) : (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              {displaySessions.length ? copy.noMatchingSessions : copy.noSessions}
            </div>
          )}
        </section>
      </div>
      <StudioNewProjectDialog
        open={isCreating}
        onClose={() => setIsCreating(false)}
        onCreate={handleCreate}
        copy={copy}
        locale={locale}
        projects={projects}
      />
    </StudioShell>
  );
}
