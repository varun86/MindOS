'use client';

import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { FilePenLine, History, X } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { agentReviewHref } from '@/lib/agent-review-links';
import { useAgentChangeReview } from '@/hooks/useAgentChangeReview';

export default function ChangesBanner() {
  const [dismissedAtCount, setDismissedAtCount] = useState<number | null>(null);
  const [autoDismissed, setAutoDismissed] = useState(false);
  const prevUnreadRef = useRef(0);
  const [isRendered, setIsRendered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const pathname = usePathname();
  const { t } = useLocale();
  const review = useAgentChangeReview();
  const hasAgentReview = review.unreadAgentCount > 0;
  const activeUnreadCount = hasAgentReview ? review.unreadAgentCount : review.unreadCount;
  const reviewHref = hasAgentReview ? agentReviewHref() : '/changelog';
  const notice = hasAgentReview
    ? {
        title: t.changes.agentReviewNoticeTitle(review.unreviewedPathCount),
        description: t.changes.agentReviewNoticeMeta(review.unreadAgentCount),
        action: t.changes.reviewAgentChanges,
        Icon: FilePenLine,
      }
    : {
        title: t.changes.activityNoticeTitle(activeUnreadCount),
        description: t.changes.activityNoticeMeta,
        action: t.changes.viewActivity,
        Icon: History,
      };

  // Re-show banner when new changes arrive after auto-dismiss
  useEffect(() => {
    if (activeUnreadCount > prevUnreadRef.current && autoDismissed) {
      setAutoDismissed(false);
    }
    prevUnreadRef.current = activeUnreadCount;
  }, [activeUnreadCount, autoDismissed]);

  const shouldShow = useMemo(() => {
    if (activeUnreadCount <= 0) return false;
    if (pathname?.startsWith('/changes') || pathname?.startsWith('/changelog')) return false;
    if (dismissedAtCount !== null && activeUnreadCount <= dismissedAtCount) return false;
    if (autoDismissed) return false;
    return true;
  }, [activeUnreadCount, dismissedAtCount, pathname, autoDismissed]);

  // Ordinary activity is a light notification; agent edits are a review task.
  useEffect(() => {
    if (!shouldShow || hasAgentReview) return;
    const timer = setTimeout(() => setAutoDismissed(true), 10_000);
    return () => clearTimeout(timer);
  }, [hasAgentReview, shouldShow]);

  useEffect(() => {
    const durationMs = 160;
    if (shouldShow) {
      setIsRendered(true);
      const raf = requestAnimationFrame(() => setIsVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setIsVisible(false);
    const timer = setTimeout(() => setIsRendered(false), durationMs);
    return () => clearTimeout(timer);
  }, [shouldShow]);

  if (!isRendered) return null;

  const Icon = notice.Icon;
  const containerClass = hasAgentReview
    ? 'fixed right-3 top-[calc(var(--app-titlebar-h)+60px)] z-app-popover w-[calc(100vw-24px)] max-w-[360px] transition-all duration-150 ease-out md:right-6 md:top-[calc(var(--app-titlebar-h)+12px)] md:w-[360px]'
    : 'fixed bottom-4 right-3 z-app-popover w-[calc(100vw-24px)] max-w-[360px] transition-all duration-150 ease-out md:bottom-6 md:right-6 md:w-[360px]';

  return (
    <div
      data-changes-banner
      data-changes-banner-kind={hasAgentReview ? 'agent-review' : 'activity'}
      className={`${containerClass} ${
        isVisible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 -translate-y-2 scale-[0.98] pointer-events-none'
      }`}
    >
      <div
        className="rounded-xl border border-border/80 bg-card/95 px-3.5 py-3 shadow-lg backdrop-blur"
      >
        <div className="flex items-start gap-3">
          <span
            className={`mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
              hasAgentReview
                ? 'bg-[var(--amber-subtle)] text-[var(--amber)]'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <Icon size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium leading-5 text-foreground">
                  {notice.title}
                </p>
                <p className="mt-0.5 text-xs leading-4 text-muted-foreground">
                  {notice.description}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedAtCount(activeUnreadCount)}
                aria-label={t.changes.dismiss}
                className="hit-target-box -mr-1 -mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center text-muted-foreground hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring [--hit-target-hover-bg:color-mix(in_srgb,var(--muted)_60%,transparent)] [--hit-target-radius:var(--radius-md)]"
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
            <div className="mt-2.5 flex items-center">
              <Link
                href={reviewHref}
                className={`hit-target-box inline-flex items-center px-2.5 py-1 text-xs font-medium focus-visible:ring-2 focus-visible:ring-ring [--hit-target-radius:var(--radius-md)] ${
                  hasAgentReview
                    ? 'text-[var(--amber-foreground)] hover:opacity-90 [--hit-target-bg:var(--amber)] [--hit-target-hover-bg:var(--amber)]'
                    : 'text-foreground hover:text-foreground [--hit-target-bg:var(--muted)] [--hit-target-hover-bg:var(--muted)]'
                }`}
              >
                {notice.action}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
