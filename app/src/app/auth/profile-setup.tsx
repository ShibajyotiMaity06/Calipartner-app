import React, { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { calculateAge, isAtLeast18, type Sex } from '@calipartner/core';
import { Button, Text, onboardingLayout as layout, space, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { InteractiveDobPicker } from '@/components/onboarding/InteractiveDobPicker';
import {
  PlanCard,
  PlanChoice,
  PlanTextField,
  planStyles,
} from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export default function ProfileSetupScreen() {
  const router = useRouter();
  const { createProfile, profile } = useAuth();
  const { status, checkAvailability, setStatus } = useUsername();
  const { colors } = useTheme();
  const [username, setUsername] = useState('');
  const [nickname, setNickname] = useState('');
  const [dob, setDob] = useState('');
  const [sex, setSex] = useState<Sex>('male');
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    if (profile) router.replace('/onboarding');
  }, [profile, router]);
  useEffect(() => {
    if (username.trim().length < 3) return;
    const timer = setTimeout(() => {
      void checkAvailability(username);
    }, 400);
    return () => clearTimeout(timer);
  }, [username, checkAvailability]);
  const submit = async () => {
    if (busy.current) return;
    setError(null);
    if (!nickname.trim()) {
      setError(t('setup.nicknameRequired'));
      return;
    }
    if (!isAtLeast18(dob)) {
      setError(t('profileSetup.under18Error'));
      return;
    }
    if (calculateAge(dob) > 120) {
      setError(t('setup.invalidDate'));
      return;
    }
    if (!place.trim() || place.trim().length > 120) {
      setError(t('setup.placeError'));
      return;
    }
    busy.current = true;
    setLoading(true);
    try {
      // Recheck the submitted value; an earlier availability response may be stale.
      if (!(await checkAvailability(username))) {
        setError(t('profileSetup.usernameTaken'));
        return;
      }
      const result = await createProfile({
        username: username.trim(),
        nickname: nickname.trim(),
        date_of_birth: dob,
        sex,
        // Required by the existing profile contract. Actual height is required in training details before any target can be saved.
        height_cm: 175,
        units: 'metric',
        place: place.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      if (result.error) {
        setError(result.error.message);
        return;
      }
      router.replace('/onboarding');
    } catch {
      setError(t('common.errorBody'));
    } finally {
      busy.current = false;
      setLoading(false);
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg0 }]}>
      <KeyboardAvoidingView
        style={styles.safe}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.content}>
            <Text
              fontSet="onboarding"
              variant="title1"
              color={colors.textHi}
              accessibilityRole="header"
              testID="profile-setup-title"
            >
              {t('setup.profileTitle')}
            </Text>
            <Text fontSet="onboarding" color={colors.textMid}>
              {t('setup.profileSubtitle')}
            </Text>
            <PlanCard>
              <PlanTextField
                label={t('profileSetup.nicknameLabel')}
                accessibilityLabel={t('profileSetup.nicknameLabel')}
                value={nickname}
                onChangeText={setNickname}
                maxLength={60}
                autoComplete="given-name"
                testID="input-nickname"
              />
              <PlanTextField
                label={t('profileSetup.usernameLabel')}
                accessibilityLabel={t('profileSetup.usernameLabel')}
                value={username}
                onChangeText={(value) => {
                  setUsername(value.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
                  setStatus('idle');
                }}
                maxLength={20}
                autoCapitalize="none"
                autoCorrect={false}
                testID="input-username"
              />
              <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
                {t('setup.usernameRules')}
              </Text>
              {status === 'available' ? (
                <Text fontSet="onboarding" color={colors.textMid} accessibilityLiveRegion="polite">
                  {t('profileSetup.usernameAvailable')}
                </Text>
              ) : null}
              {['taken', 'invalid', 'reserved', 'held', 'error'].includes(status) ? (
                <Text fontSet="onboarding" color={colors.danger} accessibilityLiveRegion="polite">
                  {t(
                    status === 'invalid'
                      ? 'profileSetup.usernameInvalid'
                      : status === 'error'
                        ? 'common.errorBody'
                        : 'profileSetup.usernameTaken',
                  )}
                </Text>
              ) : null}
            </PlanCard>
            <PlanCard>
              <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
                {t('setup.dob')}
              </Text>
              <InteractiveDobPicker value={dob} onChange={setDob} />
              <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
                {t('setup.ageNote')}
              </Text>
            </PlanCard>
            <View accessibilityRole="radiogroup" style={planStyles.gap}>
              <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
                {t('profileSetup.sexLabel')}
              </Text>
              {(['male', 'female', 'other'] as const).map((value) => (
                <PlanChoice
                  key={value}
                  title={t(`profileSetup.${value}`)}
                  selected={sex === value}
                  onPress={() => setSex(value)}
                  testID={`btn-sex-${value}`}
                />
              ))}
            </View>
            <PlanCard>
              <PlanTextField
                label={t('setup.place')}
                accessibilityLabel={t('setup.place')}
                value={place}
                onChangeText={setPlace}
                maxLength={120}
                placeholder={t('setup.placePlaceholder')}
                testID="input-place"
              />
              <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
                {t('setup.privatePlace')}
              </Text>
            </PlanCard>
            {error ? (
              <Text
                fontSet="onboarding"
                accessibilityRole="alert"
                color={colors.danger}
                testID="error-profile-setup"
              >
                {error}
              </Text>
            ) : null}
            <Button
              fontSet="onboarding"
              label={t('setup.next')}
              loading={loading}
              onPress={() => void submit()}
              testID="btn-submit-profile"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  scroll: { padding: space[4], paddingBottom: space[8] },
  content: { alignSelf: 'center', width: '100%', maxWidth: layout.contentWidth, gap: space[4] },
});
