'use client';

import { useEffect, type RefObject } from 'react';

export const FLOATING_SURFACE_CLASS =
  'fixed z-50 rounded-lg border border-border bg-background shadow-lg';

export const FLOATING_CARD_SURFACE_CLASS =
  'fixed z-50 rounded-lg border border-border bg-card shadow-lg';

export function useDismissableFloatingLayer({
  enabled,
  refs,
  onClose,
  delayMouseDown = false,
}: {
  enabled: boolean;
  refs: Array<RefObject<HTMLElement | null>>;
  onClose: () => void;
  delayMouseDown?: boolean;
}) {
  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    };

    const handleMouseDown = (event: MouseEvent) => {
      const target = event.target as Node | null;
      if (target && refs.some((ref) => ref.current?.contains(target))) return;
      onClose();
    };

    document.addEventListener('keydown', handleKeyDown);
    const timer = delayMouseDown
      ? window.setTimeout(() => document.addEventListener('mousedown', handleMouseDown), 0)
      : undefined;
    if (!delayMouseDown) document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      if (timer !== undefined) window.clearTimeout(timer);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, [delayMouseDown, enabled, onClose, refs]);
}
