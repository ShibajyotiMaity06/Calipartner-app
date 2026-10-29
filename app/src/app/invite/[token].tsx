import React, { useEffect, useState } from 'react';
import { ScrollView, Share, StyleSheet } from 'react-native';
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
  previewPairInvite,
  rememberPairInvite,
  type PairInvitePreview,
} from '@/services/pairOnboardingService';
import { t } from '@/i18n';

export default function PairInviteScreen() {
  const { token } = useLocalSearchParams<{ token: string }>();
  const { user, isLoading } = useAuth();
  const userId = user?.id;
  const { colors } = useTheme();
  const { isOnline } = useNetworkStatus();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [preview, setPreview] = useState<PairInvitePreview | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setReady(false);
    setError(null);
    setPreview(null);
    if (isLoading) return;
    if (!isPairToken(token)) {
      setError(t('pairStart.unavailable'));
      return;
    }
    if (!isOnline) {
      setError(t('pairStart.offline'));
      return;
    }
    void (async () => {
      if (!userId) {
        await rememberPairInvite(token);
        if (active) setReady(true);
        return;
      }
      const result = await previewPairInvite(token);
      if (!active) return;
      if (result.state === 'joinable') await rememberPairInvite(token);
      else await clearPendingPairInvite();
      if (active) {
        setPreview(result);
        setReady(true);
      }
    })().catch(() => {
      if (active) setError(t('pairStart.error'));
    });
    return () => {
      active = false;
    };
  }, [token, userId, isLoading, isOnline, refresh]);
  const openRoom = (roomId?: string) =>
    router.replace((roomId ? `/room?room=${roomId}` : '/room') as never);
  const join = async () => {
    if (
      busy ||
      !ready ||
      !isOnline ||
      preview?.state === 'sender' ||
      preview?.state === 'member' ||
      preview?.state === 'unavailable'
    )
      return;
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
      openRoom(await acceptPairInvite(token));
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
  const share = async () => {
    setError(null);
    setBusy(true);
    try {
      await Share.share({
        message: t('pairStart.shareMessage', {
          link: `https://app.calipartner.site/invite/${token}`,
        }),
      });
    } catch {
      setError(t('pairStart.error'));
    } finally {
      setBusy(false);
    }
  };
  const sender = preview?.state === 'sender',
    member = preview?.state === 'member',
    unavailable = preview?.state === 'unavailable';
  const title = member
    ? 'pairStart.memberTitle'
    : sender
      ? 'pairStart.ownTitle'
      : unavailable
        ? 'pairStart.unavailableTitle'
        : ready
          ? 'pairStart.joinTitle'
          : 'common.loading';
  const body = member
    ? 'pairStart.memberBody'
    : sender
      ? preview.reason === 'host_limit'
        ? 'pairStart.limit'
        : preview.reason === 'expired'
          ? 'pairStart.unavailable'
          : 'pairStart.ownBody'
      : unavailable
        ? preview.reason === 'host_limit'
          ? 'pairStart.hostLimit'
          : 'pairStart.unavailable'
        : 'pairStart.joinBody';
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
      <ScrollView contentContainerStyle={styles.content} testID="accept-pair-invite-screen">
        <Text
          variant="title1"
          fontSet="onboarding"
          color={colors.textHi}
          accessibilityRole="header"
        >
          {t(title)}
        </Text>
        {ready ? (
          <Text fontSet="onboarding" color={colors.textMid}>
            {t(body)}
          </Text>
        ) : null}
        {ready && !sender && !member && !unavailable ? (
          <Text variant="heading" fontSet="onboarding" color={colors.textHi}>
            {t('pairStart.free')}
          </Text>
        ) : null}
        {error ? (
          <Text accessibilityRole="alert" color={colors.danger}>
            {error}
          </Text>
        ) : null}
        {ready && member ? (
          <Button
            label={t('pairStart.openRoom')}
            onPress={() => openRoom(preview.room_id)}
            testID="open-invited-room"
          />
        ) : ready && sender ? (
          <Button
            label={t(
              preview.can_share
                ? 'pairStart.share'
                : preview.reason === 'expired'
                  ? 'pairStart.newInvite'
                  : 'pairStart.openRooms',
            )}
            disabled={busy}
            onPress={() => {
              if (preview.can_share) void share();
              else if (preview.reason === 'expired') router.replace('/pair-start' as never);
              else openRoom();
            }}
            testID="share-own-pair-invite"
          />
        ) : ready && !unavailable ? (
          <Button
            label={t(busy ? 'pairStart.joining' : user ? 'pairStart.accept' : 'pairStart.signIn')}
            disabled={busy || !isOnline}
            onPress={() => void join()}
            testID="accept-onboarding-pair"
          />
        ) : !ready && error ? (
          <Button
            variant="secondary"
            label={t('common.retry')}
            disabled={!isOnline}
            onPress={() => setRefresh((v) => v + 1)}
            testID="retry-pair-invite"
          />
        ) : null}
        <Button
          variant="tertiary"
          label={t(sender || member ? 'pairStart.continue' : 'pairStart.notNow')}
          disabled={busy}
          onPress={() =>
            void clearPendingPairInvite()
              .then(() => router.replace(user ? '/today' : '/welcome'))
              .catch(() => setError(t('pairStart.error')))
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
