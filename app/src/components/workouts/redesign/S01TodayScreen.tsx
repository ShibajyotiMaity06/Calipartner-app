import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import {
  SegmentedTabs,
  PrimaryButton,
  SecondaryButton,
  TextButton,
  StickyCtaBar,
  BannerError,
  SkeletonRow,
  type WorkoutTabId,
} from '../s_common';
import type { GeneratedWorkoutPlan, GeneratedPlanDay } from '@calipartner/core';
import type {
  ActiveWorkoutSession,
  ActivityLogItem,
  PersonalBestItem,
} from '@/services/workoutRedesignService';

interface S01TodayScreenProps {
  currentTab: WorkoutTabId;
  onChangeTab: (tab: WorkoutTabId) => void;
  selectedDate: string;
  todayDate: string;
  activePlan: GeneratedWorkoutPlan | null;
  todayPlanDay: GeneratedPlanDay | null;
  upNextPlanDay: GeneratedPlanDay | null;
  inProgressSession: ActiveWorkoutSession | null;
  completedTodaySession: ActiveWorkoutSession | null;
  activityLogs: ActivityLogItem[];
  personalBests: PersonalBestItem[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  onOpenSettings: () => void;
  onOpenCalendar: () => void;
  onStartWorkout: () => void;
  onResumeWorkout: () => void;
  onTrainAnyway: () => void;
  onEditToday: () => void;
  onOpenUpNextDay: (day: GeneratedPlanDay) => void;
  onLogActivity: () => void;
  onEditActivity: (item: ActivityLogItem) => void;
  onDeleteActivity: (id: string) => void;
  onViewInHistory: () => void;
  weekDays: {
    weekday: number;
    date: string;
    isToday: boolean;
    isDone: boolean;
    isRest: boolean;
    dayNumber: number;
  }[];
  trainingDaysCount: number;
  completedDaysCount: number;
}

export function S01TodayScreen({
  currentTab,
  onChangeTab,
  selectedDate,
  todayDate,
  activePlan,
  todayPlanDay,
  upNextPlanDay,
  inProgressSession,
  completedTodaySession,
  activityLogs,
  personalBests,
  loading,
  error,
  onRetry,
  onOpenSettings,
  onOpenCalendar,
  onStartWorkout,
  onResumeWorkout,
  onTrainAnyway,
  onEditToday,
  onOpenUpNextDay,
  onLogActivity,
  onEditActivity,
  onDeleteActivity,
  onViewInHistory,
  weekDays,
  trainingDaysCount,
  completedDaysCount,
}: S01TodayScreenProps) {
  const isRestDay = todayPlanDay?.is_rest ?? false;
  const isCompleted = !!completedTodaySession;
  const isInProgress = !!inProgressSession;

  const handleDeleteActivity = (item: ActivityLogItem) => {
    Alert.alert(
      'Delete this log?',
      'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => onDeleteActivity(item.id) },
      ],
      { cancelable: true },
    );
  };

  const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

  return (
    <View style={styles.screenContainer} testID="s01-today-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Workout</Text>
          <Text style={styles.headerSubtitle}>{selectedDate}</Text>
        </View>
        <View style={styles.headerRight}>
          <Pressable
            testID="workout-header-settings"
            accessibilityRole="button"
            accessibilityLabel="Workout settings"
            onPress={onOpenSettings}
            style={styles.headerIconBtn}
          >
            <Ionicons name="settings-outline" size={22} color={workoutTokens.text} />
          </Pressable>
          <Pressable
            testID="workout-header-calendar"
            accessibilityRole="button"
            accessibilityLabel="Pick date"
            onPress={onOpenCalendar}
            style={styles.headerIconBtn}
          >
            <Ionicons name="calendar-outline" size={22} color={workoutTokens.text} />
          </Pressable>
        </View>
      </View>

      {/* Segmented Tabs */}
      <View style={styles.tabsWrapper}>
        <SegmentedTabs activeTab={currentTab} onChangeTab={onChangeTab} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {error ? <BannerError message={error} onRetry={onRetry} /> : null}

        {/* Week Strip */}
        <View style={styles.weekStripContainer} testID="week-strip">
          <View style={styles.weekStripRow}>
            {weekDays.map((d, idx) => {
              return (
                <View key={d.date} style={styles.dayCol}>
                  <Text style={[styles.dayLabel, d.isToday && styles.todayLabel]}>
                    {dayNames[idx]}
                  </Text>
                  <View
                    style={[
                      styles.dayCircle,
                      d.isDone && styles.dayDone,
                      !d.isDone && d.isToday && styles.dayTodayPending,
                      !d.isDone && !d.isToday && d.isRest && styles.dayRest,
                      !d.isDone && !d.isToday && !d.isRest && styles.dayPlanned,
                    ]}
                  >
                    {d.isDone ? (
                      <Ionicons name="checkmark" size={16} color={workoutTokens.accent} />
                    ) : (
                      <Text
                        style={[
                          styles.dayNumberText,
                          d.isToday && styles.dayNumberTextToday,
                          d.isRest && styles.dayNumberTextRest,
                        ]}
                      >
                        {d.dayNumber}
                      </Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
          <Text style={styles.weekStripCaption}>
            {completedDaysCount} of {trainingDaysCount} workouts done
          </Text>
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <SkeletonRow height={140} />
            <SkeletonRow height={64} />
          </View>
        ) : isInProgress ? (
          /* S28: In Progress State */
          <View style={styles.inProgressCard} testID="s28-in-progress-card">
            <View style={styles.cardHeaderRow}>
              <View style={styles.inProgressBadge}>
                <View style={styles.liveDot} />
                <Text style={styles.inProgressBadgeText}>In progress</Text>
              </View>
            </View>
            <Text style={styles.cardTitle}>{inProgressSession?.name || todayPlanDay?.name}</Text>
            <Text style={styles.inProgressStats}>
              {inProgressSession?.exercises.reduce(
                (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
                0,
              )}{' '}
              of {inProgressSession?.exercises.reduce((acc, ex) => acc + ex.sets.length, 0)} sets
              done
            </Text>
            <PrimaryButton
              label="Resume workout"
              onPress={onResumeWorkout}
              style={styles.cardActionBtn}
              testID="resume-session-btn"
            />
          </View>
        ) : isCompleted ? (
          /* S30: Workout Completed State */
          <View style={styles.completedCard} testID="s30-completed-card">
            <View style={styles.completeIconCircle}>
              <Ionicons name="checkmark" size={24} color={workoutTokens.onAccent} />
            </View>
            <Text style={styles.completedTitle}>Workout complete</Text>
            <Text style={styles.completedWorkoutName}>
              {completedTodaySession?.name || todayPlanDay?.name}
            </Text>
            <View style={styles.statsSummaryRow}>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {completedTodaySession?.ended_at && completedTodaySession?.started_at
                    ? `${Math.max(
                        1,
                        Math.round(
                          (new Date(completedTodaySession.ended_at).getTime() -
                            new Date(completedTodaySession.started_at).getTime()) /
                            60000,
                        ),
                      )}m`
                    : '45m'}
                </Text>
                <Text style={styles.statLabel}>Time</Text>
              </View>
              <View style={styles.statBox}>
                <Text style={styles.statValue}>
                  {completedTodaySession?.exercises.reduce(
                    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
                    0,
                  ) || 12}
                </Text>
                <Text style={styles.statLabel}>Sets</Text>
              </View>
              {personalBests.length > 0 ? (
                <View style={styles.statBox}>
                  <Text style={[styles.statValue, { color: workoutTokens.success }]}>
                    +{personalBests.length}
                  </Text>
                  <Text style={styles.statLabel}>PBs</Text>
                </View>
              ) : null}
            </View>
            <TextButton
              label="View in History"
              onPress={onViewInHistory}
              testID="view-in-history-btn"
            />
          </View>
        ) : isRestDay ? (
          /* S02: Rest Day State */
          <View style={styles.restDayContainer} testID="s02-rest-day-card">
            <View style={styles.restCard}>
              <Text style={styles.restCardTitle}>Rest day</Text>
              <Text style={styles.restCardBody}>
                {completedDaysCount >= trainingDaysCount
                  ? `You finished all ${trainingDaysCount} workouts this week. Recovery is part of the plan.`
                  : 'Recovery is part of the plan.'}
              </Text>
            </View>

            {upNextPlanDay ? (
              <View style={styles.upNextSection}>
                <Text style={styles.sectionHeader}>UP NEXT</Text>
                <Pressable
                  testID="up-next-day-card"
                  onPress={() => onOpenUpNextDay(upNextPlanDay)}
                  style={styles.upNextCard}
                  accessibilityRole="button"
                  accessibilityLabel={`Up next: ${upNextPlanDay.name}, ${upNextPlanDay.exercises.length} exercises`}
                >
                  <View style={styles.upNextLeft}>
                    <Text style={styles.upNextName}>{upNextPlanDay.name}</Text>
                    <Text style={styles.upNextMeta}>
                      {upNextPlanDay.exercises.length} exercises · About{' '}
                      {upNextPlanDay.about_minutes} min
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : todayPlanDay ? (
          /* S01: Training Day State */
          <View style={styles.workoutCard} testID="s01-training-card">
            <View style={styles.cardHeaderRow}>
              <View style={styles.sourceChip}>
                <Text style={styles.sourceChipText}>
                  {activePlan?.source === 'ai' ? 'From your AI plan' : 'From your custom plan'}
                </Text>
              </View>
              <TextButton label="Edit today" onPress={onEditToday} testID="edit-today-btn" />
            </View>

            <Text style={styles.cardTitle}>{todayPlanDay.name}</Text>
            <Text style={styles.cardMeta}>
              {todayPlanDay.exercises.length} exercises ·{' '}
              {todayPlanDay.exercises.reduce((acc, ex) => acc + ex.target_sets, 0)} sets · About{' '}
              {todayPlanDay.about_minutes} min
            </Text>

            <View style={styles.exercisesList}>
              {todayPlanDay.exercises.map((ex, index) => (
                <View key={ex.id || index} style={styles.exerciseRow}>
                  <Text style={styles.exerciseIndex}>{index + 1}</Text>
                  <Text style={styles.exerciseName}>{ex.name}</Text>
                  <Text style={styles.exerciseSetsReps}>
                    {ex.target_sets} × {ex.target_reps}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {/* Logged Today Section */}
        <View style={styles.loggedSection}>
          <View style={styles.loggedHeaderRow}>
            <Text style={styles.sectionHeader}>LOGGED TODAY</Text>
            <TextButton label="Log activity" onPress={onLogActivity} testID="log-activity-btn" />
          </View>

          {activityLogs.length === 0 ? (
            <View style={styles.emptyLoggedBox}>
              <Text style={styles.emptyLoggedText}>Nothing logged yet</Text>
            </View>
          ) : (
            activityLogs.map((log) => (
              <View key={log.id} style={styles.activityRow}>
                <View style={styles.activityIcon}>
                  <Ionicons name="fitness-outline" size={20} color={workoutTokens.accent} />
                </View>
                <View style={styles.activityDetails}>
                  <Text style={styles.activityName}>{log.activity_name}</Text>
                  <Text style={styles.activityMeta}>
                    {log.duration_minutes} min
                    {log.calories_burned ? ` · ${log.calories_burned} kcal` : ''}
                  </Text>
                </View>
                <Pressable
                  testID={`activity-menu-${log.id}`}
                  accessibilityRole="button"
                  accessibilityLabel="Activity options"
                  onPress={() => {
                    Alert.alert(log.activity_name, 'Choose an action', [
                      { text: 'Edit', onPress: () => onEditActivity(log) },
                      {
                        text: 'Delete',
                        style: 'destructive',
                        onPress: () => handleDeleteActivity(log),
                      },
                      { text: 'Cancel', style: 'cancel' },
                    ]);
                  }}
                  style={styles.threeDotBtn}
                >
                  <Ionicons name="ellipsis-horizontal" size={18} color={workoutTokens.dim} />
                </Pressable>
              </View>
            ))
          )}
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Primary Sticky Action */}
      {!isInProgress && !isCompleted && (
        <StickyCtaBar>
          {isRestDay ? (
            <SecondaryButton
              label="Train anyway"
              onPress={onTrainAnyway}
              testID="train-anyway-btn"
            />
          ) : (
            <PrimaryButton
              label="Start workout"
              onPress={onStartWorkout}
              testID="start-workout-btn"
            />
          )}
        </StickyCtaBar>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  headerLeft: {
    flex: 1,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 30,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '600',
    marginTop: 2,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.circleMedium,
    backgroundColor: workoutTokens.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabsWrapper: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  weekStripContainer: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 16,
  },
  weekStripRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  dayCol: {
    alignItems: 'center',
    gap: 8,
  },
  dayLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
  },
  todayLabel: {
    color: workoutTokens.accent,
  },
  dayCircle: {
    width: 34,
    height: 34,
    borderRadius: workoutRadius.circleSmall,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayDone: {
    backgroundColor: workoutTokens.accentSoft,
  },
  dayTodayPending: {
    backgroundColor: workoutTokens.accent,
  },
  dayRest: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
  },
  dayPlanned: {
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  dayNumberText: {
    color: workoutTokens.text,
    fontSize: 12,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  dayNumberTextToday: {
    color: workoutTokens.onAccent,
  },
  dayNumberTextRest: {
    color: workoutTokens.dim,
  },
  weekStripCaption: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 12,
    textAlign: 'center',
  },
  loadingContainer: {
    gap: 12,
  },
  workoutCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 20,
    marginBottom: 20,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sourceChip: {
    backgroundColor: workoutTokens.inset,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: workoutRadius.chip,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  sourceChipText: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: workoutTokens.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  cardMeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 16,
  },
  exercisesList: {
    borderTopWidth: 1,
    borderTopColor: workoutTokens.border,
    paddingTop: 12,
    gap: 10,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exerciseIndex: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
    width: 24,
  },
  exerciseName: {
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
    marginRight: 8,
  },
  exerciseSetsReps: {
    color: workoutTokens.muted,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  inProgressCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    padding: 20,
    marginBottom: 20,
  },
  inProgressBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: workoutTokens.accentSoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: workoutRadius.chip,
  },
  liveDot: {
    width: 6,
    height: 6,
    borderRadius: workoutRadius.bar,
    backgroundColor: workoutTokens.accent,
  },
  inProgressBadgeText: {
    color: workoutTokens.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  inProgressStats: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginTop: 6,
    marginBottom: 16,
    fontVariant: ['tabular-nums'],
  },
  cardActionBtn: {
    marginTop: 8,
  },
  completedCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 20,
  },
  completeIconCircle: {
    width: 48,
    height: 48,
    borderRadius: workoutRadius.cardLg,
    backgroundColor: workoutTokens.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  completedTitle: {
    color: workoutTokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  completedWorkoutName: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 16,
  },
  statsSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: '100%',
    paddingVertical: 14,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: workoutTokens.border,
    marginBottom: 12,
  },
  statBox: {
    alignItems: 'center',
  },
  statValue: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  restDayContainer: {
    marginBottom: 20,
  },
  restCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 20,
    marginBottom: 16,
  },
  restCardTitle: {
    color: workoutTokens.text,
    fontSize: 20,
    fontWeight: '800',
  },
  restCardBody: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginTop: 6,
    lineHeight: 20,
  },
  upNextSection: {
    marginTop: 4,
  },
  sectionHeader: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  upNextCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
  },
  upNextLeft: {
    flex: 1,
  },
  upNextName: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  upNextMeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
  loggedSection: {
    marginTop: 10,
  },
  loggedHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  emptyLoggedBox: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.row,
    padding: 16,
    alignItems: 'center',
  },
  emptyLoggedText: {
    color: workoutTokens.dim,
    fontSize: 14,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 14,
    marginBottom: 8,
  },
  activityIcon: {
    width: 36,
    height: 36,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityName: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  activityMeta: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  threeDotBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollSpacer: {
    height: 40,
  },
});
