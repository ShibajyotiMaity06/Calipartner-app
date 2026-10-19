import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { IndividualProgressData } from '@calipartner/core';
import { dark, radius, space, type } from '@calipartner/ui';
import { t } from '@/i18n';

interface ProgressHubSummaryProps {
  data?: IndividualProgressData | null;
  onSelectMetric: (metric: string) => void;
  onOpenWeeklySummary: () => void;
  testID?: string;
}

export function ProgressHubSummary({
  data,
  onSelectMetric,
  onOpenWeeklySummary,
  testID = 'progress-hub-summary',
}: ProgressHubSummaryProps) {
  const weight = data?.weight;
  const calories = data?.calories;
  const macros = data?.macros;
  const steps = data?.steps;
  const water = data?.water;
  const workouts = data?.workouts;
  const consistency = data?.consistency;

  const loggedDays = calories?.daily.filter((d) => d.is_logged_day).length ?? 0;
  const goalDays = calories?.daily.filter((d) => d.is_goal_day).length ?? 0;

  return (
    <View style={styles.container} testID={testID}>
      {/* M01 / PRG-11: One-sentence summary of the week in plain words */}
      <View style={styles.weekSummaryCard} testID={`${testID}-week-summary`}>
        <View style={styles.weekSummaryHeader}>
          <Ionicons name="sparkles-outline" size={18} color={dark.apricot} />
          <Text style={styles.weekSummaryTag}>Week in words</Text>
        </View>
        <Text style={styles.weekSummaryText}>
          {t('progress.hub.weekSummary', {
            logged: loggedDays,
            total: calories?.daily.length || 7,
            goals: goalDays,
          })}
        </Text>
        <Pressable
          style={styles.recapLink}
          onPress={onOpenWeeklySummary}
          accessibilityRole="button"
          accessibilityLabel="Open weekly recap"
          testID={`${testID}-open-recap`}
        >
          <Text style={styles.recapLinkText}>View full summary & share card →</Text>
        </Pressable>
      </View>

      {/* Summary Cards Stack */}
      <View style={styles.cardsStack}>
        {/* 1. Weight Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('weight')}
          accessibilityRole="button"
          accessibilityLabel="Weight progress detail"
          testID={`${testID}-card-weight`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="speedometer-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Weight</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {weight?.current_weight_kg != null ? `${weight.current_weight_kg.toFixed(1)} kg` : '—'}
              </Text>
              <Text style={styles.headlineCaption}>
                {weight?.total_change_kg != null
                  ? `${weight.total_change_kg > 0 ? '+' : ''}${weight.total_change_kg.toFixed(1)} kg since start`
                  : 'Log 3 weigh-ins to see your trend'}
              </Text>
            </View>
            {weight?.weekly_pace_kg != null ? (
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>{weight.weekly_pace_kg.toFixed(2)} kg/wk</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        {/* 2. Calories Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('calories')}
          accessibilityRole="button"
          accessibilityLabel="Calories vs target detail"
          testID={`${testID}-card-calories`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="flame-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Calories</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {calories?.average_calories != null
                  ? `${Math.round(calories.average_calories)} kcal`
                  : '—'}
              </Text>
              <Text style={styles.headlineCaption}>
                Target: {calories?.average_target != null ? Math.round(calories.average_target) : 2000} kcal/day
              </Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillText}>{goalDays} days on goal</Text>
            </View>
          </View>
        </Pressable>

        {/* 3. Macros Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('macros')}
          accessibilityRole="button"
          accessibilityLabel="Macronutrient averages detail"
          testID={`${testID}-card-macros`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="nutrition-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Macros</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.macrosMiniRow}>
            <View style={styles.macroMiniBox}>
              <Text style={styles.macroMiniVal}>
                {macros?.protein_avg_g != null ? `${Math.round(macros.protein_avg_g)}g` : '—'}
              </Text>
              <Text style={styles.macroMiniLabel}>Protein</Text>
            </View>
            <View style={styles.macroMiniBox}>
              <Text style={styles.macroMiniVal}>
                {macros?.carbs_avg_g != null ? `${Math.round(macros.carbs_avg_g)}g` : '—'}
              </Text>
              <Text style={styles.macroMiniLabel}>Carbs</Text>
            </View>
            <View style={styles.macroMiniBox}>
              <Text style={styles.macroMiniVal}>
                {macros?.fat_avg_g != null ? `${Math.round(macros.fat_avg_g)}g` : '—'}
              </Text>
              <Text style={styles.macroMiniLabel}>Fat</Text>
            </View>
          </View>
        </Pressable>

        {/* 4. Steps Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('steps')}
          accessibilityRole="button"
          accessibilityLabel="Steps and walking distance detail"
          testID={`${testID}-card-steps`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="footsteps-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Steps & Distance</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {steps?.average_steps != null
                  ? `${Math.round(steps.average_steps).toLocaleString()}`
                  : '—'}
              </Text>
              <Text style={styles.headlineCaption}>
                {steps?.total_distance_km != null
                  ? `${steps.total_distance_km.toFixed(1)} km total`
                  : 'Daily movement'}
              </Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillText}>Goal 8,000</Text>
            </View>
          </View>
        </Pressable>

        {/* 5. Water Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('water')}
          accessibilityRole="button"
          accessibilityLabel="Water hydration detail"
          testID={`${testID}-card-water`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="water-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Water</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {water?.average_water_ml != null
                  ? `${Math.round(water.average_water_ml)} ml`
                  : '—'}
              </Text>
              <Text style={styles.headlineCaption}>Daily average intake</Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillText}>Goal 2,500 ml</Text>
            </View>
          </View>
        </Pressable>

        {/* 6. Workouts Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('workouts')}
          accessibilityRole="button"
          accessibilityLabel="Workouts progression detail"
          testID={`${testID}-card-workouts`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="barbell-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Workouts</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {workouts?.total_workouts != null ? `${workouts.total_workouts} sessions` : '—'}
              </Text>
              <Text style={styles.headlineCaption}>
                {workouts?.sessions_per_week != null
                  ? `${workouts.sessions_per_week.toFixed(1)} sessions/wk`
                  : 'Track training consistency'}
              </Text>
            </View>
            {workouts?.total_volume_kg != null ? (
              <View style={styles.pillBadge}>
                <Text style={styles.pillText}>{Math.round(workouts.total_volume_kg).toLocaleString()} kg vol</Text>
              </View>
            ) : null}
          </View>
        </Pressable>

        {/* 7. Consistency Summary Card */}
        <Pressable
          style={styles.summaryCard}
          onPress={() => onSelectMetric('consistency')}
          accessibilityRole="button"
          accessibilityLabel="Consistency score detail"
          testID={`${testID}-card-consistency`}
        >
          <View style={styles.cardHeader}>
            <View style={styles.cardTitleRow}>
              <Ionicons name="ribbon-outline" size={18} color={dark.apricot} />
              <Text style={styles.cardTitle}>Consistency</Text>
            </View>
            <Text style={styles.cardDetailHint}>Tap for detail →</Text>
          </View>
          <View style={styles.cardBody}>
            <View>
              <Text style={styles.headlineNumber}>
                {consistency?.current_streak != null ? `${consistency.current_streak} days` : '—'}
              </Text>
              <Text style={styles.headlineCaption}>
                Longest streak: {consistency?.longest_streak ?? 0} days
              </Text>
            </View>
            <View style={styles.pillBadge}>
              <Text style={styles.pillText}>
                Score {consistency?.weekly_scores[consistency.weekly_scores.length - 1]?.consistency_score.toFixed(0) ?? 80}/100
              </Text>
            </View>
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    paddingVertical: space[2],
  },
  weekSummaryCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[4],
    marginBottom: space[3],
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  weekSummaryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    marginBottom: space[2],
  },
  weekSummaryTag: {
    ...type.label,
    color: dark.apricot,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  weekSummaryText: {
    ...type.body,
    color: dark.textHi,
    lineHeight: 22,
  },
  recapLink: {
    marginTop: space[3],
    alignSelf: 'flex-start',
  },
  recapLinkText: {
    ...type.bodyS,
    color: dark.apricot,
    fontWeight: '600',
  },
  cardsStack: {
    gap: space[3],
  },
  summaryCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: space[2],
  },
  cardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  cardTitle: {
    ...type.heading,
    color: dark.textHi,
  },
  cardDetailHint: {
    ...type.label,
    color: dark.textLo,
  },
  cardBody: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
  },
  headlineNumber: {
    ...type.numeralL,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textHi,
  },
  headlineCaption: {
    ...type.bodyS,
    color: dark.textLo,
    marginTop: 2,
  },
  pillBadge: {
    backgroundColor: dark.s2,
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: dark.hairline,
  },
  pillText: {
    ...type.label,
    color: dark.apricot,
    fontVariant: ['tabular-nums'] as any,
  },
  macrosMiniRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: space[1],
  },
  macroMiniBox: {
    flex: 1,
  },
  macroMiniVal: {
    ...type.numeralM,
    fontVariant: ['tabular-nums'] as any,
    color: dark.textHi,
  },
  macroMiniLabel: {
    ...type.label,
    color: dark.textLo,
    marginTop: 2,
  },
});
