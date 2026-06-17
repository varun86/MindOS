'use client';

import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  Clock3,
  FileText,
  FolderOpen,
  ListChecks,
  MessageSquarePlus,
  Target,
  Zap,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/lib/stores/locale-store';
import { refreshSessions, useActiveSessionId, useSessions } from '@/lib/ask-session-store';
import { useSmoothRouterPush } from '@/hooks/useSmoothRouterPush';
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
    untitledSession: 'Untitled Session',
    space: 'Space',
    kits: 'AI Kits',
    workArea: 'Work Area',
    cadence: 'Cadence',
    nextAction: 'Next action',
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
    untitledSession: '未命名 Session',
    space: 'Space',
    kits: 'AI Kits',
    workArea: 'Work Area',
    cadence: '节奏',
    nextAction: '下一步',
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

function ScopeRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 border-t border-border/50 py-3 first:border-t-0">
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[var(--amber-subtle)] text-[var(--amber)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-[11px] font-medium text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm leading-relaxed text-foreground">{value}</div>
      </div>
    </div>
  );
}

function ProjectMetric({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-lg border border-border/55 bg-background/45 px-3 py-2.5">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[var(--amber-subtle)] text-[var(--amber)]">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-2 text-base font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</div>
    </div>
  );
}

function SetupChip({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border/55 bg-background/45 px-3 py-2.5">
      <div className="mb-1 flex items-center gap-2 text-[11px] font-medium text-muted-foreground">
        <span className="text-[var(--amber)]">{icon}</span>
        {label}
      </div>
      <div className="truncate text-sm font-medium text-foreground">{value}</div>
    </div>
  );
}

function SessionRow({
  session,
  locale,
  copy,
}: {
  session: StudioSessionSummary;
  locale: string;
  copy: ProjectCopy;
}) {
  const className = 'grid gap-3 border-t border-border/60 px-4 py-3 first:border-t-0 md:grid-cols-[minmax(0,1fr)_150px_120px]';
  const content = (
    <>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">{localize(session.title, session.titleZh, locale)}</h3>
          <span className="inline-flex h-6 items-center rounded-md border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground">
            {sessionStatusLabel(session.status, locale)}
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
          <span className="truncate">{localize(session.artifact, session.artifactZh, locale)}</span>
        </div>
      </div>
      <div>
        <div className="text-[11px] font-medium text-muted-foreground">{copy.updated}</div>
        <div className="mt-1 flex items-center gap-2 text-xs text-foreground">
          <Clock3 size={13} className="text-[var(--amber)]" />
          {session.updated}
        </div>
      </div>
    </>
  );

  if (session.href) {
    return (
      <Link
        href={session.href}
        className={`${className} group transition-colors hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring`}
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

  const displaySessions = realProjectSessions.length > 0 ? realProjectSessions : project.sessions;

  return (
    <StudioShell>
      <div className="min-w-0 space-y-5">
        <header className="overflow-hidden rounded-xl border border-border/60 bg-card/45">
          <div className="p-5">
            <Link
              href="/studio"
              className="mb-4 inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft size={15} aria-hidden="true" />
              {copy.back}
            </Link>
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
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
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{localized.goal}</p>

                <div className="mt-4 rounded-lg border border-border/55 bg-background/45 p-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="font-medium text-muted-foreground">{copy.nextAction}</span>
                    <span className="font-medium text-foreground [font-variant-numeric:tabular-nums]">{project.progress}%</span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{localized.nextAction}</p>
                  <div className="mt-3">
                    <ProgressBar value={project.progress} />
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3">
                <Link
                  href={`/chat/new?projectId=${encodeURIComponent(project.id)}`}
                  className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-[var(--amber)] px-3.5 text-sm font-medium text-[var(--amber-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <MessageSquarePlus size={15} aria-hidden="true" />
                  {copy.newSession}
                </Link>
                <ProjectMetric icon={<MessageSquarePlus size={13} aria-hidden="true" />} label={copy.sessionMetric} value={displaySessions.length} />
                <ProjectMetric icon={<ListChecks size={13} aria-hidden="true" />} label={copy.reviewMetric} value={project.reviewItems.length} />
              </div>
            </div>
          </div>

          <div className="grid gap-2 border-t border-border/60 bg-background/20 p-4 md:grid-cols-3">
            <SetupChip icon={<BookOpenText size={13} aria-hidden="true" />} label={copy.space} value={localized.space} />
            <SetupChip icon={<Zap size={13} aria-hidden="true" />} label={copy.kits} value={localized.kits.join(' / ') || 'Basic assistant'} />
            <SetupChip icon={<FolderOpen size={13} aria-hidden="true" />} label={copy.workArea} value={localized.workArea} />
          </div>
        </header>

        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="min-w-0 space-y-6">
            <section className="overflow-hidden rounded-xl border border-border/60 bg-card/45">
              <div className="border-b border-border/60 px-4 py-4">
                <h2 className="text-sm font-semibold text-foreground">{copy.historicalSessions}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{copy.sessionsHint}</p>
              </div>
              {displaySessions.length ? (
                displaySessions.map((session) => (
                  <SessionRow key={session.id} session={session} locale={locale} copy={copy} />
                ))
              ) : (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">{copy.noSessions}</div>
              )}
            </section>

          </div>

          <aside className="space-y-4 lg:sticky lg:top-6 lg:self-start">
            <section className="rounded-xl border border-border/60 bg-card/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <ListChecks size={15} className="text-[var(--amber)]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{copy.review}</h2>
              </div>
              <div className="space-y-2">
                {localized.reviewItems.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <CheckCircle2 size={13} className="mt-0.5 shrink-0 text-[var(--amber)]" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-border/60 bg-card/45 p-4">
              <div className="mb-3 flex items-center gap-2">
                <Target size={15} className="text-[var(--amber)]" aria-hidden="true" />
                <h2 className="text-sm font-semibold text-foreground">{copy.growth}</h2>
              </div>
              <div className="space-y-2">
                {localized.lessons.map((item) => (
                  <div key={item} className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
                    <ArrowRight size={13} className="mt-0.5 shrink-0 text-[var(--amber)]" aria-hidden="true" />
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="rounded-xl border border-border/60 bg-card/45 p-4">
              <h2 className="text-sm font-semibold text-foreground">{copy.cadence}</h2>
              <ScopeRow icon={<Clock3 size={14} aria-hidden="true" />} label={copy.cadence} value={localized.cadence} />
            </section>
          </aside>
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
