import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { PairRing, Text, space, dark } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';

import { isUserOnboarded } from '@/services/onboardingStatus';

export default function LaunchScreen() {
  const router = useRouter();
  const { user, isGuest, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    // Spec A01: 200ms smooth transition after fonts and local DB are ready
    const timer = setTimeout(async () => {
      if (user) {
        const onboarded = await isUserOnboarded(user.id);
        if (onboarded) {
          router.replace('/today' as never);
        } else {
          router.replace('/auth/welcome-celebration' as never);
        }
      } else if (isGuest) {
        router.replace('/today' as never);
      } else {
        router.replace('/welcome' as never);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [user, isGuest, isLoading, router]);

  return (
    <View style={styles.container} testID="launch-screen">
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
