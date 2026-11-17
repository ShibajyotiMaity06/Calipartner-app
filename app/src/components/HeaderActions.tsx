import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, space, Text, useTheme } from '@calipartner/ui';
import { CCBalance } from './avatar/CCBalance';
import { AppearancePicker } from './avatar/AppearancePicker';
import { t } from '@/i18n';
import { SubscriptionPill } from './subscription/SubscriptionPill';

export function HeaderActions({
  testID = 'header-coach-icon',
  coins = false,
  coach = false,
  showUpgrade = true,
  appearance = false,
}: {
  testID?: string;
  coins?: boolean;
  coach?: boolean;
  showUpgrade?: boolean;
  appearance?: boolean;
}) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: space[1],
        flexShrink: 1,
        flexWrap: 'wrap',
        maxWidth: '100%',
      }}
    >
      {showUpgrade ? <SubscriptionPill /> : null}
      {coins ? <CCBalance /> : null}
      {appearance ? <AppearancePicker /> : null}
      {coach ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('homeRefresh.coach')}
          testID={testID}
          onPress={() => router.push('/coach')}
          style={{
            minWidth: homeLayout.touchSize,
            minHeight: homeLayout.touchSize,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="medkit-outline" size={homeLayout.iconSize} color={colors.textHi} />
          <Text variant="micro" color={colors.textMid}>
            {t('homeRefresh.ai')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
