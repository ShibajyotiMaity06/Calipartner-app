import { Button } from '@calipartner/ui';
import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, space, useTheme } from '@calipartner/ui';
import { CCBalance } from './avatar/CCBalance';
import { t } from '@/i18n';
import { SubscriptionPill } from './subscription/SubscriptionPill';

export function HeaderActions({
  testID = 'header-coach-icon',
  coins = false,
  coach = false,
  showUpgrade = true,
}: {
  testID?: string;
  coins?: boolean;
  coach?: boolean;
  showUpgrade?: boolean;
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
      {coach ? (
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('homeRefresh.ai')}
          icon={<Ionicons name="medkit-outline" size={homeLayout.iconSize} color={colors.textHi} />}
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
        />
      ) : null}
    </View>
  );
}
