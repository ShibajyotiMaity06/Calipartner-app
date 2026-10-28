import React, { useEffect, useState } from 'react';
import {
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import type { ProgressDateRange } from '@calipartner/core';
import {
  ChallengesView,
  type DayDetailData,
  DayDetailModal,
  GoalProgressRing,
  LeaderboardView,
  MondayRecapModal,
  ProgressHubSummary,
  RangeSelector,
  WeeklySummaryModal,
} from '@/components/progress';
import { FloatingAiCoachButton } from '@/components/coach';

import { useIndividualProgress } from '@/hooks/useIndividualProgress';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

type ProgressTabSegment = 'my_progress' | 'leaderboard' | 'challenges';

const RANGE_OPTIONS: ProgressDateRange[] = ['7d', '30d', '90d', '6m', '1y', 'all'];

export default function ProgressScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ tab?: string; challenge?: string }>();
  const [activeSegment, setActiveSegment] = useState<ProgressTabSegment>(
    params.tab === 'challenges' || params.challenge ? 'challenges' : 'my_progress',
  );
  useEffect(() => {
    if (params.tab === 'challenges' || params.challenge) setActiveSegment('challenges');
  }, [params.tab, params.challenge]);
  const [selectedDay, setSelectedDay] = useState<DayDetailData | null>(null);
  const [showWeeklySummary, setShowWeeklySummary] = useState(false);
  const [showMondayRecap, setShowMondayRecap] = useState(false);

  // Hook for Individual Progress
  const { range, setRange, data, loading, error, refresh } = useIndividualProgress('30d');

  const loggedDays = data?.calories?.daily.filter((d) => d.is_logged_day).length ?? 6;
  const goalDays = data?.calories?.daily.filter((d) => d.is_goal_day).length ?? 5;
  const weightChangeKg = data?.weight?.total_change_kg ?? -0.3;
  const workoutCount = data?.workouts?.total_workouts ?? 3;
  const avgSteps = data?.steps?.average_steps ?? 8420;
  const consistencyScore =
    data?.consistency?.weekly_scores && data.consistency.weekly_scores.length > 0
      ? data.consistency.weekly_scores[data.consistency.weekly_scores.length - 1]!.consistency_score
      : 84;

  const handleSelectMetric = (_metric: string) => {
    // Open full weekly breakdown summary
    setShowWeeklySummary(true);
  };

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
            {error && error.code !== 'UNAUTHENTICATED' && (
              <View
                style={[
                  styles.errorBanner,
                  { backgroundColor: colors.surface, borderColor: colors.border },
                ]}
              >
                <Ionicons name="alert-circle-outline" size={20} color={colors.textMuted} />
                <Text style={[styles.errorBannerText, { color: colors.text }]}>
                  {typeof error.message === 'string' && error.message !== '[object Object]'
                    ? error.message
                    : 'Tap retry to refresh your progress summary'}
                </Text>
                <Pressable
                  style={[styles.retryBtn, { backgroundColor: colors.accent }]}
                  onPress={refresh}
                >
                  <Text style={[styles.retryBtnText, { color: colors.onAccent }]}>Retry</Text>
                </Pressable>
              </View>
            )}

            {/* Hub Summary View */}
            <ProgressHubSummary
              data={data}
              onSelectMetric={handleSelectMetric}
              onOpenWeeklySummary={() => setShowWeeklySummary(true)}
              testID="progress-hub-summary"
            />
          </View>
        )}

        {/* SEGMENT 2: LEADERBOARD (M11) */}
        {activeSegment === 'leaderboard' && <LeaderboardView testID="progress-leaderboard-view" />}

        {/* SEGMENT 3: CHALLENGES (M13-M17) */}
        {activeSegment === 'challenges' && <ChallengesView testID="progress-challenges-view" />}
      </ScrollView>

      {/* Day Details Modal (Triggered on point/bar tap) */}
      <DayDetailModal
        visible={!!selectedDay}
        data={selectedDay}
        onClose={() => setSelectedDay(null)}
        testID="progress-day-detail-modal"
      />

      {/* M09/M10: Weekly Summary & Privacy-Safe Share Modal */}
      <WeeklySummaryModal
        visible={showWeeklySummary}
        onClose={() => setShowWeeklySummary(false)}
        loggedDays={loggedDays}
        goalDays={goalDays}
        totalDays={data?.calories?.daily.length || 7}
        weightChangeKg={weightChangeKg}
        workoutCount={workoutCount}
        avgSteps={avgSteps}
        consistencyScore={consistencyScore}
        testID="progress-weekly-summary-modal"
      />

      {/* M12: Monday Recap Modal */}
      <MondayRecapModal
        visible={showMondayRecap}
        score={consistencyScore}
        loggedDays={loggedDays}
        goalDays={goalDays}
        onClose={() => setShowMondayRecap(false)}
        onSeeLeaderboard={() => {
          setShowMondayRecap(false);
          setActiveSegment('leaderboard');
        }}
        testID="progress-monday-recap-modal"
      />
      <FloatingAiCoachButton />
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
  viewModeContainer: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    alignItems: 'center',
  },
  viewModePill: {
    flexDirection: 'row',
    borderRadius: radius.control,
    padding: 3,
    gap: 4,
  },
  viewModeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.control,
  },
  viewModeButtonActive: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.12,
    shadowRadius: 2,
    elevation: 2,
  },
  viewModeText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  viewModeTextActive: {
    fontWeight: '700',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 80,
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
    borderRadius: radius.control,
  },
  retryBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
