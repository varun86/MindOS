'use client';

import { type ReactNode } from 'react';
import { WorkbenchPageShell } from '@/components/shared/ContentPageShell';

interface StudioShellProps {
  children: ReactNode;
}

export function StudioShell({ children }: StudioShellProps) {
  return (
    <WorkbenchPageShell
      as="main"
      className="studio-content-page min-h-[calc(100dvh-var(--app-titlebar-h))] bg-background"
      data-content-page-shell="studio"
    >
      {children}
    </WorkbenchPageShell>
  );
}
