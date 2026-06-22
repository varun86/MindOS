'use client';

import PanelHeader from './PanelHeader';

export default function PanelLoadingFallback({
  title,
  panelId,
  rows = 5,
}: {
  title: string;
  panelId: string;
  rows?: number;
}) {
  return (
    <div className="flex h-full flex-col" data-panel-loading-fallback={panelId}>
      <PanelHeader title={title} />
      <div
        className="sidebar-scroll-area min-h-0 flex-1 px-3 py-3"
        aria-busy="true"
        aria-label={title}
        role="status"
      >
        <div className="space-y-2">
          {Array.from({ length: rows }).map((_, index) => (
            <div
              key={index}
              className="flex items-center gap-3 rounded-sm px-1 py-2.5 motion-safe:animate-pulse"
              aria-hidden="true"
            >
              <div className="h-7 w-7 shrink-0 rounded-md bg-muted/70" />
              <div className="h-3.5 flex-1 rounded bg-muted/60" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
