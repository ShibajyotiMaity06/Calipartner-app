import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type { Goal } from '@calipartner/core';
import { Text, onboardingLayout as layout, radius, space, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function MotivationStep({ goal }: { goal: Goal }) {
  const { colors } = useTheme();
  return (
    <View style={planStyles.section} testID={`motivation-${goal}`}>
      <Text variant="title1" accessibilityRole="header" testID="onboarding-title">
        {t('entryRefresh.whyTitle')}
      </Text>
      <Text variant="bodyS" color={colors.textMid}>
        {t('entryRefresh.whySubtitle')}
      </Text>
      <View style={styles.pillars}>
        {(
          [
            ['eat', 'restaurant-outline'],
            ['train', 'barbell-outline'],
            ['together', 'people-outline'],
          ] as const
        ).map(([key, icon]) => (
          <View key={key} style={styles.pillar}>
            <View style={[styles.icon, { backgroundColor: colors.s1 }]}>
              <Ionicons name={icon} size={layout.icon} color={colors.apricot} />
            </View>
            <Text variant="label" style={styles.center}>
              {t(`entryRefresh.${key}`)}
            </Text>
            <Text variant="micro" color={colors.textMid} style={styles.center}>
              {t(`entryRefresh.${key}Detail`)}
            </Text>
          </View>
        ))}
      </View>
      <PlanCard testID="motivation-journey">
        <Text variant="label" color={colors.textMid}>
          {t('entryRefresh.where')}
        </Text>
        <View accessible accessibilityLabel={t('entryRefresh.journeySummary')}>
          <Svg width="100%" height={layout.chartHeight} viewBox="0 0 320 132" accessible={false}>
            <Path
              d="M16 112 C62 112 83 104 112 100 S188 81 208 72 S275 44 304 26"
              fill="none"
              stroke={colors.hairlineLit}
              strokeWidth={layout.chartStroke}
            />
            {[
              [16, 112],
              [112, 100],
              [208, 72],
              [304, 26],
            ].map(([cx, cy], index) => (
              <Circle
                key={index}
                cx={cx}
                cy={cy}
                r={index === 0 ? layout.chartActiveDot : layout.chartDot}
                fill={index === 0 ? colors.apricot : colors.s1}
                stroke={index === 0 ? colors.apricot : colors.hairlineLit}
                strokeWidth={layout.chartStroke}
              />
            ))}
          </Svg>
        </View>
        <View style={styles.weeks}>
          {[1, 4, 8, 12].map((week) => (
            <Text variant="micro" color={colors.textMid} key={week} tabular>
              {t('entryRefresh.week', { week })}
            </Text>
          ))}
        </View>
        <Text variant="micro" color={colors.textMid}>
          {t('entryRefresh.journeyCaption')}
        </Text>
        <View style={[styles.weekOne, { borderTopColor: colors.hairline }]}>
          <Text variant="title2">{t('entryRefresh.weekOne')}</Text>
          <Text variant="bodyS">{t('entryRefresh.weekOneBody')}</Text>
        </View>
      </PlanCard>
      <Text variant="micro" color={colors.textMid}>
        {t('entryRefresh.journeyNote')}
      </Text>
    </View>
  );
}
const styles = StyleSheet.create({
  pillars: { flexDirection: 'row', flexWrap: 'wrap', gap: space[2], marginVertical: space[2] },
  pillar: { flex: 1, minWidth: layout.entryLogo, alignItems: 'center', gap: space[1] },
  center: { textAlign: 'center' },
  icon: {
    minWidth: layout.touch,
    minHeight: layout.touch,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: space[2],
  },
  weeks: { flexDirection: 'row', justifyContent: 'space-between' },
  weekOne: { gap: space[2], paddingTop: space[4], borderTopWidth: layout.border },
});
