import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils';

type ContentPageShellElement = 'div' | 'article' | 'section' | 'main';

export interface ContentPageShellProps extends HTMLAttributes<HTMLElement> {
  as?: ContentPageShellElement;
  children: ReactNode;
}

function ShellElement({
  as: Component = 'div',
  children,
  className,
  baseClassName,
  ...props
}: ContentPageShellProps & { baseClassName: string }) {
  return (
    <Component
      {...props}
      className={cn(baseClassName, className)}
    >
      {children}
    </Component>
  );
}

export function WorkbenchPageShell(props: ContentPageShellProps) {
  return (
    <ShellElement
      {...props}
      baseClassName="content-width workbench-content-page px-4 py-8 md:px-6 md:py-10"
    />
  );
}

export function ReadingPageShell(props: ContentPageShellProps) {
  return (
    <ShellElement
      {...props}
      baseClassName="content-width reading-content-page px-4 py-8 md:px-6 md:py-10"
    />
  );
}

export function NarrowPageShell(props: ContentPageShellProps) {
  return (
    <ShellElement
      {...props}
      baseClassName="mx-auto w-full max-w-3xl px-4 py-8 md:px-6 md:py-10"
    />
  );
}

export function LoadingPageShell({
  as = 'section',
  'aria-busy': ariaBusy,
  ...props
}: ContentPageShellProps) {
  return (
    <WorkbenchPageShell
      {...props}
      as={as}
      aria-busy={ariaBusy ?? true}
    />
  );
}

export function ContentPageShell(props: ContentPageShellProps) {
  return <WorkbenchPageShell {...props} />;
}
