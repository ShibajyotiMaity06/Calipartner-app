import React from 'react';
import { View } from 'react-native';
import { controls, radius, space, Text, useTheme } from '@calipartner/ui';
import {
  summarizeProgress,
  type IndividualProgressData,
  type ProgressDateRange,
} from '@calipartner/core';
import { WeightChart } from './WeightChart';
import { CaloriesChart } from './CaloriesChart';
import { MacrosChart } from './MacrosChart';
import { StepsChart } from './StepsChart';
import { WaterChart } from './WaterChart';
import { WorkoutsChart } from './WorkoutsChart';
import { t } from '@/i18n';
import type { DayDetailData } from './DayDetailModal';
export type ProgressCategory = 'weight' | 'nutrition' | 'workouts' | 'photos' | 'habits';
export function ProgressOverview({
  data,
  loading,
  onSelectDay,
  category = 'weight',
}: {
  data: IndividualProgressData | null;
  range: ProgressDateRange;
  loading: boolean;
  category?: ProgressCategory;
  onSelectDay?: (day: DayDetailData) => void;
}) {
  const { colors } = useTheme();
  if (!data) return <Text>{t('homeRefresh.noProgress')}</Text>;
  const summary = summarizeProgress(data);
  const number = (
    value: number | null | undefined,
    unit: '' | 'kg' | 'kcal' | 'grams' | 'ml' = '',
    decimals = 1,
  ) =>
    value == null
      ? t('progressRefresh.missing')
      : unit
        ? t(`progressRefresh.${unit}`, { value: value.toFixed(decimals) })
        : value.toFixed(decimals);
  const stats = (values: Array<[string, string]>) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
      {values.map(([label, value]) => (
        <View
          key={label}
          style={{
            minWidth: controls.summaryMinWidth,
            flexGrow: 1,
            backgroundColor: colors.s1,
            borderRadius: radius.card,
            padding: space[3],
            gap: space[1],
          }}
        >
          <Text variant="micro" color={colors.textMid}>
            {label}
          </Text>
          <Text variant="heading" tabular>
            {value}
          </Text>
        </View>
      ))}
    </View>
  );
  return (
    <View style={{ gap: space[4] }} testID={`progress-view-${category}`}>
      {category === 'weight' && (
        <>
          {stats([
            [t('progressRefresh.rolling'), number(summary.rolling, 'kg')],
            [t('progressRefresh.lowest'), number(summary.lowest, 'kg')],
            [t('progressRefresh.periodChange'), number(summary.periodChange, 'kg')],
          ])}
          <WeightChart data={data.weight} loading={loading} onSelectDay={onSelectDay} />
        </>
      )}
      {category === 'nutrition' && (
        <>
          {stats([
            [t('progressRefresh.dailyCalories'), number(summary.calories, 'kcal', 0)],
            [t('progressRefresh.goal'), number(summary.calorieTarget, 'kcal', 0)],
            [
              t('progressRefresh.dailyProtein'),
              number(summary.foodDays ? data.macros.protein_avg_g : null, 'grams'),
            ],
          ])}
          <Text>
            {t('progressRefresh.consistency', {
              count: summary.goalDays,
              total: summary.qualifyingDays,
            })}
          </Text>
          {summary.proteinGoalPercent !== null && (
            <Text>{t('progressRefresh.proteinDays', { percent: summary.proteinGoalPercent })}</Text>
          )}
          <Text variant="bodyS" color={colors.textMid}>
            {t('progressRefresh.loggedBasis')}
          </Text>
          <CaloriesChart data={data.calories} loading={loading} onSelectDay={onSelectDay} />
          <MacrosChart data={summary.foodDays ? data.macros : null} loading={loading} />
        </>
      )}
      {category === 'workouts' && (
        <>
          {stats([
            [t('progressRefresh.sessions'), number(data.workouts.total_workouts, '', 0)],
            [t('progressRefresh.sets'), number(data.workouts.total_strength_sets, '', 0)],
            [
              t('progressRefresh.best'),
              summary.strength
                ? `${summary.strength.name}: ${number(summary.strength.value, 'kg')}`
                : t('progressRefresh.missing'),
            ],
          ])}
          <Text variant="bodyS" color={colors.textMid}>
            {t('progressRefresh.estimate')}
          </Text>
          <WorkoutsChart data={data.workouts} loading={loading} />
        </>
      )}
      {category === 'habits' && (
        <>
          <Text variant="heading">{t('progressRefresh.showingUp')}</Text>
          <Text tabular>
            {t('progressRefresh.days', { count: summary.qualifyingDays, total: summary.totalDays })}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
            {summary.dates.map(({ date, logged }) => (
              <View
                key={date}
                accessible
                accessibilityLabel={`${date}: ${t(logged ? 'repairs.logged' : 'squadDesign.noLogs')}`}
                style={{
                  width: space[7],
                  height: space[7],
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: radius.full,
                  backgroundColor: logged ? colors.s3 : colors.s1,
                }}
              >
                <Text color={logged ? colors.textHi : colors.textMid}>{logged ? '✓' : '·'}</Text>
              </View>
            ))}
          </View>
          {summary.totalDays > 90 && <Text>{t('progressRefresh.gridNote', { count: 90 })}</Text>}
          {stats([
            [t('progressRefresh.stepAverage'), number(summary.steps, '', 0)],
            [t('progressRefresh.waterAverage'), number(summary.water, 'ml', 0)],
          ])}
          <Text variant="bodyS" color={colors.textMid}>
            {t('progressRefresh.habitBasis')}
          </Text>
          <StepsChart data={data.steps} loading={loading} onSelectDay={onSelectDay} />
          <WaterChart data={data.water} loading={loading} onSelectDay={onSelectDay} />
        </>
      )}
    </View>
  );
}
