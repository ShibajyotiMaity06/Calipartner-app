import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { IndividualWorkoutsProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AccessibleChartTable, type TableColumn } from './AccessibleChartTable';
import { ChartContainer } from './ChartContainer';

interface WorkoutsChartProps {
  data?: IndividualWorkoutsProgress | null;
  loading?: boolean;
  testID?: string;
}

export function WorkoutsChart({
  data,
  loading = false,
  testID = 'workouts-chart',
}: WorkoutsChartProps) {
  const { colors } = useTheme();

  const isEmpty =
    !data ||
    (data.total_workouts === 0 &&
      (!data.exercise_progression || data.exercise_progression.length === 0));

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.workouts.empty');
    }
    return t('progress.workouts.accessibilitySummary', {
      count: data.total_workouts,
      sessions: data.sessions_per_week.toFixed(1),
      volume: Math.round(data.total_volume_kg).toLocaleString(),
    });
  }, [isEmpty, data]);

  const progression = useMemo(() => data?.exercise_progression ?? [], [data?.exercise_progression]);

  // Table representation for accessibility (CMP-14)
  const tableColumns: TableColumn[] = [
    { key: 'exercise', header: 'Exercise', width: 120 },
    { key: 'heaviest', header: 'Heaviest', width: 85, align: 'right' },
    { key: 'best1rm', header: 'Est. 1RM', width: 85, align: 'right' },
    { key: 'entries', header: 'Sessions', width: 75, align: 'center' },
  ];

  const tableRows = useMemo(() => {
    return progression.map((ex) => {
      const latest = ex.data[ex.data.length - 1];
      return {
        id: ex.exercise_name,
        exercise: ex.exercise_name,
        heaviest: latest ? `${latest.heaviest_weight_kg} kg` : '—',
        best1rm: latest ? `${latest.best_1rm_kg} kg` : '—',
        entries: ex.data.length,
      };
    });
  }, [progression]);

  return (
    <ChartContainer
      title={t('progress.workouts.title')}
      subtitle={data?.total_workouts != null ? `${data.total_workouts} total workouts` : undefined}
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.workouts.empty')}
      emptyIcon="barbell-outline"
      testID={testID}
      tableView={
        <AccessibleChartTable
          columns={tableColumns}
          rows={tableRows}
          caption="Exercise progression and strength estimates"
          testID={`${testID}-table`}
        />
      }
    >
      {/* High-level workout stat cards */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.workouts.sessionsPerWeek')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.sessions_per_week != null ? data.sessions_per_week.toFixed(1) : '--'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.workouts.totalMinutes')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.total_duration_minutes != null
              ? `${Math.round(data.total_duration_minutes)} min`
              : '-- min'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.workouts.totalVolume')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.total_volume_kg != null
              ? `${Math.round(data.total_volume_kg).toLocaleString()} kg`
              : '-- kg'}
          </Text>
        </View>
      </View>

      {/* Exercise progression list */}
      {progression.length > 0 && (
        <View style={styles.progressionSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('progress.workouts.exerciseProgression')}
          </Text>

          <View style={styles.progressionList}>
            {progression.slice(0, 5).map((exercise) => {
              const latest = exercise.data[exercise.data.length - 1];
              return (
                <View
                  key={exercise.exercise_name}
                  style={[styles.exerciseCard, { backgroundColor: colors.surfaceAlt }]}
                >
                  <Text style={[styles.exerciseName, { color: colors.text }]}>
                    {exercise.exercise_name}
                  </Text>
                  {latest && (
                    <View style={styles.exerciseMetrics}>
                      <Text style={[styles.exerciseMetric, { color: colors.textMuted }]}>
                        Heaviest:{' '}
                        <Text style={{ color: colors.text, fontWeight: '600' }}>
                          {latest.heaviest_weight_kg} kg
                        </Text>
                      </Text>
                      <Text style={[styles.exerciseMetric, { color: colors.textMuted }]}>
                        Best 1RM:{' '}
                        <Text style={{ color: colors.text, fontWeight: '600' }}>
                          {latest.best_1rm_kg} kg
                        </Text>
                      </Text>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      )}
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginVertical: spacing.xs,
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  progressionSection: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  sectionTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    marginBottom: spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  progressionList: {
    gap: spacing.xs,
  },
  exerciseCard: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  exerciseName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
    flex: 1,
  },
  exerciseMetrics: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  exerciseMetric: {
    fontSize: fontSize.xs,
  },
});
