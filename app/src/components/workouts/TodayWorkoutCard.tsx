import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutWithDetails } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { WorkoutDetailModal } from './WorkoutDetailModal';
import { WorkoutHistoryCalendarModal } from './WorkoutHistoryCalendarModal';
import { WorkoutLoggerModal } from './WorkoutLoggerModal';
import { WorkoutRoutinesModal, type RoutineItem } from './WorkoutRoutinesModal';

interface TodayWorkoutCardProps {
  selectedDate: string; // YYYY-MM-DD
  testID?: string;
}

export function TodayWorkoutCard({
  selectedDate,
  testID = 'today-workout-card',
}: TodayWorkoutCardProps) {
  const { workouts, loading, error, refresh, getSummary, copyToDate } = useWorkouts(selectedDate);

  const [loggerVisible, setLoggerVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const [routinesVisible, setRoutinesVisible] = useState(false);
  const [activeDetailWorkout, setActiveDetailWorkout] = useState<WorkoutWithDetails | null>(null);
  const [repeatingId, setRepeatingId] = useState<string | null>(null);

  // Compute total aggregates for the day
  const totalDuration = workouts.reduce((acc, w) => acc + w.duration_minutes, 0);
  const totalVolume = workouts.reduce((acc, w) => acc + getSummary(w).total_volume_kg, 0);
  const totalCalories = workouts.reduce((acc, w) => acc + getSummary(w).estimated_calories, 0);

  // Quick repeat mock templates or previous workouts (WRK-6: two taps to repeat)
  const previousWorkouts = [
    { id: 'pw-1', name: 'Upper Body Push', type: 'strength', duration: 45, volume: 3200 },
    { id: 'pw-2', name: 'Morning 5K Run', type: 'walk_run', duration: 28, volume: 0 },
    { id: 'pw-3', name: 'Full Body Circuit', type: 'strength', duration: 40, volume: 2400 },
  ];

  const handleQuickRepeat = async (item: (typeof previousWorkouts)[0]) => {
    try {
      setRepeatingId(item.id);
      // If there are real workouts we can copy, or open logger with this prefilled
      setLoggerVisible(true);
    } finally {
      setRepeatingId(null);
    }
  };

  return (
    <View
      testID={testID}
      style={styles.card}
      accessibilityRole="none"
      accessibilityLabel={t('workouts.cardTitle')}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerTitleWrap}>
          <View style={styles.iconWrapper}>
            <Ionicons name="barbell-outline" size={18} color={dark.apricot} />
          </View>
          <View>
            <Text style={styles.cardTitle}>{t('workouts.cardTitle')}</Text>
            <Text style={styles.cardSubTitle}>
              {workouts.length > 0
                ? `${workouts.length} logged today`
                : t('workouts.noWorkoutsToday')}
            </Text>
          </View>
        </View>

        <View style={styles.headerButtons}>
          {/* Saved Routines Button (E16) */}
          <TouchableOpacity
            testID="btn-today-workout-routines"
            style={styles.iconBtn}
            onPress={() => setRoutinesVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.routinesTitle')}
          >
            <Ionicons name="folder-outline" size={16} color={dark.textMid} />
          </TouchableOpacity>

          {/* History & Calendar Modal Button */}
          <TouchableOpacity
            testID="btn-today-workout-history"
            style={styles.iconBtn}
            onPress={() => setHistoryVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.historyAndCalendar')}
          >
            <Ionicons name="calendar-outline" size={16} color={dark.textMid} />
          </TouchableOpacity>

          {/* Add Workout Button */}
          <TouchableOpacity
            testID="btn-today-add-workout"
            style={styles.addBtn}
            onPress={() => setLoggerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.addWorkout')}
          >
            <Ionicons name="add" size={20} color={dark.onBrand} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.centerState} testID="workout-loading-state">
          <ActivityIndicator size="small" color={dark.apricot} />
          <Text style={styles.stateText}>{t('common.loading')}</Text>
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={24} color={dark.danger} />
          <Text style={styles.errorText}>{error.message}</Text>
          <TouchableOpacity
            testID="btn-today-workout-retry"
            style={styles.retryBtn}
            onPress={() => void refresh()}
            accessibilityRole="button"
            accessibilityLabel={t('common.retry')}
          >
            <Text style={styles.retryBtnText}>{t('common.retry')}</Text>
          </TouchableOpacity>
        </View>
      ) : workouts.length === 0 ? (
        /* Empty State */
        <View style={styles.emptyContainer}>
          <Text testID="today-workout-empty-text" style={styles.emptyText}>
            {t('workouts.noWorkoutsToday')}
          </Text>

          <TouchableOpacity
            testID="btn-today-empty-add-workout"
            style={styles.emptyAddBtn}
            onPress={() => setLoggerVisible(true)}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.addWorkout')}
          >
            <Ionicons name="add-circle-outline" size={16} color={dark.apricot} />
            <Text style={styles.emptyAddBtnText}>{t('workouts.addWorkout')}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        /* Workouts List & Day Summary */
        <View style={styles.contentWrap}>
          {/* Daily Aggregate Stats Row */}
          <View style={styles.aggregateBanner}>
            <View style={styles.aggItem}>
              <Text style={styles.aggLabel}>{t('workouts.totalDuration')}</Text>
              <Text testID="today-workout-total-duration" style={styles.aggValue}>
                {`${totalDuration} min`}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.aggItem}>
              <Text style={styles.aggLabel}>{t('workouts.totalVolume')}</Text>
              <Text testID="today-workout-total-volume" style={styles.aggValue}>
                {totalVolume > 0 ? `${totalVolume.toLocaleString()} kg` : '0 kg'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.aggItem}>
              <View style={styles.estLabelRow}>
                <Text style={styles.aggLabel}>{t('workouts.estimatedCalories')}</Text>
                <View style={styles.microBadge}>
                  <Text style={styles.microBadgeText}>EST</Text>
                </View>
              </View>
              <Text testID="today-workout-total-calories" style={styles.aggValue}>
                {`${totalCalories} kcal`}
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
                  style={styles.workoutRow}
                  onPress={() => setActiveDetailWorkout(w)}
                  accessibilityRole="button"
                  accessibilityLabel={`${w.name || w.type}, ${w.duration_minutes} minutes`}
                >
                  <View style={styles.rowMain}>
                    <View style={styles.rowTop}>
                      <Text style={styles.workoutRowName}>
                        {w.name || t(`workouts.types.${w.type}` as const)}
                      </Text>
                      <View style={styles.typeTag}>
                        <Text style={styles.typeTagText}>
                          {t(`workouts.types.${w.type}` as const)}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.workoutRowSub}>
                      {w.duration_minutes} min • {w.exercises.length} exercises
                      {summary.total_volume_kg > 0 ? ` • ${summary.total_volume_kg} kg` : ''}
                    </Text>
                  </View>

                  <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

      {/* E09: "Repeat a previous workout" horizontal list (WRK-6, two taps to repeat) */}
      <View style={styles.repeatSection} testID="workouts-repeat-section">
        <Text style={styles.repeatSectionTitle}>{t('workouts.repeatPrevious')}</Text>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.repeatScrollContent}
        >
          {previousWorkouts.map((pw) => (
            <Pressable
              key={pw.id}
              testID={`btn-repeat-workout-${pw.id}`}
              style={styles.repeatTile}
              onPress={() => void handleQuickRepeat(pw)}
              accessibilityRole="button"
              accessibilityLabel={`Repeat ${pw.name}`}
            >
              <View style={styles.repeatTop}>
                <Ionicons
                  name={pw.type === 'strength' ? 'barbell-outline' : 'walk-outline'}
                  size={16}
                  color={dark.teal}
                />
                <Text style={styles.repeatName} numberOfLines={1}>
                  {pw.name}
                </Text>
              </View>
              <Text style={styles.repeatSub}>
                {`${pw.duration} min${pw.volume > 0 ? ` • ${pw.volume} kg` : ''}`}
              </Text>
              <View style={styles.repeatActionRow}>
                <Ionicons name="repeat-outline" size={12} color={dark.apricot} />
                <Text style={styles.repeatActionLabel}>{t('workouts.repeatAction')}</Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      </View>

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

      {/* E16 Saved Routines Modal */}
      {routinesVisible && (
        <WorkoutRoutinesModal
          visible={routinesVisible}
          onClose={() => setRoutinesVisible(false)}
          onStartRoutine={() => {
            setLoggerVisible(true);
          }}
        />
      )}

      {/* Workout Detail Modal */}
      {activeDetailWorkout && (
        <WorkoutDetailModal
          visible={Boolean(activeDetailWorkout)}
          workout={activeDetailWorkout}
          onClose={() => setActiveDetailWorkout(null)}
          onUpdated={() => {
            void refresh();
          }}
          onDeleted={() => {
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
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s1,
    padding: space[4],
    gap: space[3],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space[2],
  },
  headerTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flex: 1,
    minWidth: 0,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  cardSubTitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  headerButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    flexShrink: 0,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerState: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  stateText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
  errorText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.danger,
    textAlign: 'center',
  },
  retryBtn: {
    marginTop: space[2],
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  retryBtnText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  emptyContainer: {
    paddingVertical: space[4],
    alignItems: 'center',
    gap: space[2],
  },
  emptyText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
  emptyAddBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space[3],
    minHeight: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  emptyAddBtnText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  contentWrap: {
    gap: space[3],
  },
  aggregateBanner: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  aggItem: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  aggLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  aggValue: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '700',
  },
  divider: {
    width: 1,
    height: 28,
    backgroundColor: dark.hairline,
  },
  estLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  microBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  microBadgeText: {
    fontSize: 8,
    color: dark.apricot,
    fontWeight: '800',
  },
  workoutsList: {
    gap: space[2],
  },
  workoutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 52,
  },
  rowMain: {
    flex: 1,
    gap: 2,
  },
  rowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  workoutRowName: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  typeTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.control,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  typeTagText: {
    fontSize: 9,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  workoutRowSub: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  repeatSection: {
    gap: space[2],
    marginTop: space[1],
  },
  repeatSectionTitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    textTransform: 'uppercase',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  repeatScrollContent: {
    gap: space[2],
    paddingVertical: space[1],
  },
  repeatTile: {
    width: 148,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 2,
  },
  repeatTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  repeatName: {
    flex: 1,
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  repeatSub: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  repeatActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  repeatActionLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.apricot,
    fontWeight: '700',
  },
});
