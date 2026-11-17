import React from 'react';
import { Pressable, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { controls, radius, space, Text, useTheme } from '@calipartner/ui';
import { useSubscription } from '@/hooks/useSubscription';
import { t } from '@/i18n';

export function SubscriptionPill() {
  const { currentTier, hasActiveAccess, loading, error } = useSubscription();
  const { colors } = useTheme();
  const router = useRouter();
  const tier = !loading && !error && hasActiveAccess ? currentTier : 'free';
  const pending = loading || Boolean(error);
  const key = pending ? 'plans' : tier === 'pro' ? 'pro' : tier === 'plus' ? 'goPro' : 'upgrade';
  const label = pending
    ? 'checking'
    : tier === 'pro'
      ? 'proLabel'
      : tier === 'plus'
        ? 'goProLabel'
        : 'upgradeLabel';
  const accent = !pending && tier === 'free';
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
        flexShrink: 0,
      }}
    >
      <View
        style={{
          minHeight: controls.pill,
          borderRadius: radius.full,
          paddingHorizontal: space[3],
          paddingVertical: space[1],
          borderWidth: controls.border,
          borderColor: accent || tier === 'pro' ? colors.apricot : colors.hairline,
          backgroundColor: accent ? colors.apricot : colors.s2,
          flexDirection: 'row',
          alignItems: 'center',
          gap: space[1],
        }}
      >
        <Ionicons
          name="diamond-outline"
          size={controls.icon}
          color={accent ? colors.onBrand : colors.textHi}
        />
        <Text variant="label" color={accent ? colors.onBrand : colors.textHi}>
          {t(`progressRefresh.${key}`)}
        </Text>
      </View>
    </Pressable>
  );
}
