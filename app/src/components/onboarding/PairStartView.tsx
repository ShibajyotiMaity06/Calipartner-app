import React, { useState, useEffect, useRef } from 'react';
import { Share, StyleSheet, View, Modal, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, NavigationIcon, Text, space, useTheme } from '@calipartner/ui';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CaliPartnerLogo } from '@/components/brand/CaliPartnerLogo';
import { useAuth } from '@/contexts/AuthContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import { finishPairPrompt, preparePairInvite } from '@/services/pairOnboardingService';
import { afterPairReviewDestination } from '@/services/onboardingReviewService';
import { t } from '@/i18n';
import * as Clipboard from 'expo-clipboard';

export function PairStartView() {
  const { user } = useAuth();
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [limit, setLimit] = useState(false);
  const [shareLink, setShareLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const currentOwner = useRef(user?.id);
  currentOwner.current = user?.id;
  const attempted = useRef<string | null>(null);
  const sharing = useRef(false);
  const share = async () => {
    if (!user || sharing.current || !isOnline) return;
    sharing.current = true;
    setBusy(true);
    setError(null);
    setLimit(false);
    try {
      const invite = await preparePairInvite(user.id, t('pairStart.roomName'));
      if (currentOwner.current !== user.id) return;
      const link = `https://app.calipartner.site/invite/${invite.token}`;
      if (Platform.OS === 'web') {
        setCopied(false);
        setShareLink(link);
      } else await Share.share({ message: t('pairStart.shareMessage', { link }) });
    } catch (e) {
      const full = String((e as { message?: string }).message ?? e);
      setLimit(full.includes('HOSTED_ROOM_LIMIT'));
      setError(t(full.includes('HOSTED_ROOM_LIMIT') ? 'pairStart.limit' : 'pairStart.error'));
    } finally {
      sharing.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    setShareLink(null);
    if (!user?.id || !isOnline || attempted.current === user.id) return;
    attempted.current = user.id;
    void share();
    // Present once per owner; a dismissed share sheet stays dismissed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isOnline]);
  return (
    <View style={styles.content} testID="pair-start-screen">
      <Modal visible={!!shareLink} transparent onRequestClose={() => setShareLink(null)}>
        <SafeAreaView
          style={[styles.shareSheet, { backgroundColor: colors.bg0 }]}
          testID="pair-share-sheet"
        >
          <Button
            variant="tertiary"
            fullWidth={false}
            iconOnly
            icon={<NavigationIcon action="close" />}
            label={t('entryPolish.close')}
            testID="pair-close-share"
            onPress={() => setShareLink(null)}
            style={styles.shareClose}
          />
          <View style={styles.shareBody}>
            <Text variant="title2">{t('pairStart.share')}</Text>
            <Text selectable>{shareLink}</Text>
            <Button
              label={t(copied ? 'entryPolish.linkCopied' : 'entryPolish.copyLink')}
              testID="pair-copy-link"
              onPress={() => {
                if (shareLink)
                  void Clipboard.setStringAsync(shareLink)
                    .then(() => setCopied(true))
                    .catch(() => setError(t('pairStart.error')));
              }}
            />
            {error && (
              <Text accessibilityRole="alert" color={colors.danger}>
                {error}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>
      <View style={{ alignItems: 'center' }}>
        <CaliPartnerLogo />
      </View>
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
            .then(async () => {
              const next = await afterPairReviewDestination(user.id, limit ? 'rooms' : 'home');
              if (currentOwner.current === user.id) router.replace(next as never);
            })
            .catch(() => setError(t('pairStart.error')));
        }}
        testID="continue-after-pair-invite"
      />
    </View>
  );
}
const styles = StyleSheet.create({
  content: { flexGrow: 1, padding: space[6], justifyContent: 'center', gap: space[5] },
  shareSheet: { flex: 1, padding: space[6] },
  shareClose: { alignSelf: 'flex-start' },
  shareBody: { flex: 1, gap: space[4], justifyContent: 'center' },
});
