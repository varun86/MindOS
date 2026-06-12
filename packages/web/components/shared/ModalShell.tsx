'use client';

import type { HTMLAttributes, MouseEventHandler, ReactNode } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type ModalShellVariant = 'compact' | 'command' | 'ask' | 'settings' | 'fullscreenSetup';

const MODAL_OVERLAY_VARIANTS: Record<ModalShellVariant, string> = {
  compact: 'items-center justify-center p-4',
  command: 'items-end justify-center p-0 md:items-start md:pt-[15vh]',
  ask: 'items-end justify-center p-0 md:items-start md:pt-[10vh]',
  settings: 'items-end justify-center p-0 md:items-start md:pt-[10vh]',
  fullscreenSetup: 'items-stretch justify-stretch overflow-y-auto',
};

const MODAL_FRAME_VARIANTS: Record<ModalShellVariant, string> = {
  compact: 'w-full max-w-md rounded-xl border border-border bg-card shadow-xl',
  command: 'w-full rounded-t-2xl border border-border bg-card shadow-2xl md:max-w-xl md:rounded-xl',
  ask: 'flex w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl md:max-h-[75vh] md:max-w-2xl md:rounded-xl',
  settings: 'flex h-[88vh] w-full flex-col rounded-t-2xl border border-border bg-card shadow-2xl md:h-[80vh] md:max-w-4xl md:rounded-xl lg:max-w-5xl',
  fullscreenSetup: 'flex min-h-full w-full flex-col bg-background',
};

interface ModalShellProps extends HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
  ariaLabelledBy?: string;
  children: ReactNode;
  closeDisabled?: boolean;
  closeOnBackdrop?: boolean;
  frameClassName?: string;
  onClose?: () => void;
  overlayClassName?: string;
  role?: 'dialog' | 'alertdialog';
  variant?: ModalShellVariant;
}

export function ModalShell({
  ariaLabel,
  ariaLabelledBy,
  children,
  className,
  closeDisabled = false,
  closeOnBackdrop = true,
  frameClassName,
  onClick,
  onClose,
  overlayClassName,
  role = 'dialog',
  variant = 'compact',
  ...props
}: ModalShellProps) {
  const handleOverlayClick: MouseEventHandler<HTMLDivElement> = (event) => {
    onClick?.(event);
    if (event.defaultPrevented || !closeOnBackdrop || closeDisabled || !onClose) return;
    if (event.target === event.currentTarget) onClose();
  };

  return (
    <div
      {...props}
      className={cn(
        'fixed inset-0 z-app-modal flex modal-backdrop',
        MODAL_OVERLAY_VARIANTS[variant],
        overlayClassName,
        className,
      )}
      onClick={handleOverlayClick}
    >
      <div
        role={role}
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        className={cn(
          'animate-in fade-in-0 zoom-in-95 duration-200',
          MODAL_FRAME_VARIANTS[variant],
          frameClassName,
        )}
        data-modal-shell={variant}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

interface ModalHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  closeLabel: string;
  icon?: ReactNode;
  onClose?: () => void;
  title: ReactNode;
  titleClassName?: string;
  titleId?: string;
}

export function ModalHeader({
  className,
  closeLabel,
  icon,
  onClose,
  title,
  titleClassName,
  titleId,
  ...props
}: ModalHeaderProps) {
  return (
    <div
      {...props}
      className={cn('flex items-center justify-between border-b border-border px-5 py-4', className)}
    >
      <div className="flex min-w-0 items-center gap-2">
        {icon}
        <h3 id={titleId} className={cn('truncate text-sm font-semibold text-foreground', titleClassName)}>
          {title}
        </h3>
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="hit-target-box p-1 text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring [--hit-target-hover-bg:var(--muted)] [--hit-target-radius:var(--radius-md)]"
          aria-label={closeLabel}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}

export function ModalFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn('flex items-center justify-end gap-2 border-t border-border px-5 py-3', className)}
    />
  );
}
