'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, LayoutDashboard, MessageSquare, Plus, Sparkles } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ContentPageShell } from '@/components/shared/ContentPageShell';
import { cn } from '@/lib/utils';
import type { ChatSession } from '@/lib/types';
import {
  getStudioProjectHref,
  localize,
  localizeList,
  sessionStatusLabel,
  type StudioProject,
  type StudioSessionSummary,
} from '@/lib/studio-projects';
import { summarizeChatSession } from './studio-session-summaries';

export interface StudioSidebarCopy {
  title: string;
  overview: string;
  recentProjects: string;
  newProject: string;
  sessions: string;
  noSessions: string;
  untitledSession: string;
  showSessions: string;
  hideSessions: string;
}

interface StudioShellProps {
  children: ReactNode;
  projects: StudioProject[];
  locale: string;
  copy: StudioSidebarCopy;
  chatSessions: ChatSession[];
  activeSessionId?: string | null;
  currentProjectId?: string | null;
  onCreateProject: () => void;
}

function firstKit(project: StudioProject): string {
  return project.kits[0] ?? 'Basic assistant';
}

function getSessionTitle(session: StudioSessionSummary, locale: string): string {
  return localize(session.title, session.titleZh, locale);
}

function StudioSessionLink({
  session,
  locale,
  copy,
}: {
  session: StudioSessionSummary;
  locale: string;
  copy: StudioSidebarCopy;
}) {
  const title = getSessionTitle(session, locale);
  const content = (
    <>
      <span className="min-w-0 truncate">{title}</span>
      <span className="shrink-0 text-[10px] font-medium text-muted-foreground/70">
        {sessionStatusLabel(session.status, locale)}
      </span>
    </>
  );

  if (!session.href) {
    return (
      <div className="flex min-h-8 items-center justify-between gap-2 rounded-md px-2 text-xs text-muted-foreground">
        {content}
      </div>
    );
  }

  return (
    <Link
      href={session.href}
      className="flex min-h-8 items-center justify-between gap-2 rounded-md px-2 text-xs text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      title={title || copy.untitledSession}
    >
      {content}
    </Link>
  );
}

function StudioProjectNavItem({
  project,
  locale,
  copy,
  sessions,
  selected,
  expanded,
  onToggle,
  onSelect,
}: {
  project: StudioProject;
  locale: string;
  copy: StudioSidebarCopy;
  sessions: StudioSessionSummary[];
  selected: boolean;
  expanded: boolean;
  onToggle: () => void;
  onSelect: () => void;
}) {
  const title = localize(project.title, project.titleZh, locale);
  const kits = localizeList(project.kits, undefined, locale);
  const sessionCount = sessions.length;
  const toggleLabel = expanded ? copy.hideSessions : copy.showSessions;

  return (
    <div className="rounded-lg">
      <div
        className={cn(
          'group flex min-w-0 items-center gap-1.5 rounded-lg border border-transparent px-1.5 py-1 transition-colors',
          selected ? 'border-border/70 bg-background/70' : 'hover:bg-muted/45',
        )}
      >
        <button
          type="button"
          aria-label={`${toggleLabel}: ${title}`}
          aria-expanded={expanded}
          onClick={onToggle}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {expanded ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
        </button>
        <Link
          href={getStudioProjectHref(project.id)}
          onClick={onSelect}
          className="min-w-0 flex-1 rounded-md px-1.5 py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block truncate text-sm font-medium text-foreground">{title}</span>
          <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
            {sessionCount} {copy.sessions} · {kits[0] ?? firstKit(project)}
          </span>
        </Link>
      </div>
      {expanded ? (
        <div
          className="ml-9 mt-1 space-y-0.5 border-l border-border/60 pl-2"
          role="list"
          aria-label={`${title} ${copy.sessions}`}
        >
          {sessions.length ? (
            sessions.slice(0, 6).map((session) => (
              <StudioSessionLink key={session.id} session={session} locale={locale} copy={copy} />
            ))
          ) : (
            <div className="px-2 py-2 text-xs text-muted-foreground/75">{copy.noSessions}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function StudioShell({
  children,
  projects,
  locale,
  copy,
  chatSessions,
  activeSessionId = null,
  currentProjectId = null,
  onCreateProject,
}: StudioShellProps) {
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(currentProjectId);

  useEffect(() => {
    if (currentProjectId) setExpandedProjectId(currentProjectId);
  }, [currentProjectId]);

  const realSessionsByProject = useMemo(() => {
    const map = new Map<string, StudioSessionSummary[]>();
    const sorted = [...chatSessions]
      .filter((session) => session.projectId)
      .sort((a, b) => b.updatedAt - a.updatedAt);

    for (const session of sorted) {
      if (!session.projectId) continue;
      const current = map.get(session.projectId) ?? [];
      current.push(summarizeChatSession(session, activeSessionId, copy.untitledSession));
      map.set(session.projectId, current);
    }

    return map;
  }, [activeSessionId, chatSessions, copy.untitledSession]);

  const visibleProjects = projects.slice(0, 7);

  const sessionsForProject = (project: StudioProject): StudioSessionSummary[] => {
    const realSessions = realSessionsByProject.get(project.id);
    return realSessions?.length ? realSessions : project.sessions;
  };

  return (
    <ContentPageShell
      as="main"
      className="studio-content-page min-h-[calc(100dvh-var(--app-titlebar-h))] bg-background"
      data-content-page-shell="studio"
    >
      <div className="grid min-w-0 gap-6 xl:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="min-w-0 xl:sticky xl:top-6 xl:self-start" aria-label={copy.title}>
          <div className="overflow-hidden rounded-xl border border-border/60 bg-card/45">
            <div className="flex min-h-14 items-center justify-between gap-3 border-b border-border/60 px-3.5">
              <div className="flex min-w-0 items-center gap-2">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--amber-subtle)] text-[var(--amber)]">
                  <Sparkles size={15} aria-hidden="true" />
                </span>
                <span className="truncate text-sm font-semibold text-foreground">{copy.title}</span>
              </div>
              <button
                type="button"
                onClick={onCreateProject}
                aria-label={copy.newProject}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Plus size={15} aria-hidden="true" />
              </button>
            </div>

            <nav className="space-y-5 px-3 py-3">
              <Link
                href="/studio"
                className={cn(
                  'flex min-h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  currentProjectId
                    ? 'text-muted-foreground hover:bg-muted/55 hover:text-foreground'
                    : 'bg-background/75 text-foreground shadow-sm',
                )}
              >
                <LayoutDashboard size={15} className="shrink-0 text-[var(--amber)]" aria-hidden="true" />
                {copy.overview}
              </Link>

              <section aria-labelledby="studio-sidebar-recent-projects">
                <div
                  id="studio-sidebar-recent-projects"
                  className="mb-2 flex items-center gap-2 px-2 text-[11px] font-semibold uppercase text-muted-foreground"
                >
                  <MessageSquare size={12} className="text-[var(--amber)]" aria-hidden="true" />
                  {copy.recentProjects}
                </div>
                <div className="space-y-1">
                  {visibleProjects.map((project) => {
                    const selected = currentProjectId === project.id;
                    const expanded = selected || expandedProjectId === project.id;
                    return (
                      <StudioProjectNavItem
                        key={project.id}
                        project={project}
                        locale={locale}
                        copy={copy}
                        sessions={sessionsForProject(project)}
                        selected={selected}
                        expanded={expanded}
                        onToggle={() => setExpandedProjectId(expanded ? null : project.id)}
                        onSelect={() => setExpandedProjectId(project.id)}
                      />
                    );
                  })}
                </div>
              </section>
            </nav>
          </div>
        </aside>

        <div className="min-w-0">{children}</div>
      </div>
    </ContentPageShell>
  );
}
