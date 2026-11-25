import React from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { AuthFormView } from '@/components/auth/AuthFormView';
import { useAuth } from '@/contexts/AuthContext';
import { afterSetupDestination } from '@/services/pairOnboardingService';

export default function SignInScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { user } = useAuth();
  const resolvedMode = mode === 'signup' ? 'signup' : 'signin';

  React.useEffect(() => {
    let mounted = true;
    if (user?.id) {
      void import('@/services/onboardingStatus')
        .then(async ({ isUserOnboarded }) => {
          const onboarded = await isUserOnboarded(user.id);
          const destination = onboarded ? await afterSetupDestination(user.id) : '/onboarding';
          if (mounted) router.replace(destination as never);
        })
        .catch(() => {
          if (mounted) router.replace('/onboarding');
        });
    }
    return () => {
      mounted = false;
    };
  }, [user?.id, router]);

  return (
    <AuthFormView
      mode={resolvedMode}
      onModeChange={(nextMode) => router.setParams({ mode: nextMode })}
      onBack={() => router.replace('/welcome')}
      testID="auth-sign-in-screen"
    />
  );
}
