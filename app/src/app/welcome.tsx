import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, Button, PairRing, space, dark, useReducedMotion } from '@calipartner/ui';
import { t } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();

  // 6-second looping animation for PairRing preview
  const [arcProgress, setArcProgress] = useState({ user: 78, partner: 64 });

  useEffect(() => {
    if (reduceMotion) return;

    let forward = true;
    const interval = setInterval(() => {
      setArcProgress((prev) => {
        if (forward) {
          if (prev.user >= 100) {
            forward = false;
            return { user: 95, partner: 85 };
          }
          return { user: prev.user + 6, partner: prev.partner + 5 };
        } else {
          if (prev.user <= 25) {
            forward = true;
            return { user: 30, partner: 25 };
          }
          return { user: prev.user - 8, partner: prev.partner - 7 };
        }
      });
    }, 600);

    return () => clearInterval(interval);
  }, [reduceMotion]);

  const handleGetStarted = () => {
    router.push({
      pathname: '/auth/sign-in',
      params: { mode: 'signup' },
    });
  };

  const handleSignIn = () => {
    router.push({
      pathname: '/auth/sign-in',
      params: { mode: 'signin' },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top spacer */}
        <View style={styles.topBar} />

        {/* Center: Decorative PairRing preview */}
        <View
          style={styles.heroSection}
          accessible={false}
          accessibilityElementsHidden={true}
          importantForAccessibility="no"
        >
          <View style={styles.ringWrapper}>
            <PairRing
              size={184}
              userPercent={arcProgress.user}
              partnerPercent={arcProgress.partner}
              userHue="iris"
              partnerHue="teal"
              hasPartner={true}
              testID="welcome-pair-ring"
            />
          </View>

          {/* Value Pitch */}
          <View style={styles.copyBlock}>
            <Text variant="title1" color={dark.textHi} style={styles.title} testID="welcome-title">
              Get stronger, together.
            </Text>
            <Text
              variant="body"
              color={dark.textMid}
              style={styles.subtitle}
              testID="welcome-subtitle"
            >
              Track food, steps and workouts, and keep your squad on the same page.
            </Text>
          </View>
        </View>

        {/* Bottom Action Area (Thumb Zone) */}
        <View style={styles.bottomZone}>
          <Button
            variant="primary"
            size="lg"
            label={t('welcome.getStarted')}
            onPress={handleGetStarted}
            testID="btn-welcome-get-started"
          />

          <Button
            variant="secondary"
            size="lg"
            label={t('welcome.alreadyHaveAccount')}
            onPress={handleSignIn}
            testID="btn-welcome-sign-in"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  container: {
    flex: 1,
    paddingHorizontal: space[4],
    justifyContent: 'space-between',
    paddingBottom: space[4],
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingTop: space[2],
    minHeight: 44,
  },
  heroSection: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[4],
  },
  ringWrapper: {
    marginBottom: space[6],
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyBlock: {
    alignItems: 'center',
    paddingHorizontal: space[3],
    gap: space[2],
  },
  title: {
    textAlign: 'center',
    letterSpacing: -0.5,
  },
  subtitle: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  bottomZone: {
    width: '100%',
    gap: space[3],
    paddingTop: space[2],
  },
});
