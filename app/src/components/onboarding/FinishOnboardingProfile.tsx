import React, { useRef, useState } from 'react';
import { Platform } from 'react-native';
import { isAtLeast18 } from '@calipartner/core';
import { Button, Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { useAuth } from '@/contexts/AuthContext';
import { useUsername } from '@/hooks/useUsername';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { fetchWebCatalog } from '@/services/webBillingService';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { PlanCard, PlanTextField } from './PlanPrimitives';

export function FinishOnboardingProfile({
  state,
  waitForDraft,
  onComplete,
}: {
  state: OnboardingState;
  waitForDraft: () => Promise<void>;
  onComplete: () => void;
}) {
  const { colors } = useTheme();
  const { createProfile } = useAuth();
  const { isOnline } = useNetworkStatus();
  const { checkAvailability, status, setStatus } = useUsername();
  const [username, setUsername] = useState('');
  const [place, setPlace] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const busy = useRef(false);
  const usernameError =
    status === 'taken' || status === 'reserved' || status === 'held'
      ? t('profileSetup.usernameTaken')
      : status === 'invalid'
        ? t('profileSetup.usernameInvalid')
        : status === 'error'
          ? t('common.errorBody')
          : null;

  const submit = async () => {
    if (busy.current || !isOnline) return;
    setError(null);
    if (!username.trim()) {
      setStatus('invalid');
      return;
    }
    if (!place.trim()) {
      setError(t('setup.placeError'));
      return;
    }
    busy.current = true;
    setSaving(true);
    try {
      await waitForDraft();
      if (!(await checkAvailability(username))) return;
      const safeHeight =
        state.heightCm &&
        Number.isFinite(state.heightCm) &&
        state.heightCm >= 50 &&
        state.heightCm <= 300
          ? state.heightCm
          : 175;
      const now = new Date();
      const defaultDob = `${now.getFullYear() - 25}-01-01`;
      const safeDob =
        state.dateOfBirth && isAtLeast18(state.dateOfBirth) ? state.dateOfBirth : defaultDob;
      const result = await createProfile({
        username: username.trim(),
        nickname: state.nickname?.trim() || username.trim(),
        date_of_birth: safeDob,
        sex: state.sex ?? 'female',
        height_cm: safeHeight,
        units: state.units ?? 'metric',
        place: place.trim(),
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      });
      if (result.error) {
        if (
          result.error.message.includes('profiles_username_key') ||
          result.error.message.toLowerCase().includes('username')
        ) {
          setStatus('taken');
          return;
        }
        setError(result.error.message);
        return;
      }
      if (Platform.OS === 'web') {
        void fetchWebCatalog({ force: true }).catch(() => {});
      }
      onComplete();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : t('common.errorBody'));
    } finally {
      busy.current = false;
      setSaving(false);
    }
  };
  return (
    <PlanCard testID="onboarding-final-profile">
      <PlanTextField
        label={t('profileSetup.usernameLabel')}
        value={username}
        onChangeText={(value) => {
          setUsername(value.toLowerCase().replace(/[^a-z0-9_.]/g, ''));
          setStatus('idle');
        }}
        maxLength={20}
        autoComplete="username"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!saving}
        testID="input-username"
      />
      <Text variant="bodyS">{t('setup.usernameRules')}</Text>
      {usernameError && (
        <Text color={colors.danger} accessibilityRole="alert" testID="onboarding-username-error">
          {usernameError}
        </Text>
      )}
      <PlanTextField
        label={t('setup.place')}
        value={place}
        onChangeText={setPlace}
        maxLength={120}
        placeholder={t('setup.placePlaceholder')}
        editable={!saving}
        testID="input-place"
      />
      <Text variant="bodyS">{t('setup.privatePlace')}</Text>
      {error && (
        <Text color={colors.danger} accessibilityRole="alert" testID="onboarding-profile-error">
          {error}
        </Text>
      )}
      <Button
        label={t('setup.next')}
        onPress={() => void submit()}
        disabled={!isOnline}
        loading={saving}
        testID="btn-submit-profile"
      />
    </PlanCard>
  );
}
