import React from 'react';
import { Pressable, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, space, Text, useTheme } from '@calipartner/ui';
import { CCBalance } from './avatar/CCBalance';
import { AppearancePicker } from './avatar/AppearancePicker';
import { t } from '@/i18n';

export function HeaderActions({ testID = 'header-coach-icon' }: { testID?: string }) {
  const router = useRouter();
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[1], flexShrink: 0 }}>
      <CCBalance />
      <AppearancePicker />
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
    </View>
  );
}
