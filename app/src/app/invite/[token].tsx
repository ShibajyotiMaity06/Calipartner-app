import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { isUserOnboarded } from '@/services/onboardingStatus';
import {
  acceptPairInvite,
  clearPendingPairInvite,
  isPairToken,
  rememberPairInvite,
} from '@/services/pairOnboardingService';
import { t } from '@/i18n';

export default function PairInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    if (!isPairToken(token)) {
      setError(t('pairStart.unavailable'));
      return;
    }
    void rememberPairInvite(token)
      .then(() => {
        if (active) setReady(true);
      })
      .catch(() => {
        if (active) setError(t('pairStart.error'));
      });
    return () => {
      active = false;
    };
  }, [token]);
  const join = async () => {
    if (busy || !ready || !isOnline) return;
    setBusy(true);
    setError(null);
    try {
      if (!user) {
        router.push('/auth/sign-in?mode=signup' as never);
        return;
      }
      if (!(await isUserOnboarded(user.id))) {
        router.replace('/onboarding');
        return;
      }
      await acceptPairInvite(token);
      router.replace('/room' as never);
    } catch (e) {
      const message = String((e as { message?: string }).message ?? e);
      setError(
        t(
          message.includes('HOSTED_ROOM_LIMIT')
            ? 'pairStart.hostLimit'
            : message.includes('SELF_INVITE')
              ? 'pairStart.self'
              : /INVITE_UNAVAILABLE|INVITE_EXPIRED|USER_BLOCKED/.test(message)
                ? 'pairStart.unavailable'
                : 'pairStart.error',
        ),
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView contentContainerStyle={styles.content} testID="accept-pair-invite-screen">
        <Text
          variant="title1"
          fontSet="onboarding"
          color={colors.textHi}
          accessibilityRole="header"
        >
          {t('pairStart.joinTitle')}
        </Text>
        <Text fontSet="onboarding" color={colors.textMid}>
          {t('pairStart.joinBody')}
        </Text>
        <Text variant="heading" fontSet="onboarding" color={colors.textHi}>
          {t('pairStart.free')}
        </Text>
        {isOnline === false ? <Text>{t('pairStart.offline')}</Text> : null}
        {error ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        <Button
          label={t(busy ? 'pairStart.joining' : user ? 'pairStart.accept' : 'pairStart.signIn')}
          disabled={busy || isLoading || !ready || !isOnline}
          onPress={() => void join()}
          testID="accept-onboarding-pair"
        />
        <Button
          variant="tertiary"
          label={t('pairStart.notNow')}
          disabled={busy}
          onPress={() =>
            void clearPendingPairInvite().then(() => router.replace(user ? '/today' : '/welcome'))
          }
          testID="decline-onboarding-pair"
        />
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space[6], gap: space[5], justifyContent: 'center' },
});
