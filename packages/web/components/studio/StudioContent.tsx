'use client';

import Link from 'next/link';
import {
  ArrowRight,
  BookOpenText,
  CheckCircle2,
  FolderOpen,
  ListChecks,
  Plus,
  Sparkles,
  Target,
  Zap,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { useLocale } from '@/lib/stores/locale-store';
import { refreshSessions, useActiveSessionId, useSessions } from '@/lib/ask-session-store';
import { useSmoothRouterPush } from '@/hooks/useSmoothRouterPush';
import {
  createStudioProject,
  getStudioProjectHref,
  localize,
  localizeList,
  readStudioProjects,
  stageLabel,
  type StudioProject,
  type StudioProjectDraft,
} from '@/lib/studio-projects';
import { getChatSessionTitle } from './studio-session-summaries';
import { StudioShell } from './StudioShell';
import StudioNewProjectDialog from './StudioNewProjectDialog';

const COPY = {
  en: {
    eyebrow: 'Project practice',
    title: 'Studio',
    subtitle: 'Projects that keep context, capability, sessions, and review in one durable place.',
    overview: 'Overview',
    recentProjects: 'Recent Projects',
    newProject: 'New Project',
    projects: 'Projects',
    projectsHint: 'Long-running work, training, and review loops.',
    projectColumn: 'Project',
    scopeColumn: 'Scope',
    nextColumn: 'Next',
    sessions: 'sessions',
    activeProjects: 'Active',
    reviewItems: 'Review',
    recentSessions: 'Sessions',
    focusTitle: 'Focus Project',
    focusHint: 'Current practice state',
    openProject: 'Open Project',
    latestSession: 'Latest Session',
    reusableLesson: 'Reusable lesson',
    untitledSession: 'Untitled Session',
    context: 'Space',
    capability: 'AI Kit',
    workArea: 'Work Area',
    review: 'Review',
    growth: 'Growth',
    loopTitle: 'Practice loop',
    loopSteps: ['Context', 'Session', 'Review', 'Improve'],
    createTitle: 'New Project',
    createDescription: 'Set up the durable path for this Project before starting the first focused Session.',
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
    empty: 'No projects yet.',
    noSessions: 'No Sessions yet.',
    showSessions: 'Show sessions',
    hideSessions: 'Hide sessions',
    setupTitle: 'Project setup',
    setupDescription: 'Start with the work area, then choose the durable context and the AI capability package.',
    workAreaDescription: 'Where drafts, artifacts, and working files should collect for this Project.',
    spaceDescription: 'The long-term Mind Space this Project can read from and promote durable memory into.',
    kitDescription: 'The default AI capability set used when a focused Session starts inside this Project.',
    customValue: 'Custom value',
    projectDetailsTitle: 'Project details',
    projectDetailsDescription: 'Keep the name short and make the goal concrete enough to start the first Session.',
    selectedSummary: 'Selected setup',
    fromRecentProject: 'Recent Project',
  },
  zh: {
    eyebrow: 'Project 实践',
    title: 'Studio',
    subtitle: '用 Project 把上下文、AI 能力、历史 Session 和复盘放在一个可持续推进的位置。',
    overview: 'Overview',
    recentProjects: 'Recent Projects',
    newProject: '新建 Project',
    projects: 'Projects',
    projectsHint: '长期工作、训练和复盘循环。',
    projectColumn: 'Project',
    scopeColumn: '范围',
    nextColumn: '下一步',
    sessions: 'Sessions',
    activeProjects: '推进中',
    reviewItems: '待复盘',
    recentSessions: '历史 Session',
    focusTitle: '当前 Project',
    focusHint: '当前实践状态',
    openProject: '打开 Project',
    latestSession: '最近 Session',
    reusableLesson: '可复用经验',
    untitledSession: '未命名 Session',
    context: 'Space',
    capability: 'AI Kit',
    workArea: 'Work Area',
    review: 'Review',
    growth: 'Growth',
    loopTitle: '实践循环',
    loopSteps: ['上下文', 'Session', '复盘', '改进'],
    createTitle: '新建 Project',
    createDescription: '先把这个 Project 的长期路径设置清楚，再开启第一个聚焦 Session。',
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
    empty: '还没有 Project。',
    noSessions: '还没有 Session。',
    showSessions: '展开 Sessions',
    hideSessions: '收起 Sessions',
    setupTitle: 'Project 设置',
    setupDescription: '从 Work Area 开始，再选择长期上下文和默认 AI 能力。',
    workAreaDescription: '这个 Project 的草稿、产物和工作文件优先沉淀的位置。',
    spaceDescription: '这个 Project 读取并长期沉淀记忆的 Mind Space。',
    kitDescription: '在这个 Project 内开启 Session 时默认使用的 AI 能力组合。',
    customValue: '自定义',
    projectDetailsTitle: 'Project 细节',
    projectDetailsDescription: '名称保持短，目标要具体到能直接开启第一个 Session。',
    selectedSummary: '已选设置',
    fromRecentProject: '来自近期 Project',
  },
} as const;

type StudioCopy = (typeof COPY)[keyof typeof COPY];

function countReviewItems(projects: StudioProject[]): number {
  return projects.reduce((total, project) => total + project.reviewItems.length, 0);
}

function firstKit(project: StudioProject): string {
  return project.kits[0] ?? 'Basic assistant';
}

function ProjectStage({ project, locale }: { project: StudioProject; locale: string }) {
  return (
    <span className="inline-flex h-6 items-center rounded-md border border-border/60 bg-background/70 px-2 text-[11px] font-medium text-muted-foreground">
      {stageLabel(project.stage, locale)}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  const width = Math.max(0, Math.min(value, 100));
  return (
    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
      <div className="h-full rounded-full bg-[var(--amber)]" style={{ width: `${width}%` }} />
    </div>
  );
}

function StudioStat({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string | number;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3 rounded-lg border border-border/55 bg-card/55 px-3 py-2.5">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-[var(--amber-subtle)] text-[var(--amber)]">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm font-semibold text-foreground [font-variant-numeric:tabular-nums]">{value}</div>
      </div>
    </div>
  );
}

function PracticeLoop({ copy }: { copy: StudioCopy }) {
  return (
    <div className="rounded-lg border border-border/55 bg-card/45 px-3 py-3 sm:col-span-3 lg:col-span-1">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="text-xs font-semibold text-foreground">{copy.loopTitle}</div>
        <Sparkles size={14} className="text-[var(--amber)]" />
      </div>
      <div className="grid grid-cols-4 gap-1.5">
        {copy.loopSteps.map((step, index) => (
          <div key={step} className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--amber)]" />
              {index < copy.loopSteps.length - 1 ? <span className="h-px min-w-0 flex-1 bg-border/70" /> : null}
            </div>
            <div className="mt-2 truncate text-[11px] font-medium text-muted-foreground">{step}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ProjectRow({
  project,
  locale,
  copy,
  sessionCount,
  onPreview,
  selected,
}: {
  project: StudioProject;
  locale: string;
  copy: StudioCopy;
  sessionCount: number;
  onPreview: (projectId: string) => void;
  selected: boolean;
}) {
  const title = localize(project.title, project.titleZh, locale);
  const goal = localize(project.goal, project.goalZh, locale);
  const space = localize(project.space, project.spaceZh, locale);
  const workArea = localize(project.workArea, project.workAreaZh, locale);
  const nextAction = localize(project.nextAction, project.nextActionZh, locale);
  const kits = localizeList(project.kits, undefined, locale);

  return (
    <Link
      href={getStudioProjectHref(project.id)}
      onFocus={() => onPreview(project.id)}
      onPointerEnter={() => onPreview(project.id)}
      className={`group relative grid gap-4 border-t border-border/60 px-4 py-4 transition-colors first:border-t-0 hover:bg-card/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring lg:grid-cols-[minmax(0,1fr)_minmax(180px,0.58fr)] ${
        selected ? 'bg-card/60' : ''
      }`}
    >
      <span className={`pointer-events-none absolute bottom-4 left-0 top-4 w-px rounded-r-full transition-colors group-hover:bg-[var(--amber)] ${
        selected ? 'bg-[var(--amber)]' : 'bg-transparent'
      }`} />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="min-w-0 text-sm font-semibold text-foreground">{title}</h3>
          <ProjectStage project={project} locale={locale} />
        </div>
        <p className="mt-1 max-w-[54ch] text-xs leading-relaxed text-muted-foreground">{goal}</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
            <BookOpenText size={13} className="shrink-0 text-[var(--amber)]" />
            <span className="truncate">{space}</span>
          </span>
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
            <Zap size={13} className="shrink-0 text-[var(--amber)]" />
            <span className="truncate">{kits.length ? kits.join(' / ') : firstKit(project)}</span>
          </span>
          <span className="flex min-w-0 max-w-full items-center gap-1.5 text-xs text-muted-foreground">
            <FolderOpen size={13} className="shrink-0 text-[var(--amber)]" />
            <span className="truncate">{workArea}</span>
          </span>
        </div>
        <div className="mt-3 flex max-w-sm items-center gap-3">
          <ProgressBar value={project.progress} />
          <span className="shrink-0 text-[11px] font-medium text-muted-foreground [font-variant-numeric:tabular-nums]">
            {project.progress}%
          </span>
        </div>
      </div>

      <div className="flex min-w-0 items-start justify-between gap-3 lg:border-l lg:border-border/50 lg:pl-4">
        <div className="min-w-0">
          <p className="text-xs leading-relaxed text-foreground">{nextAction}</p>
          <p className="mt-2 text-[11px] font-medium text-muted-foreground">
            {sessionCount} {copy.sessions} · {project.updated}
          </p>
        </div>
        <ArrowRight size={16} className="mt-0.5 shrink-0 text-muted-foreground/45 transition-colors group-hover:text-[var(--amber)]" />
      </div>
    </Link>
  );
}

function ProjectFocusPanel({
  project,
  locale,
  copy,
  latestSessionTitle,
}: {
  project: StudioProject | undefined;
  locale: string;
  copy: StudioCopy;
  latestSessionTitle?: string;
}) {
  if (!project) return null;

  const title = localize(project.title, project.titleZh, locale);
  const space = localize(project.space, project.spaceZh, locale);
  const workArea = localize(project.workArea, project.workAreaZh, locale);
  const nextAction = localize(project.nextAction, project.nextActionZh, locale);
  const latestSession = project.sessions[0];
  const fallbackLatestSessionTitle = latestSession
    ? localize(latestSession.title, latestSession.titleZh, locale)
    : copy.empty;
  const reviewItems = localizeList(project.reviewItems, project.reviewItemsZh, locale);
  const lessons = localizeList(project.lessons, project.lessonsZh, locale);

  return (
    <aside className="lg:sticky lg:top-6 lg:self-start">
      <div className="overflow-hidden rounded-xl border border-border/60 bg-card/45">
        <div className="border-b border-border/60 px-4 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-medium text-muted-foreground">{copy.focusTitle}</p>
              <h2 className="mt-1 truncate text-base font-semibold text-foreground">{title}</h2>
            </div>
            <ProjectStage project={project} locale={locale} />
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{copy.focusHint}</p>
        </div>

        <div className="px-4 py-4">
          <div className="rounded-lg border border-border/60 bg-background/45 p-3">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="font-medium text-muted-foreground">{copy.nextColumn}</span>
              <span className="font-medium text-foreground [font-variant-numeric:tabular-nums]">{project.progress}%</span>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground">{nextAction}</p>
            <div className="mt-3">
              <ProgressBar value={project.progress} />
            </div>
          </div>

          <dl className="mt-4 space-y-3">
            <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-3 first:border-t-0 first:pt-0">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <BookOpenText size={13} className="text-[var(--amber)]" />
                {copy.context}
              </dt>
              <dd className="max-w-[170px] text-right text-xs font-medium leading-relaxed text-foreground">{space}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <FolderOpen size={13} className="text-[var(--amber)]" />
                {copy.workArea}
              </dt>
              <dd className="max-w-[170px] text-right text-xs font-medium leading-relaxed text-foreground">{workArea}</dd>
            </div>
            <div className="flex items-start justify-between gap-3 border-t border-border/50 pt-3">
              <dt className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle2 size={13} className="text-[var(--amber)]" />
                {copy.latestSession}
              </dt>
              <dd className="max-w-[170px] text-right text-xs font-medium leading-relaxed text-foreground">{latestSessionTitle ?? fallbackLatestSessionTitle}</dd>
            </div>
          </dl>

          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.review}</div>
            <div className="space-y-1.5">
              {reviewItems.slice(0, 3).map((item) => (
                <div key={item} className="flex items-start gap-2 text-xs leading-relaxed text-foreground">
                  <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--amber)]" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 border-t border-border/50 pt-4">
            <div className="mb-2 text-xs font-medium text-muted-foreground">{copy.reusableLesson}</div>
            <p className="text-xs leading-relaxed text-foreground">
              {lessons[0] ?? nextAction}
            </p>
          </div>

          <Link
            href={getStudioProjectHref(project.id)}
            className="mt-5 inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-[var(--amber)]/45 hover:bg-[var(--amber-subtle)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {copy.openProject}
            <ArrowRight size={15} />
          </Link>
        </div>
      </div>
    </aside>
  );
}

export default function StudioContent() {
  const push = useSmoothRouterPush();
  const { locale } = useLocale();
  const copy = locale === 'zh' ? COPY.zh : COPY.en;
  const [projects, setProjects] = useState<StudioProject[]>(() => readStudioProjects());
  const [isCreating, setIsCreating] = useState(false);
  const [previewProjectId, setPreviewProjectId] = useState<string | null>(null);
  const chatSessions = useSessions();
  const activeSessionId = useActiveSessionId();

  useEffect(() => {
    setProjects(readStudioProjects());
    void refreshSessions();
  }, []);

  const projectSessionStats = useMemo(() => {
    const stats = new Map<string, { count: number; latestTitle?: string }>();
    const sortedSessions = [...chatSessions]
      .filter((session) => session.projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    for (const session of sortedSessions) {
      const projectId = session.projectId;
      if (!projectId) continue;
      const previous = stats.get(projectId);
      stats.set(projectId, {
        count: (previous?.count ?? 0) + 1,
        latestTitle: previous?.latestTitle ?? getChatSessionTitle(session, copy.untitledSession),
      });
    }

    return stats;
  }, [chatSessions, copy.untitledSession]);

  const getProjectSessionCount = (project: StudioProject): number => (
    projectSessionStats.get(project.id)?.count ?? project.sessions.length
  );

  const stats = useMemo(
    () => ({
      active: projects.filter((project) => project.stage === 'active').length,
      review: countReviewItems(projects),
      sessions: projects.reduce((total, project) => total + getProjectSessionCount(project), 0),
    }),
    [projectSessionStats, projects],
  );
  const previewProject = useMemo(
    () => projects.find((project) => project.id === previewProjectId) ?? projects[0],
    [previewProjectId, projects],
  );
  const previewProjectIdResolved = previewProject?.id;

  const handleCreate = (draft: StudioProjectDraft) => {
    const project = createStudioProject(draft);
    setProjects(readStudioProjects());
    setIsCreating(false);
    push(getStudioProjectHref(project.id));
  };

  return (
    <StudioShell
      projects={projects}
      locale={locale}
      copy={copy}
      chatSessions={chatSessions}
      activeSessionId={activeSessionId}
      onCreateProject={() => setIsCreating(true)}
    >
      <div className="min-w-0">
        <header className="mb-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <div className="mb-3 inline-flex items-center gap-2 rounded-md border border-border/70 bg-card/70 px-2.5 py-1 text-xs font-medium text-muted-foreground">
                <Sparkles size={12} className="text-[var(--amber)]" />
                {copy.eyebrow}
              </div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                {copy.title}
              </h1>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">{copy.subtitle}</p>
            </div>

            <button
              type="button"
              onClick={() => setIsCreating(true)}
              className="inline-flex h-10 w-fit items-center gap-2 rounded-lg bg-[var(--amber)] px-4 text-sm font-medium text-[var(--amber-foreground)] transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Plus size={15} />
              {copy.newProject}
            </button>
          </div>
        </header>

        <div className="mb-6 grid gap-2 sm:grid-cols-3 xl:grid-cols-[repeat(3,minmax(0,1fr))_minmax(260px,1.1fr)]">
          <StudioStat icon={<Target size={15} />} label={copy.activeProjects} value={stats.active} />
          <StudioStat icon={<ListChecks size={15} />} label={copy.reviewItems} value={stats.review} />
          <StudioStat icon={<CheckCircle2 size={15} />} label={copy.recentSessions} value={stats.sessions} />
          <PracticeLoop copy={copy} />
        </div>

        <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 overflow-hidden rounded-xl border border-border/60 bg-card/45">
            <div className="flex flex-col gap-3 border-b border-border/60 px-4 py-4 md:flex-row md:items-end md:justify-between">
              <div>
                <h2 className="text-sm font-semibold text-foreground">{copy.projects}</h2>
                <p className="mt-1 text-xs text-muted-foreground">{copy.projectsHint}</p>
              </div>
            </div>
            {projects.length ? (
              projects.map((project) => (
                <ProjectRow
                  key={project.id}
                  project={project}
                  locale={locale}
                  copy={copy}
                  sessionCount={getProjectSessionCount(project)}
                  onPreview={setPreviewProjectId}
                  selected={project.id === previewProjectIdResolved}
                />
              ))
            ) : (
              <div className="px-4 py-12 text-center text-sm text-muted-foreground">{copy.empty}</div>
            )}
          </div>

          <ProjectFocusPanel
            project={previewProject}
            locale={locale}
            copy={copy}
            latestSessionTitle={previewProject ? projectSessionStats.get(previewProject.id)?.latestTitle : undefined}
          />
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
