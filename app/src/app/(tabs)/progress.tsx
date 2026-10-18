import React, { useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ProgressDateRange } from '@calipartner/core';
import {
  CaloriesChart,
  ChallengesComingSoon,
  ConsistencyHistoryChart,
  type DayDetailData,
  DayDetailModal,
  GoalProgressRing,
  LeaderboardView,
  MacrosChart,
  RangeSelector,
  StepsChart,
  WaterChart,
  WeightChart,
  WorkoutsChart,
} from '@/components/progress';
import { FocusProgressChart } from '@/components/focus';
import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type ProgressTabSegment = 'my_progress' | 'leaderboard' | 'challenges';

const RANGE_OPTIONS: ProgressDateRange[] = ['7d', '30d', '90d', '6m', '1y', 'all'];

export default function ProgressScreen() {
  const { colors } = useTheme();
  const [activeSegment, setActiveSegment] = useState<ProgressTabSegment>('my_progress');
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);

  // Hook for Individual Progress
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('30d');

  return (
    <SafeAreaView
      style={[styles.safeArea, { backgroundColor: colors.background }]}
      testID="screen-progress"
    >
      {/* Top Segmented Navigation Bar */}
      <View style={[styles.segmentBarContainer, { backgroundColor: colors.surface }]}>
        <View
          style={[styles.segmentBar, { backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="tablist"
        >
          <Pressable
            style={[
              styles.segmentTab,
              activeSegment === 'my_progress' && [
                styles.activeSegmentTab,
                { backgroundColor: colors.surface },
              ],
            ]}
            onPress={() => setActiveSegment('my_progress')}
            accessibilityRole="tab"
            accessibilityLabel={t('progress.segments.myProgress')}
            accessibilityState={{ selected: activeSegment === 'my_progress' }}
            testID="progress-segment-my-progress"
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeSegment === 'my_progress' ? colors.text : colors.textMuted,
                },
                activeSegment === 'my_progress' && styles.activeSegmentText,
              ]}
            >
              {t('progress.segments.myProgress')}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentTab,
              activeSegment === 'leaderboard' && [
                styles.activeSegmentTab,
                { backgroundColor: colors.surface },
              ],
            ]}
            onPress={() => setActiveSegment('leaderboard')}
            accessibilityRole="tab"
            accessibilityLabel={t('progress.segments.leaderboard')}
            accessibilityState={{ selected: activeSegment === 'leaderboard' }}
            testID="progress-segment-leaderboard"
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeSegment === 'leaderboard' ? colors.text : colors.textMuted,
                },
                activeSegment === 'leaderboard' && styles.activeSegmentText,
              ]}
            >
              {t('progress.segments.leaderboard')}
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.segmentTab,
              activeSegment === 'challenges' && [
                styles.activeSegmentTab,
                { backgroundColor: colors.surface },
              ],
            ]}
            onPress={() => setActiveSegment('challenges')}
            accessibilityRole="tab"
            accessibilityLabel={t('progress.segments.challenges')}
            accessibilityState={{ selected: activeSegment === 'challenges' }}
            testID="progress-segment-challenges"
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: activeSegment === 'challenges' ? colors.text : colors.textMuted,
                },
                activeSegment === 'challenges' && styles.activeSegmentText,
              ]}
            >
              {t('progress.segments.challenges')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Main Scroll Content */}
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={loading} onRefresh={refresh} tintColor={colors.accent} />
        }
      >
        {/* SEGMENT 1: MY PROGRESS */}
        {activeSegment === 'my_progress' && (
          <View testID="my-progress-content">
            {/* Goal Progress Ring */}
            <GoalProgressRing
              progressPct={data?.goal_progress_pct ?? null}
              targetWeightKg={data?.weight.target_weight_kg ?? null}
              currentTrendKg={data?.weight.current_trend_kg ?? null}
              testID="progress-goal-ring"
            />

            {/* Shared Range Selector */}
            <RangeSelector
              options={RANGE_OPTIONS}
              selected={range}
              onSelect={(newRange) => setRange(newRange)}
              testID="progress-range-selector"
            />

            {/* Error Banner if any */}
            {error && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.errorBannerText, { color: colors.text }]}>
                  {error.message}
                </Text>
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                  onPress={refresh}
                >
                  <Text style={styles.retryBtnText}>Retry</Text>
                </Pressable>
              </View>
            )}

            {/* Weight Chart (Points + Trend + Goal Line + Numbers) */}
            <WeightChart
              data={data?.weight}
              loading={loading}
              onSelectDay={(day) => setSelectedDay(day)}
              testID="progress-chart-weight"
            />

            {/* Calories vs Target */}
            <CaloriesChart
              data={data?.calories}
              loading={loading}
              onSelectDay={(day) => setSelectedDay(day)}
              testID="progress-chart-calories"
            />

            {/* Macros Breakdown */}
            <MacrosChart data={data?.macros} loading={loading} testID="progress-chart-macros" />

            {/* Steps & Distance */}
            <StepsChart
              data={data?.steps}
              loading={loading}
              onSelectDay={(day) => setSelectedDay(day)}
              testID="progress-chart-steps"
            />

            {/* Water Intake */}
            <WaterChart
              data={data?.water}
              loading={loading}
              onSelectDay={(day) => setSelectedDay(day)}
              testID="progress-chart-water"
            />

            {/* Workouts Activity & Progression */}
            <WorkoutsChart
              data={data?.workouts}
              loading={loading}
              testID="progress-chart-workouts"
            />

            {/* Consistency & Streaks History */}
            <ConsistencyHistoryChart
              data={data?.consistency}
              loading={loading}
              testID="progress-chart-consistency"
            />

            {/* Focus Time Progression & Breakdown (PRG-14, FOC-10) */}
            <FocusProgressChart range={range} testID="progress-chart-focus" />
          </View>
        )}

        {/* SEGMENT 2: LEADERBOARD */}
        {activeSegment === 'leaderboard' && <LeaderboardView testID="progress-leaderboard-view" />}

        {/* SEGMENT 3: CHALLENGES */}
        {activeSegment === 'challenges' && (
          <ChallengesComingSoon testID="progress-challenges-view" />
        )}
      </ScrollView>

      {/* Day Details Modal (Triggered on point/bar tap) */}
      <DayDetailModal
        visible={!!selectedDay}
        data={selectedDay}
        onClose={() => setSelectedDay(null)}
        testID="progress-day-detail-modal"
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  segmentBarContainer: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(150, 150, 150, 0.2)',
  },
  segmentBar: {
    flexDirection: 'row',
    borderRadius: radius.md,
    padding: 3,
  },
  segmentTab: {
    flex: 1,
    paddingVertical: spacing.xs + 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  activeSegmentTab: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  segmentText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  activeSegmentText: {
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: fontSize.xs,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
