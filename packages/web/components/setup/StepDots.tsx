'use client';

import { CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';
import { cn } from '@/lib/utils';

export interface StepDotsProps {
  step: number;
  setStep: (s: number) => void;
  stepTitles: readonly string[];
  disabled?: boolean;
  /** Number of steps to show in the header progress rail. */
  numberedSteps?: number;
}

export default function StepDots({ step, setStep, stepTitles, disabled, numberedSteps }: StepDotsProps) {
  const { t } = useLocale();
  const count = numberedSteps ?? stepTitles.length;
  // Render the setup steps that should appear in the header progress rail.
  const dotsToShow = stepTitles.slice(0, count);
  const isConfirmStep = step >= count;

  return (
    <div className="mb-7 flex items-center gap-1" role="navigation" aria-label="Setup steps">
      {dotsToShow.map((title: string, i: number) => (
        <div key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <div
              className={cn(
                'h-px w-9 rounded-full',
                i <= step || isConfirmStep ? 'bg-success/35' : 'bg-border',
              )}
            />
          )}
          <button type="button" onClick={() => setStep(i)}
            aria-current={i === step ? 'step' : undefined}
            aria-label={title}
            className="group -m-1 flex flex-col items-center gap-1 p-1 transition-opacity disabled:cursor-not-allowed disabled:opacity-60"
            disabled={disabled || i > step}
            title={(disabled || i > step) ? t.hints.cannotJumpForward : undefined}>
            {(() => {
              const isDone = i < step || isConfirmStep;
              const isActive = i === step && !isConfirmStep;
              return (
            <div
              className={cn(
                'flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold',
                isDone && 'border-success/40 bg-background text-success',
                isActive && 'border-[var(--amber)] bg-[var(--amber)] text-[var(--amber-foreground)]',
                !isDone && !isActive && 'border-border bg-muted text-muted-foreground opacity-50',
              )}
            >
              {isDone ? <CheckCircle2 size={14} /> : i + 1}
            </div>
              );
            })()}
            <span
              className={cn(
                'hidden max-w-[4rem] truncate text-center text-[10px] leading-tight sm:inline',
                i === step && !isConfirmStep ? 'text-foreground' : 'text-muted-foreground',
                i <= step || isConfirmStep ? 'opacity-100' : 'opacity-50',
              )}
            >
              {title}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
