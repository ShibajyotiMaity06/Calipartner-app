import { useCallback, useEffect, useState } from 'react';
import { fetchHealth } from '@/lib/health';
import { isSupabaseConfigured } from '@/lib/env';
import { createLogger } from '@/lib/logger';

const log = createLogger('health');

export type HealthState = 'checking' | 'connected' | 'failed' | 'notConfigured';

export function useHealth(): { state: HealthState; retry: () => void } {
  const [state, setState] = useState<HealthState>(
    isSupabaseConfigured() ? 'checking' : 'notConfigured',
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setState('notConfigured');
      return;
    }
    let cancelled = false;
    setState('checking');
    fetchHealth()
      .then(() => {
        if (!cancelled) setState('connected');
      })
      .catch((e: unknown) => {
        log.warn('health check failed', e instanceof Error ? e.message : String(e));
        if (!cancelled) setState('failed');
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  return { state, retry };
}
