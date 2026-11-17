import React from 'react';
import { ScrollView, View } from 'react-native';
import { controls, radius, space, Text, useTheme } from '@calipartner/ui';
import type { IndividualWorkoutsProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { AccessibleChartTable, type TableColumn } from './AccessibleChartTable';
import { ChartContainer } from './ChartContainer';

export function WorkoutsChart({
  data,
  loading = false,
  testID = 'workouts-chart',
}: {
  data?: IndividualWorkoutsProgress | null;
  loading?: boolean;
  testID?: string;
}) {
  const { colors } = useTheme();
  const empty = !data || !data.total_workouts;
  const progression = data?.exercise_progression ?? [];
  const value = (n: number | undefined, unit: 'kg' | 'minutes') =>
    n ? t(`progressRefresh.${unit}`, { value: n.toFixed(1) }) : t('progressRefresh.missing');
  const columns: TableColumn[] = [
    { key: 'exercise', header: t('progressRefresh.exercise') },
    { key: 'heaviest', header: t('progressRefresh.heaviest'), align: 'right' },
    { key: 'best', header: t('progressRefresh.estimated'), align: 'right' },
    { key: 'days', header: t('progressRefresh.daysTracked'), align: 'right' },
  ];
  const rows = progression.map((ex) => ({
    id: ex.exercise_id ?? ex.exercise_name,
    exercise: ex.exercise_name,
    heaviest: value(Math.max(...ex.data.map((d) => d.heaviest_weight_kg)), 'kg'),
    best: value(Math.max(...ex.data.map((d) => d.best_1rm_kg)), 'kg'),
    days: ex.data.length,
  }));
  const frequency = data?.daily_sessions ?? [];
  const max = Math.max(1, ...frequency.map((day) => day.sessions));
  return (
    <ChartContainer
      title={t('progress.workouts.title')}
      subtitle={t('progressRefresh.totalWorkouts', { count: data?.total_workouts ?? 0 })}
      accessibilitySummary={
        empty
          ? t('progress.workouts.empty')
          : t('progress.workouts.accessibilitySummary', {
              count: data.total_workouts,
              sessions: data.sessions_per_week.toFixed(1),
              volume: Math.round(data.total_volume_kg).toLocaleString(),
            })
      }
      loading={loading}
      empty={empty}
      emptyMessage={t('progress.workouts.empty')}
      emptyIcon="barbell-outline"
      testID={testID}
      tableView={
        <AccessibleChartTable
          columns={columns}
          rows={rows}
          caption={t('progressRefresh.workoutTable')}
          testID={`${testID}-table`}
        />
      }
    >
      <View style={{ gap: space[3] }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
          {[
            [t('progress.workouts.sessionsPerWeek'), data?.sessions_per_week.toFixed(1)],
            [t('progress.workouts.totalMinutes'), value(data?.total_duration_minutes, 'minutes')],
            [t('progress.workouts.totalVolume'), value(data?.total_volume_kg, 'kg')],
          ].map(([label, amount]) => (
            <View
              key={label}
              style={{ minWidth: controls.summaryMinWidth, flexGrow: 1, gap: space[1] }}
            >
              <Text variant="micro" color={colors.textMid}>
                {label}
              </Text>
              <Text tabular>{amount}</Text>
            </View>
          ))}
        </View>
        {frequency.length > 0 && (
          <>
            <Text variant="heading">{t('progressRefresh.frequency')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator testID={`${testID}-frequency`}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
                {frequency.map((day) => (
                  <View
                    key={day.date}
                    accessible
                    accessibilityLabel={t('progressRefresh.sessionsOn', {
                      date: day.date,
                      count: day.sessions,
                    })}
                    style={{ minWidth: controls.touch, alignItems: 'center', gap: space[1] }}
                  >
                    <Text tabular variant="micro">
                      {day.sessions}
                    </Text>
                    <View
                      style={{
                        width: space[6],
                        height: (space[9] * day.sessions) / max,
                        minHeight: space[1],
                        backgroundColor: colors.textMid,
                        borderRadius: radius.control,
                      }}
                    />
                    <Text variant="micro" tabular>
                      {day.date.slice(5)}
                    </Text>
                  </View>
                ))}
              </View>
            </ScrollView>
          </>
        )}
        {rows.length > 0 && (
          <AccessibleChartTable
            columns={columns}
            rows={rows}
            caption={t('progressRefresh.workoutTable')}
            testID={`${testID}-records`}
          />
        )}
      </View>
    </ChartContainer>
  );
}
