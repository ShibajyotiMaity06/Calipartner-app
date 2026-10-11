import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IndividualConsistencyProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { ChartContainer } from './ChartContainer';

interface ConsistencyHistoryChartProps {
  data?: IndividualConsistencyProgress | null;
  loading?: boolean;
  testID?: string;
}

export function ConsistencyHistoryChart({
  data,
  loading = false,
  testID = 'consistency-history-chart',
}: ConsistencyHistoryChartProps) {
  const { colors } = useTheme();

  const currentStreak = data?.current_streak ?? 0;
  const longestStreak = data?.longest_streak ?? 0;
  const weeklyScores = useMemo(() => data?.weekly_scores ?? [], [data?.weekly_scores]);

  const isEmpty = currentStreak === 0 && longestStreak === 0 && weeklyScores.length === 0;

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.consistency.empty');
    }
    return t('progress.consistency.accessibilitySummary', {
      current: currentStreak,
      longest: longestStreak,
    });
  }, [isEmpty, data, currentStreak, longestStreak]);

  return (
    <ChartContainer
      title={t('progress.consistency.title')}
      subtitle={`${currentStreak} ${t('progress.consistency.days')} streak`}
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.consistency.empty')}
      emptyIcon="flame-outline"
      testID={testID}
    >
      {/* Streaks Badges */}
      <View style={styles.streaksRow}>
        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="flame" size={24} color={colors.accent} />
          <View>
            <Text style={[styles.streakNumber, { color: colors.text }]}>
              {currentStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
              {t('progress.consistency.currentStreak')}
            </Text>
          </View>
        </View>

        <View
          style={[
            styles.streakBadge,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
          ]}
        >
          <Ionicons name="trophy-outline" size={24} color={colors.accent} />
          <View>
            <Text style={[styles.streakNumber, { color: colors.text }]}>
              {longestStreak}
            </Text>
            <Text style={[styles.streakLabel, { color: colors.textMuted }]}>
              {t('progress.consistency.longestStreak')}
            </Text>
          </View>
        </View>
      </View>

      {/* Weekly Scores */}
      {weeklyScores.length > 0 && (
        <View style={styles.scoresSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            {t('progress.consistency.weeklyScores')}
          </Text>

          <View style={styles.scoresList}>
            {weeklyScores.slice(-6).map((item) => (
              <View
                key={item.week_start_date}
                style={[
                  styles.scoreCard,
                  { backgroundColor: colors.surfaceAlt },
                ]}
              >
                <View>
                  <Text style={[styles.weekDate, { color: colors.text }]}>
                    Week of {item.week_start_date}
                  </Text>
                  <Text style={[styles.weekSub, { color: colors.textMuted }]}>
                    {item.logged_days}/7 logged • {item.goal_days}/7 on goal
                  </Text>
                </View>

                <View style={styles.scorePill}>
                  <Text style={[styles.scoreValue, { color: colors.accent }]}>
                    {item.consistency_score.toFixed(1)}
                  </Text>
                  <Text style={[styles.scoreMax, { color: colors.textMuted }]}>
                    / 100
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  streaksRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginVertical: spacing.xs,
  },
  streakBadge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  streakNumber: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  streakLabel: {
    fontSize: fontSize.xs,
  },
  scoresSection: {
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
  scoresList: {
    gap: spacing.xs,
  },
  scoreCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
  },
  weekDate: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  weekSub: {
    fontSize: 10,
    marginTop: 2,
  },
  scorePill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  scoreValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  scoreMax: {
    fontSize: 10,
  },
});
