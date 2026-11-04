import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { dark, homeLayout, radius, space, Text } from '@calipartner/ui';
import { t } from '@/i18n';
import { squadStyles as styles } from '@/components/rooms/SquadViews';

/** No fake percentage or simulated stages: the server is still building the complete plan. */
export function WeeklyPlanPreparing() {
  return (
    <View style={styles.stack} testID="weekly-plan-preparing" accessibilityLiveRegion="polite">
      <Text variant="bodyS">{t('fixNovember.weekly')}</Text>
      <Text variant="title1">{t('fixNovember.preparing')}</Text>
      <Text>{t('fixNovember.preparingHint')}</Text>
      <View style={{ ...styles.card, padding: space[5], gap: space[5] }}>
        <View style={styles.spread}>
          <Text variant="title2">{t('fixNovember.planTitle')}</Text>
          <ActivityIndicator color={dark.copper} accessibilityLabel={t('common.loading')} />
        </View>
        {(
          [
            { icon: 'barbell-outline', key: 'preparingWorkout' },
            { icon: 'restaurant-outline', key: 'preparingDiet' },
            { icon: 'calendar-outline', key: 'preparingGoals' },
          ] as const
        ).map((row) => (
          <View key={row.key} style={styles.row}>
            <View
              style={{ padding: space[3], borderRadius: radius.control, backgroundColor: dark.s2 }}
            >
              <Ionicons
                name={row.icon}
                size={homeLayout.iconSize}
                color={dark.textMid}
                accessible={false}
              />
            </View>
            <View style={styles.flex}>
              <Text>{t(`fixNovember.${row.key}`)}</Text>
            </View>
          </View>
        ))}
      </View>
    </View>
  );
}
