import React from 'react';
import { Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { controls, useTheme } from '@calipartner/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';

export function SubscriptionPill() {
  const { currentTier, hasActiveAccess, loading, error } = useSubscription();
  const { colors } = useTheme();
  const router = useRouter();
  const tier = !loading && !error && hasActiveAccess ? currentTier : 'free';
  const pending = loading || Boolean(error);
  const label = pending
    ? 'checking'
    : tier === 'pro'
      ? 'proLabel'
      : tier === 'plus'
        ? 'goProLabel'
        : 'upgradeLabel';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t(`progressRefresh.${label}`)}
      testID="btn-header-upgrade"
      onPress={() =>
        tier === 'pro'
          ? router.push('/me')
          : tier === 'plus'
            ? router.push({ pathname: '/paywall', params: { tier: 'pro' } })
            : router.push('/paywall')
      }
      style={{
        minHeight: controls.touch,
        minWidth: controls.touch,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
      }}
    >
      <Ionicons name="flash-outline" size={controls.icon} color={colors.apricot} />
    </Pressable>
  );
}
