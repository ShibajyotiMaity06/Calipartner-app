import React from 'react';
import { View } from 'react-native';
import { Text, space } from '@calipartner/ui/v1';
import type { IndividualProgressData, ProgressDateRange, WeightLog } from '@calipartner/core';
import { t } from '@/i18n';
import type { DayDetailData } from './DayDetailModal';
import {
  ProgressHabitsTabV1,
  ProgressNutritionTabV1,
  ProgressWeightTabV1,
  ProgressWorkoutsTabV1,
} from './ProgressV1Components';

export type ProgressCategory = 'weight' | 'nutrition' | 'workouts' | 'photos' | 'habits';

export interface ProgressOverviewProps {
  data: IndividualProgressData | null;
  range: ProgressDateRange;
  loading: boolean;
  category?: ProgressCategory;
  onSelectDay?: (day: DayDetailData) => void;
  weight?: {
    logs: WeightLog[];
    startingWeightKg: number | null;
    latestLog: WeightLog | null;
    latestTrendKg: number | null;
    weeklyPaceKg: number | null;
    projectedDate: string | null;
  };
  targetWeightKg?: number | null;
  useLb?: boolean;
  onLogWeight?: () => void;
  onOpenHistory?: () => void;
  onOpenWorkoutCalendar?: () => void;
}

export function ProgressOverview({
  data,
  onSelectDay,
  category = 'weight',
  weight,
  targetWeightKg = null,
  useLb = false,
  onLogWeight,
  onOpenHistory,
  onOpenWorkoutCalendar,
}: ProgressOverviewProps) {
  if (!data) {
    return (
      <Text variant="body" color="textLo">
        {t('homeRefresh.noProgress')}
      </Text>
    );
  }

  const noop = () => {};
  const noopDay = (_day: DayDetailData) => {};

  const safeWeight = weight ?? {
    logs: [],
    startingWeightKg: data.weight.start_weight_kg,
    latestLog: null,
    latestTrendKg: data.weight.current_trend_kg,
    weeklyPaceKg: data.weight.weekly_pace_kg,
    projectedDate: data.weight.projected_date,
  };

  return (
    <View style={{ gap: space.md }} testID={`progress-view-${category}`}>
      {category === 'weight' ? (
        <ProgressWeightTabV1
          data={data}
          weight={safeWeight}
          targetWeightKg={targetWeightKg ?? data.weight.target_weight_kg}
          useLb={useLb}
          onLogWeight={onLogWeight ?? noop}
          onOpenHistory={onOpenHistory ?? noop}
        />
      ) : null}

      {category === 'nutrition' ? (
        <ProgressNutritionTabV1 data={data} onSelectDay={onSelectDay ?? noopDay} />
      ) : null}

      {category === 'workouts' ? (
        <ProgressWorkoutsTabV1 data={data} onOpenCalendar={onOpenWorkoutCalendar ?? noop} />
      ) : null}

      {category === 'habits' ? (
        <ProgressHabitsTabV1 data={data} onSelectDay={onSelectDay ?? noopDay} />
      ) : null}
    </View>
  );
}
