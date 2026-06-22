'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import type { SkillMatrix } from '@/components/settings/types';

/**
 * The unified (skill × agent) matrix — single source of truth for which agent
 * loads which skill. Refreshes on mount and whenever any view dispatches
 * `mindos:skills-changed`, so every consumer stays in sync.
 */
export function useSkillMatrix(): {
  matrix: SkillMatrix | null;
  loading: boolean;
  error: string | null;
  refreshMatrix: () => Promise<void>;
} {
  const [matrix, setMatrix] = useState<SkillMatrix | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshMatrix = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setMatrix(await apiFetch<SkillMatrix>('/api/skills/matrix', { cache: 'no-store' }));
    } catch (err) {
      setMatrix(null);
      setError(err instanceof Error ? err.message : 'Failed to load skill matrix');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshMatrix();
    const onChanged = () => void refreshMatrix();
    window.addEventListener('mindos:skills-changed', onChanged);
    return () => window.removeEventListener('mindos:skills-changed', onChanged);
  }, [refreshMatrix]);

  return { matrix, loading, error, refreshMatrix };
}
