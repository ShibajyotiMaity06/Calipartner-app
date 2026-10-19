import React, { useEffect, useState } from 'react';
import { View, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import {
  Text,
  Button,
  Chip,
  PairRing,
  Sheet,
  Field,
  space,
  dark,
  useReducedMotion,
} from '@calipartner/ui';
import { t, setLocale, getLocale } from '@/i18n';

export default function WelcomeScreen() {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [currentLocale, setCurrentLocale] = useState(getLocale());

  // Invite code sheet state
  const [showInviteSheet, setShowInviteSheet] = useState(false);
  const [inviteCode, setInviteCode] = useState('');
  const [inviteError, setInviteError] = useState<string | null>(null);

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

  const toggleLanguage = () => {
    const next = currentLocale === 'en' ? 'hi' : 'en';
    setLocale(next);
    setCurrentLocale(next);
  };

  const handleGetStarted = () => {
    router.push('/onboarding');
  };

  const handleSignIn = () => {
    router.push('/auth/sign-in');
  };

  const handleJoinWithCode = () => {
    const clean = inviteCode.trim().toUpperCase();
    if (clean.length < 4) {
      setInviteError('Please enter a valid invite code (e.g. RAHUL8).');
      return;
    }
    setShowInviteSheet(false);
    // Route to invite preview with the code
    router.push({
      pathname: '/onboarding',
      params: { inviteCode: clean },
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>
        {/* Top bar with right-aligned Language chip */}
        <View style={styles.topBar}>
          <Chip
            label={currentLocale === 'en' ? 'हिन्दी' : 'EN'}
            selected={false}
            onPress={toggleLanguage}
            accessibilityLabel={`Switch to ${currentLocale === 'en' ? 'Hindi' : 'English'}`}
            testID="btn-language-toggle"
          />
        </View>

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
              {t('welcome.title')}
            </Text>
            <Text
              variant="body"
              color={dark.textMid}
              style={styles.subtitle}
              testID="welcome-subtitle"
            >
              {t('welcome.subtitle')}
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

          <TouchableOpacity
            onPress={() => setShowInviteSheet(true)}
            style={styles.inviteLink}
            accessibilityRole="button"
            accessibilityLabel={t('welcome.haveInviteCode')}
            testID="btn-welcome-have-invite"
          >
            <Text variant="body" color={dark.apricot} style={styles.inviteText}>
              {t('welcome.haveInviteCode')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Invite Code Sheet */}
      <Sheet
        visible={showInviteSheet}
        onClose={() => {
          setShowInviteSheet(false);
          setInviteError(null);
        }}
        testID="sheet-invite-code"
      >
        <View style={styles.sheetContent}>
          <Text variant="heading" color={dark.textHi}>
            {t('welcome.enterInviteCode')}
          </Text>
          <Field
            label="Room Code"
            value={inviteCode}
            onChangeText={(text) => {
              setInviteCode(text);
              if (inviteError) setInviteError(null);
            }}
            placeholder={t('welcome.inviteCodePlaceholder')}
            autoCapitalize="characters"
            error={inviteError ?? undefined}
            testID="input-invite-code"
          />
          <Button
            variant="primary"
            size="lg"
            label={t('welcome.joinRoom')}
            onPress={handleJoinWithCode}
            style={styles.sheetButton}
            testID="btn-submit-invite-code"
          />
        </View>
      </Sheet>
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
  inviteLink: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inviteText: {
    textAlign: 'center',
    fontWeight: '600',
  },
  sheetContent: {
    padding: space[4],
    gap: space[4],
  },
  sheetButton: {
    marginTop: space[2],
  },
});
