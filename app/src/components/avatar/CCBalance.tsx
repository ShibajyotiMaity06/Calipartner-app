import React from 'react';
import { Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Text, avatarLayout } from '@calipartner/ui';
import { useAvatar } from '@/hooks/useAvatar';
import { t } from '@/i18n';
export function CCBalance() {
  const { state } = useAvatar();
  const router = useRouter();
  if (!state?.enabled) return null;
  return (
    <Pressable
      onPress={() => router.push('/wallet')}
      accessibilityRole="button"
      accessibilityLabel={t('avatar.wallet')}
      testID="header-cc-balance"
      style={{ minHeight: avatarLayout.tapSize, justifyContent: 'center' }}
    >
      <Text variant="label" tabular>
        {t('avatar.cc', { amount: state.balances.earned + state.balances.purchased })}
      </Text>
    </Pressable>
  );
}
