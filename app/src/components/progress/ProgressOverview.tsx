import React from 'react';
import { StyleSheet, View } from 'react-native';
import { dark, radius, space, Text } from '@calipartner/ui';
import {
  getPreviousDateString,
  type IndividualProgressData,
  type ProgressDateRange,
} from '@calipartner/core';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { WeightChart } from './WeightChart';
import { CaloriesChart } from './CaloriesChart';
import { MacrosChart } from './MacrosChart';
import { StepsChart } from './StepsChart';
import { WaterChart } from './WaterChart';
import { WorkoutsChart } from './WorkoutsChart';
import { t, getLocale } from '@/i18n';
import type { DayDetailData } from './DayDetailModal';

export function ProgressOverview({
  data,
  range,
  loading,
  onSelectDay,
}: {
  data: IndividualProgressData | null;
  range: ProgressDateRange;
  loading: boolean;
  onSelectDay?: (day: DayDetailData) => void;
}) {
  const { localDate } = useCurrentLocalDate();
  const count = range === '7d' ? 7 : range === '30d' ? 30 : 90;
  const start = getPreviousDateString(localDate, count - 1);
  const present = new Set(
    [
      ...(data?.calories.daily.filter((day) => day.is_logged_day).map((day) => day.date) ?? []),
    ].filter((date) => date >= start && date <= localDate),
  );
  const latest = Array.from({ length: count }, (_, index) =>
    getPreviousDateString(localDate, count - 1 - index),
  );
  const goals = data?.calories.daily.filter((day) => day.is_goal_day).length;
  return (
    <View style={styles.stack} testID="progress-overview">
      <View style={styles.card}>
        <Text variant="heading">{t('homeRefresh.showingUp')}</Text>
        <Text variant="numeralM" tabular>
          {loading
            ? t('common.loading')
            : t('homeRefresh.loggedDays', { logged: present.size, total: count })}
        </Text>
        <View style={styles.days}>
          {latest.map((date) => (
            <View
              key={date}
              style={styles.day}
              accessible
              accessibilityLabel={`${date}: ${present.has(date) ? t('repairs.logged') : t('squadDesign.noLogs')}`}
            >
              <View style={[styles.dot, present.has(date) && styles.present]}>
                <Text color={present.has(date) ? dark.onBrand : dark.textMid}>
                  {present.has(date) ? '✓' : '·'}
                </Text>
              </View>
              <Text variant="micro" color={dark.textMid}>
                {new Date(`${date}T12:00:00Z`).toLocaleDateString(getLocale(), {
                  weekday: 'narrow',
                  timeZone: 'UTC',
                })}
              </Text>
            </View>
          ))}
        </View>
        <Text variant="bodyS" color={dark.textMid}>
          {t('squadDesign.personal')}
        </Text>
      </View>
      <WeightChart data={data?.weight} loading={loading} onSelectDay={onSelectDay} />
      <View style={styles.card}>
        <Text variant="heading">{t('homeRefresh.calories')}</Text>
        <Text variant="bodyS" color={dark.textMid}>
          {goals === undefined || !data?.calories.daily.length
            ? t('homeRefresh.noProgress')
            : t('homeRefresh.inRange', { count: goals, total: data?.calories.daily.length ?? 0 })}
        </Text>
      </View>
      {Boolean(data?.calories.daily.length) && (
        <CaloriesChart data={data?.calories} loading={loading} onSelectDay={onSelectDay} />
      )}
      <MacrosChart data={data?.macros} loading={loading} />
      <WorkoutsChart data={data?.workouts} loading={loading} />
      <StepsChart data={data?.steps} loading={loading} onSelectDay={onSelectDay} />
      <WaterChart data={data?.water} loading={loading} onSelectDay={onSelectDay} />
    </View>
  );
}
const styles = StyleSheet.create({
  stack: { gap: space[4], paddingVertical: space[3] },
  card: { backgroundColor: dark.s1, borderRadius: radius.card, padding: space[4], gap: space[3] },
  days: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: space[2] },
  day: { alignItems: 'center', gap: space[1] },
  dot: {
    width: space[7],
    height: space[7],
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  present: { backgroundColor: dark.apricot, borderColor: dark.apricot },
});
