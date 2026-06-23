'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { ChevronLeft, Sparkles } from 'lucide-react';
import type { VariantProps } from 'class-variance-authority';
import { ECHO_SEGMENT_HREF, type EchoSegment } from '@/lib/echo-segments';
import type { Messages } from '@/lib/i18n';
import { cn } from '@/lib/utils';
import { Button, buttonVariants } from '@/components/ui/button';
import { EchoHero } from './EchoHero';

type EchoCopy = Messages['echoPages'];

function echoAssistantActionLabel(segment: Exclude<EchoSegment, 'overview'>, p: EchoCopy): string {
  switch (segment) {
    case 'imprint':
      return p.assistantGenerateImprint;
    case 'threads':
      return p.threadsChatLabel;
    case 'growth':
      return p.growthChatLabel;
    case 'practice':
      return p.practiceChatLabel;
  }
}

function BackToOverviewLink({ label, ariaLabel }: { label: string; ariaLabel: string }) {
  return (
    <Link
      href={ECHO_SEGMENT_HREF.overview}
      aria-label={ariaLabel}
      className={cn(
        buttonVariants({ variant: 'ghost', size: 'sm' }),
        '-ml-2 w-fit text-muted-foreground',
      )}
    >
      <ChevronLeft size={15} strokeWidth={1.8} aria-hidden />
      {label}
    </Link>
  );
}

export function EchoPageHeader({
  p,
  segment,
  title,
  lead,
  titleId,
  actions,
}: {
  p: EchoCopy;
  segment: EchoSegment;
  title: string;
  lead: string;
  titleId: string;
  actions?: ReactNode;
}) {
  return (
    <EchoHero
      pageTitle={title}
      lead={lead}
      titleId={titleId}
      beforeTitle={segment === 'overview' ? undefined : (
        <div className="flex flex-wrap items-center gap-2">
          <BackToOverviewLink label={p.backToOverviewLabel} ariaLabel={p.backToOverviewAriaLabel} />
        </div>
      )}
      actions={actions}
    />
  );
}

export function EchoAssistantGenerateButton({
  p,
  segment,
  onGenerate,
  variant = 'amber',
  size = 'xl',
  className,
}: {
  p: EchoCopy;
  segment: Exclude<EchoSegment, 'overview'>;
  onGenerate: () => void;
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  className?: string;
}) {
  const label = echoAssistantActionLabel(segment, p);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={onGenerate}
      className={cn('shadow-sm', className)}
    >
      <Sparkles size={16} aria-hidden />
      {label}
    </Button>
  );
}
