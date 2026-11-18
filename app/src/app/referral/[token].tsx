import React, { useState } from 'react';
import { Linking, Platform, StyleSheet } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { useAuth } from '@/contexts/AuthContext';
import { isUserOnboarded } from '@/services/onboardingStatus';
import {
  claimPendingCoinReferral,
  isCoinReferralToken,
  rememberCoinReferral,
} from '@/services/coinReferralService';
import { t } from '@/i18n';

export default function CoinReferralScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { colors } = useTheme();
  const [error, setError] = useState(false);
  const [busy, setBusy] = useState(false);
  const valid = isCoinReferralToken(token);
  const continueSetup = async () => {
    if (!valid || busy) return;
    setBusy(true);
    setError(false);
    try {
      await rememberCoinReferral(token);
      if (user && (await isUserOnboarded(user.id))) {
        await claimPendingCoinReferral(user.id);
        router.replace('/today');
      } else router.replace('/onboarding');
    } catch {
      setError(true);
    } finally {
      setBusy(false);
    }
  };
  return (
    <SafeAreaView
      style={[styles.content, { backgroundColor: colors.bg0 }]}
      testID="coin-referral-landing"
    >
      <Text variant="title1">{t('releaseUpdate.inviteJoin')}</Text>
      <Text>{t('releaseUpdate.inviteRecipient')}</Text>
      {error || !valid ? (
        <Text accessibilityRole="alert">
          {t(valid ? 'common.errorBody' : 'pairStart.unavailable')}
        </Text>
      ) : null}
      <Button
        label={t('releaseUpdate.inviteReady')}
        disabled={isLoading || !valid || busy}
        onPress={() => void continueSetup()}
        testID="coin-referral-continue"
      />
      {Platform.OS === 'web' && valid && (
        <Button
          variant="secondary"
          label={t('releaseUpdate.inviteOpenApp')}
          onPress={() =>
            void Linking.openURL('calipartner://referral/' + token).catch(() => setError(true))
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', padding: space[5], gap: space[3] },
});
