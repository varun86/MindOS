'use client';

import { CheckCircle2 } from 'lucide-react';
import { useLocale } from '@/lib/stores/locale-store';

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
              className="h-px w-9 rounded-full"
              style={{ background: i <= step || isConfirmStep ? 'color-mix(in srgb, var(--success) 42%, var(--border))' : 'var(--border)' }}
            />
          )}
          <button onClick={() => setStep(i)}
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
              className="flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold"
              style={{
                background: isDone ? 'var(--background)' : isActive ? 'var(--amber)' : 'var(--muted)',
                borderColor: isDone ? 'color-mix(in srgb, var(--success) 40%, var(--border))' : isActive ? 'color-mix(in srgb, var(--amber) 68%, transparent)' : 'var(--border)',
                color: isDone ? 'var(--success)' : isActive ? 'var(--amber-foreground)' : 'var(--muted-foreground)',
                opacity: isDone || isActive ? 1 : 0.5,
              }}>
              {isDone ? <CheckCircle2 size={14} /> : i + 1}
            </div>
              );
            })()}
            <span className="text-[10px] leading-tight hidden sm:inline max-w-[4rem] text-center truncate"
              style={{ color: (i === step && !isConfirmStep) ? 'var(--foreground)' : 'var(--muted-foreground)', opacity: (i <= step || isConfirmStep) ? 1 : 0.5 }}>
              {title}
            </span>
          </button>
        </div>
      ))}
    </div>
  );
}
