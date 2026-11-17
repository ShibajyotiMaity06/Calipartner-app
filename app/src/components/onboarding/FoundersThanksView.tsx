import React, { useRef, useState } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Button, Text, onboardingLayout, space, useTheme } from '@calipartner/ui';
import { openStoreReviewPage } from '@/services/storeReviewService';
import { t } from '@/i18n';

export function FoundersThanksView({ onContinue }: { onContinue: () => Promise<void> }) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState<'store' | 'continue' | null>(null);
  const [message, setMessage] = useState<'unavailable' | 'error' | 'continueError' | null>(null);
  const lock = useRef(false);
  const rate = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy('store');
    setMessage(null);
    try {
      if (!(await openStoreReviewPage())) setMessage('unavailable');
    } catch {
      setMessage('error');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  const continueSetup = async () => {
    if (lock.current) return;
    lock.current = true;
    setBusy('continue');
    setMessage(null);
    try {
      await onContinue();
    } catch {
      setMessage('continueError');
    } finally {
      lock.current = false;
      setBusy(null);
    }
  };
  return (
    <View style={styles.content} testID="founders-thanks-screen">
      <Image
        // Metro bundles the static image into native builds through require.
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        source={require('../../../assets/images/founders-handshake.png')}
        resizeMode="contain"
        style={styles.illustration}
        accessibilityLabel={t('founders.illustration')}
        testID="founders-handshake"
      />
      <View style={styles.copy}>
        <Text
          fontSet="onboarding"
          variant="title1"
          accessibilityRole="header"
          style={styles.centered}
        >
          {t('founders.title')}
        </Text>
        <Text fontSet="onboarding" color={colors.textMid} style={styles.centered}>
          {t('founders.story')}
        </Text>
        <Text fontSet="onboarding" color={colors.textMid} style={styles.centered}>
          {t('founders.request')}
        </Text>
        <Text fontSet="onboarding" variant="bodyS" style={styles.centered}>
          {t('founders.thanks')}
        </Text>
      </View>
      <View style={styles.actions}>
        <Button
          label={t(busy === 'store' ? 'founders.opening' : 'founders.rate')}
          icon={
            <Ionicons name="star-outline" size={onboardingLayout.icon} color={colors.onBrand} />
          }
          onPress={() => void rate()}
          disabled={busy !== null}
          loading={busy === 'store'}
          testID="founders-rate"
        />
        <Button
          variant="tertiary"
          label={t('founders.continue')}
          onPress={() => void continueSetup()}
          disabled={busy !== null}
          loading={busy === 'continue'}
          testID="founders-continue"
        />
        {message ? (
          <Text
            fontSet="onboarding"
            variant="bodyS"
            color={colors.textMid}
            style={styles.centered}
            accessibilityLiveRegion="polite"
            testID="founders-status"
          >
            {t(`founders.${message}`)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: onboardingLayout.entryWidth,
    alignSelf: 'center',
    padding: space[6],
    gap: space[5],
  },
  illustration: { width: '100%', height: onboardingLayout.foundersImageHeight },
  copy: { gap: space[3] },
  centered: { textAlign: 'center' },
  actions: { gap: space[1] },
});
