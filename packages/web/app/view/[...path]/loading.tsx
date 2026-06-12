import { LoadingPageShell } from '@/components/shared/ContentPageShell';

/**
 * File viewer skeleton — shown while file content loads.
 * Matches the prose layout with heading + paragraph blocks.
 */
export default function Loading() {
  return (
    <LoadingPageShell aria-busy="true" aria-label="Loading">
      {/* Title skeleton */}
      <div className="h-8 w-64 bg-muted rounded mb-3" />
      <div className="h-px w-full bg-border mb-8" />

      {/* Paragraph skeletons */}
      <div className="space-y-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-2">
            {i % 2 === 0 && <div className="h-5 w-40 bg-muted rounded mb-3" />}
            <div className="h-3.5 w-full bg-muted rounded" />
            <div className="h-3.5 w-full bg-muted rounded" />
            <div className="h-3.5 w-3/4 bg-muted rounded" />
          </div>
        ))}

        {/* Code block skeleton */}
        <div className="rounded-lg border border-border p-4 space-y-2">
          <div className="h-3 w-48 bg-muted rounded" />
          <div className="h-3 w-64 bg-muted rounded" />
          <div className="h-3 w-36 bg-muted rounded" />
        </div>

        {/* More paragraphs */}
        <div className="space-y-2">
          <div className="h-3.5 w-full bg-muted rounded" />
          <div className="h-3.5 w-5/6 bg-muted rounded" />
        </div>
      </div>
    </LoadingPageShell>
  );
}
