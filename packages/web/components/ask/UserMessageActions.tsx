'use client';

import { useState, useCallback, useRef } from 'react';
import { Copy, Check, PenLine, RotateCcw } from 'lucide-react';
import { copyToClipboard } from '@/lib/clipboard';
import ActionTooltip from './ActionTooltip';

interface UserMessageActionsProps {
  content: string;
  isLastUserMessage: boolean;
  isLoading: boolean;
  onEdit?: () => void;
  onResend?: () => void;
  labels: {
    copy: string;
    edit: string;
    regenerate: string;
  };
}

/**
 * Hover action buttons for user message bubbles.
 * - Copy: always visible
 * - Edit + Resend: only on the last user message
 * Visibility and positioning are owned by MessageList's floating dock so these
 * controls never take space inside the message bubble.
 */
export default function UserMessageActions({
  content,
  isLastUserMessage,
  isLoading,
  onEdit,
  onResend,
  labels,
}: UserMessageActionsProps) {
  const [copied, setCopied] = useState(false);
  const resendCooldownRef = useRef(false);

  const handleCopy = useCallback(() => {
    copyToClipboard(content).then(ok => {
      if (ok) {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    });
  }, [content]);

  const handleResend = useCallback(() => {
    if (resendCooldownRef.current || isLoading) return;
    resendCooldownRef.current = true;
    setTimeout(() => { resendCooldownRef.current = false; }, 300);
    onResend?.();
  }, [onResend, isLoading]);

  const btnBase = 'hit-target-box inline-flex h-7 w-7 items-center justify-center text-muted-foreground transition-colors duration-75 touch-manipulation focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring [--hit-target-bg:transparent] [--hit-target-radius:var(--radius-sm)]';

  return (
    <div className="flex items-center gap-0.5">
      {/* Copy */}
      <ActionTooltip label={labels.copy}>
        <button
          type="button"
          onClick={handleCopy}
          aria-label={labels.copy}
          className={`${btnBase} hover:text-foreground [--hit-target-hover-bg:var(--muted)]`}
        >
          {copied
            ? <Check size={11} className="text-success" />
            : <Copy size={11} />}
        </button>
      </ActionTooltip>

      {/* Edit — last user message only, not during streaming */}
      {isLastUserMessage && !isLoading && onEdit && (
        <ActionTooltip label={labels.edit}>
          <button
            type="button"
            onClick={onEdit}
            aria-label={labels.edit}
            className={`${btnBase} hover:text-foreground [--hit-target-hover-bg:var(--muted)]`}
          >
            <PenLine size={11} />
          </button>
        </ActionTooltip>
      )}

      {/* Resend / Regenerate — last user message only, not during streaming */}
      {isLastUserMessage && !isLoading && onResend && (
        <ActionTooltip label={labels.regenerate}>
          <button
            type="button"
            onClick={handleResend}
            aria-label={labels.regenerate}
            className={`${btnBase} hover:text-[var(--amber)] [--hit-target-hover-bg:color-mix(in_srgb,var(--amber)_10%,transparent)]`}
          >
            <RotateCcw size={11} />
          </button>
        </ActionTooltip>
      )}
    </div>
  );
}
