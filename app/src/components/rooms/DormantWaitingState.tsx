import React, { useState } from 'react';
import { Pressable, Share, StyleSheet, View } from 'react-native';
import { setStringAsync } from 'expo-clipboard';
import { Text, onboardingLayout as layout, radius, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';

export function DormantWaitingState({ roomCode }: { roomCode: string }) {
  const { colors } = useTheme();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(false);
  const copy = async () => {
    setError(false);
    setCopied(false);
    try {
      if (!(await setStringAsync(roomCode))) {
        setError(true);
        return;
      }
      setCopied(true);
    } catch {
      setError(true);
    }
  };
  const share = async () => {
    setError(false);
    try {
      await Share.share({ message: t('rooms.dormant.shareMessage', { code: roomCode }) });
    } catch {
      setError(true);
    }
  };
  return (
    <View style={styles.container} testID="room-waiting-state">
      <Text variant="title2" fontSet="onboarding" color={colors.textHi} accessibilityRole="header">
        {t('rooms.dormant.title')}
      </Text>
      <Text fontSet="onboarding" color={colors.textMid}>
        {t('rooms.dormant.subtitle')}
      </Text>
      <View style={[styles.code, { backgroundColor: colors.s1, borderColor: colors.hairline }]}>
        <Text
          variant="title2"
          fontSet="onboarding"
          color={colors.textHi}
          tabular
          selectable
          testID="waiting-room-code"
        >
          {roomCode}
        </Text>
      </View>
      <View style={styles.actions}>
        <Pressable
          onPress={() => void copy()}
          accessibilityRole="button"
          accessibilityLabel={t('rooms.dormant.copyBtn')}
          testID="btn-dormant-copy-code"
          style={({ pressed }) => [
            styles.button,
            { backgroundColor: pressed ? colors.s2 : colors.s1, borderColor: colors.hairline },
          ]}
        >
          <Text fontSet="onboarding" color={colors.textHi} accessibilityLiveRegion="polite">
            {t(copied ? 'rooms.dormant.copied' : 'rooms.dormant.copyBtn')}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => void share()}
          accessibilityRole="button"
          accessibilityLabel={t('rooms.dormant.shareBtn')}
          testID="btn-dormant-share-code"
          style={({ pressed }) => [
            styles.button,
            {
              backgroundColor: pressed ? colors.apricotPressed : colors.apricot,
              borderColor: colors.apricot,
            },
          ]}
        >
          <Text fontSet="onboarding" color={colors.onBrand}>
            {t('rooms.dormant.shareBtn')}
          </Text>
        </Pressable>
      </View>
      {error ? (
        <Text accessibilityRole="alert" color={colors.danger}>
          {t('rooms.dormant.actionError')}
        </Text>
      ) : null}
    </View>
  );
}
const styles = StyleSheet.create({
  container: { gap: space[4], padding: space[4] },
  code: {
    padding: space[5],
    borderWidth: layout.border,
    borderRadius: radius.card,
    alignItems: 'center',
  },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  button: {
    maxWidth: '100%',
    minHeight: layout.touch,
    padding: space[4],
    borderWidth: layout.border,
    borderRadius: radius.button,
    justifyContent: 'center',
    alignItems: 'center',
    flexGrow: 1,
  },
});
