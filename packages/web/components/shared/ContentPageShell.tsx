import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContentPageShellVariant = 'workbench' | 'reading' | 'narrow';

const CONTENT_PAGE_SHELL_VARIANTS: Record<ContentPageShellVariant, string> = {
  workbench: 'content-width workbench-content-page px-4 py-8 md:px-6 md:py-10',
  reading: 'content-width reading-content-page px-4 py-10 md:px-6 md:py-14',
  narrow: 'narrow-content-page mx-auto max-w-4xl px-4 md:px-6',
};

interface ContentPageShellProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  reserveTocSpace?: boolean;
  variant?: ContentPageShellVariant;
}

export function ContentPageShell({
  children,
  className,
  reserveTocSpace = false,
  variant = 'workbench',
  ...props
}: ContentPageShellProps) {
  return (
    <div
      {...props}
      className={cn(
        CONTENT_PAGE_SHELL_VARIANTS[variant],
        reserveTocSpace && 'toc-reserved-content',
        className,
      )}
    >
      {children}
    </div>
  );
}

type NamedPageShellProps = Omit<ContentPageShellProps, 'variant'>;

export function WorkbenchPageShell(props: NamedPageShellProps) {
  return <ContentPageShell {...props} variant="workbench" />;
}

export function ReadingPageShell(props: NamedPageShellProps) {
  return <ContentPageShell {...props} variant="reading" />;
}

export function NarrowPageShell(props: NamedPageShellProps) {
  return <ContentPageShell {...props} variant="narrow" />;
}

export function LoadingPageShell({
  className,
  variant = 'reading',
  ...props
}: ContentPageShellProps) {
  return (
    <ContentPageShell
      {...props}
      variant={variant}
      className={cn('animate-pulse', className)}
    />
  );
}
