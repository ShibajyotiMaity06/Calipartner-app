import React, { useEffect } from 'react';
import { SafeAreaView, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, dark, space } from '@calipartner/ui';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { playSuccessSound } from '@/lib/sound';
import { useAuth } from '@/contexts/AuthContext';
import { isUserOnboarded } from '@/services/onboardingStatus';

export default function WelcomeCelebrationScreen() {
  const router = useRouter();
  const { user } = useAuth();

  // If returning user already completed onboarding, skip celebration to today
  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      isUserOnboarded(user.id)
        .then((onboarded) => {
          if (mounted && onboarded) {
            router.replace('/today' as never);
          }
        })
        .catch(() => {
          if (mounted) router.replace('/today' as never);
        });
    }
    return () => {
      mounted = false;
    };
  }, [user?.id, router]);

  const handleGetStarted = async () => {
    playSuccessSound();
    try {
      if (user?.id) {
        const onboarded = await isUserOnboarded(user.id);
        if (onboarded) {
          router.replace('/today' as never);
          return;
        }
      }
      router.replace('/onboarding' as never);
    } catch {
      router.replace('/today' as never);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.contentContainer}>
        {/* Static official logo */}
        <View style={styles.logoWrapper}>
          <CaliPartnerLogo size={200} testID="welcome-celebration-logo" />
        </View>

        {/* Title & Tagline */}
        <View style={styles.textGroup}>
          <Text variant="numeralL" color={dark.textHi} style={styles.title} testID="welcome-title">
            CaliPartner
          </Text>
          <Text
            variant="title1"
            color={dark.apricot}
            style={styles.tagline}
            testID="welcome-tagline"
          >
            Grow stronger, together.
          </Text>
          <Text variant="body" color={dark.textMid} style={styles.description}>
            Log meals, hit your protein goals, and stay consistent alongside real partners.
          </Text>
        </View>

        {/* Action Button */}
        <View style={styles.buttonWrapper}>
          <Button
            variant="primary"
            size="lg"
            label="Let's get started"
            onPress={handleGetStarted}
            testID="btn-welcome-get-started"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#160C05',
  },
  contentContainer: {
    flex: 1,
    justifyContent: 'space-between',
    paddingHorizontal: space[6],
    paddingTop: space[8],
    paddingBottom: space[8],
  },
  logoWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[6],
  },
  textGroup: {
    alignItems: 'center',
    textAlign: 'center',
    gap: space[2],
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  tagline: {
    textAlign: 'center',
    fontWeight: '700',
  },
  description: {
    textAlign: 'center',
    marginTop: space[2],
    lineHeight: 22,
    maxWidth: 320,
  },
  buttonWrapper: {
    width: '100%',
    paddingBottom: space[2],
  },
});
