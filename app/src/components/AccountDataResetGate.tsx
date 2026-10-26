import React, { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { getSupabase } from '@/lib/supabase';
import { clearTrackingDataForReset } from '@/db';
import { applyAccountDataReset } from '@/services/accountDataReset';
import { registerAccountSyncCheck } from '@/services/accountSyncGate';
import { ErrorState } from './ErrorState';
import { LoadingState } from './LoadingState';

/** Keep stale targets/outboxes unmounted until the server's reset generation has been checked. */
export function AccountDataResetGate({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const { isOnline } = useNetworkStatus();
  const userId = user?.id;
  const [generation, setGeneration] = useState(0);
  const [readyUserId, setReadyUserId] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [resetting, setResetting] = useState(false);
  const inFlight = useRef<Promise<boolean> | null>(null);
  const mounted = useRef(true);
  const retry = useCallback(() => {
    setError(false);
    setGeneration((current) => current + 1);
  }, []);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const verify = useCallback((): Promise<boolean> => {
    if (!userId || isOnline === false) return Promise.resolve(false);
    if (inFlight.current) return inFlight.current;
    const request = applyAccountDataReset(getSupabase(), async () => {
      if (mounted.current) setResetting(true);
      await clearTrackingDataForReset();
    })
      .then((changed) => {
        if (mounted.current) {
          setReadyUserId(userId);
          setError(false);
        }
        return changed;
      })
      .catch((failure: unknown) => {
        if (mounted.current) {
          // Cached offline use remains available; queued writes still await a successful check.
          const unavailable =
            failure instanceof Error &&
            'code' in failure &&
            failure.code === 'RESET_CHECK_UNAVAILABLE';
          if (unavailable) setReadyUserId(userId);
          setError(!unavailable);
        }
        throw failure;
      })
      .finally(() => {
        inFlight.current = null;
        if (mounted.current) setResetting(false);
      });
    inFlight.current = request;
    return request;
  }, [isOnline, userId]);

  useEffect(() => registerAccountSyncCheck(verify), [verify]);

  useEffect(() => {
    const listener = AppState.addEventListener('change', (status) => {
      if (status === 'active') retry();
    });
    return () => listener.remove();
  }, [retry]);

  useEffect(() => {
    if (!isLoading) void verify().catch(() => {});
  }, [generation, isLoading, verify]);

  // Mount navigation once after session restoration. Mounting it during auth loading
  // then removing it for reset verification loses browser checkout return routes.
  if (isLoading) return <LoadingState />;
  if (!user || isOnline === false) return <>{children}</>;
  if (error) return <ErrorState onRetry={retry} />;
  if (readyUserId !== userId || resetting) return <LoadingState />;
  return <>{children}</>;
}
