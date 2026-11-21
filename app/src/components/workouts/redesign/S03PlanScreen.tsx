import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { SegmentedTabs, PrimaryButton, TextButton, type WorkoutTabId } from '../s_common';
import type { GeneratedWorkoutPlan, GeneratedPlanDay } from '@calipartner/core';
import type { WorkoutEligibilityResponse } from '@/services/workoutRedesignService';

interface S03PlanScreenProps {
  currentTab: WorkoutTabId;
  onChangeTab: (tab: WorkoutTabId) => void;
  activePlan: GeneratedWorkoutPlan | null;
  eligibility: WorkoutEligibilityResponse | null;
  todayWeekday: number;
  onOpenSettings: () => void;
  onEditDay: (day: GeneratedPlanDay) => void;
  onAddRestDayWorkout: (day: GeneratedPlanDay) => void;
  onBuildWithAi: () => void;
  onOpenLockedScreen: () => void;
  onStartBlankCustomPlan: () => void;
}

export function S03PlanScreen({
  currentTab,
  onChangeTab,
  activePlan,
  eligibility,
  todayWeekday,
  onOpenSettings,
  onEditDay,
  onAddRestDayWorkout,
  onBuildWithAi,
  onOpenLockedScreen,
  onStartBlankCustomPlan,
}: S03PlanScreenProps) {
  const weekdayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const trainingDays = activePlan?.days.filter((d) => !d.is_rest) || [];
  const restDays = activePlan?.days.filter((d) => d.is_rest) || [];

  const isLocked = eligibility?.state === 'locked';
  const isReady = eligibility?.state === 'ready';

  const formatUnlockDate = (isoStr?: string | null) => {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return '';
    }
  };

  return (
    <View style={styles.screenContainer} testID="s03-plan-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerTitle}>Workout</Text>
          <Text style={styles.headerSubtitle}>Your plan repeats every week</Text>
        </View>
        <Pressable
          testID="plan-header-settings"
          accessibilityRole="button"
          accessibilityLabel="Workout settings"
          onPress={onOpenSettings}
          style={styles.headerIconBtn}
        >
          <Ionicons name="settings-outline" size={22} color={workoutTokens.text} />
        </Pressable>
      </View>

      {/* Tabs */}
      <View style={styles.tabsWrapper}>
        <SegmentedTabs activeTab={currentTab} onChangeTab={onChangeTab} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Active Plan Summary Row */}
        <View style={styles.planSummaryRow}>
          <View style={styles.planIconCircle}>
            <Ionicons
              name={activePlan?.source === 'ai' ? 'sparkles' : 'barbell'}
              size={20}
              color={workoutTokens.accent}
            />
          </View>
          <View style={styles.planMetaCol}>
            <Text style={styles.planSourceTitle}>
              {activePlan?.source === 'ai' ? 'AI plan' : 'Custom plan'}
            </Text>
            <Text style={styles.planSubmeta}>
              {trainingDays.length} workouts · {restDays.length} rest days
            </Text>
          </View>
          <View style={styles.activeChip}>
            <Text style={styles.activeChipText}>Active</Text>
          </View>
        </View>

        {/* Seven Days List */}
        <View style={styles.daysListSection}>
          {activePlan?.days.map((day) => {
            const isToday = day.weekday === todayWeekday;
            if (day.is_rest) {
              return (
                <View
                  key={day.weekday}
                  style={[styles.restDayRow, isToday && styles.todayRowOutline]}
                >
                  <View style={styles.dayTextCol}>
                    <Text style={styles.weekdayTitle}>{weekdayNames[day.weekday - 1]}</Text>
                    <Text style={styles.restDaySubtitle}>Rest day{isToday ? ' · Today' : ''}</Text>
                  </View>
                  <TextButton
                    label="Add"
                    onPress={() => onAddRestDayWorkout(day)}
                    testID={`add-workout-day-${day.weekday}`}
                  />
                </View>
              );
            }

            return (
              <Pressable
                key={day.weekday}
                testID={`plan-day-${day.weekday}`}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayNames[day.weekday - 1]}, ${day.name}, ${day.exercises.length} exercises`}
                onPress={() => onEditDay(day)}
                style={[styles.trainingDayRow, isToday && styles.todayRowOutline]}
              >
                <View style={styles.dayTextCol}>
                  <Text style={styles.weekdayTitle}>{weekdayNames[day.weekday - 1]}</Text>
                  <Text style={styles.workoutDayName}>{day.name}</Text>
                  <Text style={styles.workoutDayMeta}>
                    {day.exercises.length} exercises · About {day.about_minutes} min
                    {isToday ? ' · Today' : ''}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
              </Pressable>
            );
          })}
        </View>

        {/* Plan Options Section */}
        <View style={styles.optionsSection}>
          <Text style={styles.optionsHeader}>PLAN OPTIONS</Text>

          {/* S22: Ready State */}
          {isReady ? (
            <View style={styles.readyCard} testID="s22-ready-card">
              <View style={styles.readyTitleRow}>
                <Ionicons name="sparkles" size={20} color={workoutTokens.accent} />
                <Text style={styles.readyTitle}>Your AI rebuild is ready</Text>
              </View>
              <Text style={styles.readySubtitle}>3 previews available</Text>
              <PrimaryButton
                label="Rebuild with AI"
                onPress={onBuildWithAi}
                style={styles.rebuildBtn}
                testID="ready-rebuild-btn"
              />
            </View>
          ) : isLocked ? (
            /* Locked State */
            <Pressable
              testID="locked-rebuild-row"
              accessibilityRole="button"
              accessibilityLabel="Rebuild with AI locked"
              onPress={onOpenLockedScreen}
              style={styles.optionRow}
            >
              <View style={styles.optionIconCircle}>
                <Ionicons name="lock-closed-outline" size={20} color={workoutTokens.dim} />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>Rebuild with AI</Text>
                <Text style={styles.optionSubtitle}>
                  Unlocks {formatUnlockDate(eligibility?.next_available_at)}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
            </Pressable>
          ) : (
            /* Never used or unlocked */
            <Pressable
              testID="build-with-ai-row"
              accessibilityRole="button"
              accessibilityLabel="Build with AI"
              onPress={onBuildWithAi}
              style={styles.optionRow}
            >
              <View style={styles.optionIconCircle}>
                <Ionicons name="sparkles-outline" size={20} color={workoutTokens.accent} />
              </View>
              <View style={styles.optionTextCol}>
                <Text style={styles.optionTitle}>Build with AI</Text>
                <Text style={styles.optionSubtitle}>Generate a personalized plan</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
            </Pressable>
          )}

          {/* Blank Custom Plan */}
          <Pressable
            testID="blank-custom-plan-row"
            accessibilityRole="button"
            accessibilityLabel="Start a blank custom plan"
            onPress={onStartBlankCustomPlan}
            style={styles.optionRow}
          >
            <View style={styles.optionIconCircle}>
              <Ionicons name="create-outline" size={20} color={workoutTokens.dim} />
            </View>
            <View style={styles.optionTextCol}>
              <Text style={styles.optionTitle}>Start a blank custom plan</Text>
              <Text style={styles.optionSubtitle}>Clears the week so you can build your own</Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
          </Pressable>
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>
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
  planSummaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 16,
  },
  planIconCircle: {
    width: 40,
    height: 40,
    borderRadius: workoutRadius.card,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  planMetaCol: {
    flex: 1,
  },
  planSourceTitle: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  planSubmeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 2,
  },
  activeChip: {
    backgroundColor: 'rgba(134, 211, 160, 0.14)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: workoutRadius.chip,
    borderWidth: 1,
    borderColor: workoutTokens.success,
  },
  activeChipText: {
    color: workoutTokens.success,
    fontSize: 12,
    fontWeight: '700',
  },
  daysListSection: {
    gap: 8,
    marginBottom: 24,
  },
  trainingDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
  },
  restDayRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.row,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  todayRowOutline: {
    borderColor: workoutTokens.accent,
    borderWidth: 1.5,
  },
  dayTextCol: {
    flex: 1,
  },
  weekdayTitle: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
  },
  workoutDayName: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  workoutDayMeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
  restDaySubtitle: {
    color: workoutTokens.dim,
    fontSize: 14,
    marginTop: 2,
  },
  optionsSection: {
    marginTop: 8,
  },
  optionsHeader: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  readyCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    padding: 20,
    marginBottom: 12,
  },
  readyTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  readyTitle: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  readySubtitle: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
    marginBottom: 14,
  },
  rebuildBtn: {
    marginTop: 4,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 10,
  },
  optionIconCircle: {
    width: 36,
    height: 36,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  optionTextCol: {
    flex: 1,
    marginRight: 8,
  },
  optionTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  optionSubtitle: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  scrollSpacer: {
    height: 40,
  },
});
