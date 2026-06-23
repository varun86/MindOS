'use client';

/**
 * Daily Echo Report Generate Button
 *
 * Triggers client-side report generation and shows loading/error states.
 */

import { useState, useCallback } from 'react';
import { Zap, AlertCircle, Loader2 } from 'lucide-react';
import type { DailyEchoReport } from '@/lib/daily-echo/types';
import { generateDailyEchoReport } from '@/lib/daily-echo/generator';
import { loadDailyEchoConfig } from '@/lib/daily-echo/config';
import type { VariantProps } from 'class-variance-authority';
import { Button, buttonVariants } from '@/components/ui/button';

interface DailyEchoReportButtonProps {
  onGenerated: (report: DailyEchoReport) => void;
  onError: (error: string) => void;
  locale?: { t: Record<string, any> };
  variant?: VariantProps<typeof buttonVariants>['variant'];
  size?: VariantProps<typeof buttonVariants>['size'];
  className?: string;
}

export default function DailyEchoReportButton({
  onGenerated,
  onError,
  locale,
  variant = 'amber',
  size = 'xl',
  className,
}: DailyEchoReportButtonProps) {
  const t = locale?.t || {};
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGenerate = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const config = loadDailyEchoConfig();
      const report = await generateDailyEchoReport(new Date(), config);
      onGenerated(report);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Unknown error';
      setError(message);
      onError(message);
    } finally {
      setIsLoading(false);
    }
  }, [onGenerated, onError]);

  if (error) {
    return (
      <Button
        onClick={handleGenerate}
        disabled={isLoading}
        variant="destructive"
        size={size}
        type="button"
        title={error}
        className={className}
      >
        <AlertCircle size={16} className="shrink-0" />
        <span>
          {isLoading
            ? t.dailyReportGenerating || 'Generating…'
            : t.dailyReportRetry || 'Retry'}
        </span>
      </Button>
    );
  }

  return (
    <Button
      onClick={handleGenerate}
      disabled={isLoading}
      variant={variant}
      size={size}
      type="button"
      aria-busy={isLoading}
      className={className}
    >
      {isLoading ? (
        <>
          <Loader2 size={16} className="animate-spin shrink-0" />
          <span>{t.dailyReportGenerating || 'Generating…'}</span>
        </>
      ) : (
        <>
          <Zap size={16} />
          <span>{t.dailyReportGenerate || 'Generate report'}</span>
        </>
      )}
    </Button>
  );
}
