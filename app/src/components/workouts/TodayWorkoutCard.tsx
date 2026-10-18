import React, { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutWithDetails } from '@calipartner/core';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { WorkoutHistoryCalendarModal } from './WorkoutHistoryCalendarModal';
import { WorkoutLoggerModal } from './WorkoutLoggerModal';

interface TodayWorkoutCardProps {
  selectedDate: string; // YYYY-MM-DD
  testID?: string;
}

export function TodayWorkoutCard({
  selectedDate,
  testID = 'today-workout-card',
}: TodayWorkoutCardProps) {
  const { colors } = useTheme();
  const { workouts, loading, error, refresh, getSummary } = useWorkouts(selectedDate);

  const [loggerVisible, setLoggerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [activeDetailWorkout, setActiveDetailWorkout] = useState<WorkoutWithDetails | null>(null);

  // Compute total aggregates for the day
  const totalDuration = workouts.reduce((acc, w) => acc + w.duration_minutes, 0);
  const totalVolume = workouts.reduce((acc, w) => acc + getSummary(w).total_volume_kg, 0);
  const totalCalories = workouts.reduce((acc, w) => acc + getSummary(w).estimated_calories, 0);

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
      accessibilityRole="none"
      accessibilityLabel={t('workouts.cardTitle')}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <Ionicons name="barbell-outline" size={20} color={colors.accent} />
          <Text style={[styles.cardTitle, { color: colors.text }]}>{t('workouts.cardTitle')}</Text>
        </View>

        <View style={styles.headerButtons}>
          <TouchableOpacity
            testID="btn-today-workout-history"
            style={[styles.historyBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => setHistoryVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.historyAndCalendar')}
          >
            <Ionicons name="calendar-outline" size={16} color={colors.textMuted} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="btn-today-add-workout"
            style={[styles.addBtn, { backgroundColor: colors.accent }]}
            onPress={() => setLoggerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.addWorkout')}
          >
            <Ionicons name="add" size={16} color={colors.onAccent} />
            <Text style={[styles.addBtnText, { color: colors.onAccent }]}>
              {t('workouts.addWorkout')}
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.centerState}>
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.textMuted }]}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={24} color={colors.danger} />
          <Text style={[styles.errorText, { color: colors.danger }]}>{error.message}</Text>
          <TouchableOpacity
            testID="btn-today-workout-retry"
            style={[styles.retryBtn, { backgroundColor: colors.surfaceAlt }]}
            onPress={() => void refresh()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={{ color: colors.text, fontSize: fontSize.xs, fontWeight: '700' }}>
              {t('common.retry')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : workouts.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Text
            testID="today-workout-empty-text"
            style={[styles.emptyText, { color: colors.textMuted }]}
          >
            {t('workouts.noWorkoutsToday')}
          </Text>
          <TouchableOpacity
            testID="btn-today-empty-add-workout"
            style={[
              styles.emptyAddBtn,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            onPress={() => setLoggerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.addWorkout')}
          >
            <Ionicons name="add-circle-outline" size={16} color={colors.accent} />
            <Text style={[styles.emptyAddBtnText, { color: colors.accent }]}>
              {t('workouts.addWorkout')}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Workouts List & Day Summary */
        <View style={styles.contentWrap}>
          {/* Daily Aggregate Stats Row */}
          <View
            style={[
              styles.aggregateBanner,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <View style={styles.aggItem}>
              <Text style={[styles.aggLabel, { color: colors.textMuted }]}>
                {t('workouts.totalDuration')}
              </Text>
              <Text
                testID="today-workout-total-duration"
                style={[styles.aggValue, { color: colors.text }]}
              >
                {totalDuration} min
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.aggItem}>
              <Text style={[styles.aggLabel, { color: colors.textMuted }]}>
                {t('workouts.totalVolume')}
              </Text>
              <Text
                testID="today-workout-total-volume"
                style={[styles.aggValue, { color: colors.text }]}
              >
                {totalVolume > 0 ? `${totalVolume.toLocaleString()} kg` : '0 kg'}
              </Text>
            </View>

            <View style={[styles.divider, { backgroundColor: colors.border }]} />

            <View style={styles.aggItem}>
              <View style={styles.estLabelRow}>
                <Text style={[styles.aggLabel, { color: colors.textMuted }]}>
                  {t('workouts.estimatedCalories')}
                </Text>
                <View
                  style={[
                    styles.microBadge,
                    { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.microBadgeText, { color: colors.accent }]}>EST</Text>
                </View>
              </View>
              <Text
                testID="today-workout-total-calories"
                style={[styles.aggValue, { color: colors.text }]}
              >
                {totalCalories} kcal
              </Text>
            </View>
          </View>

          {/* List of Today's Workouts */}
          <View style={styles.workoutsList}>
            {workouts.map((w, idx) => {
              const summary = getSummary(w);
              return (
                <TouchableOpacity
                  key={w.id}
                  testID={`today-workout-item-${idx}`}
                  style={[
                    styles.workoutRow,
                    { backgroundColor: colors.background, borderColor: colors.border },
                  ]}
                  onPress={() => setActiveDetailWorkout(w)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.name || w.type}, ${w.duration_minutes} minutes`}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={[styles.workoutRowName, { color: colors.text }]}>
                        {w.name || t(`workouts.types.${w.type}` as const)}
                      </Text>
                      <View
                        style={[
                          styles.typeTag,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        ]}
                      >
                        <Text style={[styles.typeTagText, { color: colors.textMuted }]}>
                          {t(`workouts.types.${w.type}` as const)}
                        </Text>
                      </View>
                    </View>

                    <Text style={[styles.workoutRowSub, { color: colors.textMuted }]}>
                      {w.duration_minutes} min • {w.exercises.length} exercises
                      {summary.total_volume_kg > 0 ? ` • ${summary.total_volume_kg} kg` : ''}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* Workout Logger Modal */}
      <WorkoutLoggerModal
        visible={loggerVisible}
        defaultDate={selectedDate}
        onClose={() => setLoggerVisible(false)}
        onSaved={() => {
          setLoggerVisible(false);
          void refresh();
        }}
      />

      {/* Workout History & Calendar Modal */}
      <WorkoutHistoryCalendarModal
        visible={historyVisible}
        onClose={() => setHistoryVisible(false)}
        onWorkoutSelected={(w) => {
          setActiveDetailWorkout(w);
        }}
      />

      {/* Workout Detail Modal */}
      {activeDetailWorkout && (
        <WorkoutDetailModal
          visible={Boolean(activeDetailWorkout)}
          workout={activeDetailWorkout}
          onClose={() => {
            setActiveDetailWorkout(null);
            void refresh();
          }}
          onDeleted={() => {
            setActiveDetailWorkout(null);
            void refresh();
          }}
          onUpdated={() => {
            setActiveDetailWorkout(null);
            void refresh();
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  cardTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  historyBtn: {
    padding: 6,
    borderRadius: radius.pill,
  },
  addBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  centerState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: 6,
  },
  stateText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  retryBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  emptyText: {
    fontSize: fontSize.xs,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  emptyAddBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  contentWrap: {
    gap: spacing.sm,
  },
  aggregateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  aggItem: {
    alignItems: 'center',
    gap: 2,
  },
  aggLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  estLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  microBadge: {
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 3,
    borderWidth: 0.5,
  },
  microBadgeText: {
    fontSize: 7,
    fontWeight: '800',
  },
  aggValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: 1,
    height: 24,
  },
  workoutsList: {
    gap: 6,
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  workoutRowName: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  typeTagText: {
    fontSize: 9,
    fontWeight: '600',
  },
  workoutRowSub: {
    fontSize: fontSize.xs,
  },
});
