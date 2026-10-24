import { useEffect } from 'react';
import { useRouter, useSegments } from 'expo-router';
import { useAuth } from '@/contexts/AuthContext';
import { useTargets } from '@/hooks/useTargets';

/** Reauthentication also applies when a session expires while an existing screen is open. */
export function SessionNavigationGuard() {
  const { user, isGuest, isLoading } = useAuth();
  const { currentGoalProfile, loading: targetsLoading, error: targetsError } = useTargets();
  const router = useRouter();
  const segments = useSegments();
  const first = segments[0] as string | undefined;
  useEffect(() => {
    if (isLoading || user || isGuest) return;
    if (!first || ['index', 'auth', 'welcome', 'onboarding', 'dev'].includes(first)) return;
    router.replace('/auth/sign-in?mode=signin' as never);
  }, [first, isGuest, isLoading, router, user]);
  useEffect(() => {
    if (
      user &&
      !isLoading &&
      !targetsLoading &&
      !targetsError &&
      !currentGoalProfile &&
      first === '(tabs)'
    ) {
      router.replace('/onboarding' as never);
    }
  }, [currentGoalProfile, first, isLoading, router, targetsError, targetsLoading, user]);
  return null;
}
