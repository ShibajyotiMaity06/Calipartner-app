import React, { useState } from 'react';
import { Share, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, space, useTheme } from '@calipartner/ui';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { finishPairPrompt, preparePairInvite } from '@/services/pairOnboardingService';
import { t } from '@/i18n';

export function PairStartView() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const share = async () => {
    if (!user || busy || !isOnline) return;
    setBusy(true);
    setError(null);
    setLimit(false);
    try {
      const invite = await preparePairInvite(user.id, t('pairStart.roomName'));
      const link = `https://app.calipartner.site/invite/${invite.token}`;
      await Share.share({ message: t('pairStart.shareMessage', { link }) });
    } catch (e) {
      const full = String((e as { message?: string }).message ?? e);
      setLimit(full.includes('HOSTED_ROOM_LIMIT'));
      setError(t(full.includes('HOSTED_ROOM_LIMIT') ? 'pairStart.limit' : 'pairStart.error'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <View style={styles.content} testID="pair-start-screen">
      <CaliPartnerLogo />
      <Text fontSet="onboarding" variant="title1" color={colors.textHi} accessibilityRole="header">
        {t('pairStart.title')}
      </Text>
      <Text fontSet="onboarding" color={colors.textMid}>
        {t('pairStart.body')}
      </Text>
      <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
        {t('pairStart.free')}
      </Text>
      {isOnline === false ? (
        <Text accessibilityLiveRegion="polite">{t('pairStart.offline')}</Text>
      ) : null}
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {error}
        </Text>
      ) : null}
      <Button
        label={t(busy ? 'pairStart.preparing' : 'pairStart.share')}
        disabled={busy || !isOnline}
        onPress={() => void share()}
        testID="share-pair-invite"
      />
      <Button
        variant="tertiary"
        label={t(limit ? 'pairStart.openRooms' : 'pairStart.continue')}
        disabled={busy}
        onPress={() => {
          if (!user) return;
          void finishPairPrompt(user.id)
            .then(() => router.replace((limit ? '/room' : '/today') as never))
            .catch(() => setError(t('pairStart.error')));
        }}
        testID="continue-after-pair-invite"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space[6], justifyContent: 'center', gap: space[5] },
});
