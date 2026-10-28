import { afterSetupDestination } from '@/services/pairOnboardingService';
import React, { useEffect, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PairRing, Text, space, dark } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';

import { isUserOnboarded } from '@/services/onboardingStatus';
import { secureStoreAdapter } from '@/lib/secureStore';
import { RETURNING_USER_KEY } from '@/services/sessionPersistence';
import { ErrorState } from '@/components/ErrorState';

export default function LaunchScreen() {
  const router = useRouter();
  const { user, isGuest, isLoading } = useAuth();
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    if (isLoading) return;

    // Spec A01: 200ms smooth transition after fonts and local DB are ready
    const timer = setTimeout(async () => {
      try {
        if (user) {
          const onboarded = await isUserOnboarded(user.id);
          if (onboarded) {
            router.replace((await afterSetupDestination(user.id)) as never);
          } else {
            router.replace('/onboarding' as never);
          }
        } else if (isGuest) {
          router.replace('/today' as never);
        } else {
          const returning = await secureStoreAdapter.getItem(RETURNING_USER_KEY);
          router.replace(
            returning ? ('/auth/sign-in?mode=signin' as never) : ('/welcome' as never),
          );
        }
      } catch {
        setError(true);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [user, isGuest, isLoading, router, retry]);

  return (
    <View style={styles.container} testID="launch-screen">
      {error ? (
        <ErrorState
          onRetry={() => {
            setError(false);
            setRetry((value) => value + 1);
          }}
        />
      ) : (
        <>
          {/* Spec A01: Centred logo (iris→apricot→teal seam over two arcs) on bg0 */}
          <View style={styles.logoWrapper}>
            <PairRing
              size={120}
              userPercent={85}
              partnerPercent={70}
              userHue="iris"
              partnerHue="teal"
              hasPartner={true}
              testID="launch-logo"
            />
            <Text variant="title1" color={dark.textHi} style={styles.appName}>
              CaliPartner
            </Text>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: dark.bg0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoWrapper: {
    alignItems: 'center',
    gap: space[4],
  },
  appName: {
    letterSpacing: -0.5,
    fontWeight: '700',
  },
});
