import React from 'react';
import { SafeAreaView, ScrollView, View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Text, useTheme, space, homeLayout } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { t } from '@/i18n';
export function AvatarPage({
  title,
  children,
  onBack,
  onUnavailable,
}: {
  title: string;
  children: React.ReactNode;
  onBack?: () => void;
  onUnavailable?: () => void;
}) {
  const { colors } = useTheme();
  const router = useRouter();
  const { state, loading, error, refresh } = useAvatar();
  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg0 }]}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('avatar.back')}
            onPress={
              onBack ??
              (() => (router.canGoBack() ? router.back() : router.replace('/(tabs)/today')))
            }
            testID="avatar-page-back"
          />
          <Text variant="title2" style={styles.title}>
            {title}
          </Text>
          {state?.enabled ? (
            <Button
              variant="secondary"
              fullWidth={false}
              size="sm"
              label={t('avatar.cc', { amount: state.balances.earned + state.balances.purchased })}
              onPress={() => router.push('/wallet')}
              testID="avatar-page-wallet"
            />
          ) : null}
        </View>
        {!state && loading ? (
          <Text>{t('common.loading')}</Text>
        ) : !state && error ? (
          <>
            <Text accessibilityRole="alert">{t('avatar.error')}</Text>
            <Button
              label={t('avatar.retry')}
              onPress={() => void refresh()}
              testID="avatar-page-retry"
            />
          </>
        ) : !state || !state.enabled ? (
          <>
            <Text>{t('avatar.disabled')}</Text>
            {onUnavailable ? (
              <Button
                label={t('avatar.continue')}
                onPress={onUnavailable}
                testID="avatar-disabled-continue"
              />
            ) : null}
          </>
        ) : (
          children
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  root: { flex: 1 },
  content: {
    width: '100%',
    maxWidth: homeLayout.maxContentWidth,
    alignSelf: 'center',
    padding: space[4],
    paddingBottom: space[8],
    gap: space[4],
  },
  header: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[2] },
  title: { flex: 1 },
});
