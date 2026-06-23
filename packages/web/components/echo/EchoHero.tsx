'use client';

import type { ReactNode } from 'react';

export function EchoHero({
  pageTitle,
  lead,
  titleId,
  beforeTitle,
  actions,
  children,
}: {
  pageTitle: string;
  lead: string;
  titleId: string;
  beforeTitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="mb-6">
      {beforeTitle ? <div className="mb-3">{beforeTitle}</div> : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 id={titleId} className="text-2xl font-semibold tracking-tight text-foreground">
            {pageTitle}
          </h1>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-muted-foreground">{lead}</p>
        </div>
        {actions ? <div className="flex w-full shrink-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
