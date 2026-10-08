import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import type { CalculateTargetsResult, Goal } from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound, playSuccessSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface SummaryStepProps {
  goal: Goal;
  stepGoal: number;
  waterMlGoal: number;
  calculatedTargets: CalculateTargetsResult | null;
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onGoBackToStats?: () => void;
}

export function SummaryStep({
  goal,
  stepGoal,
  waterMlGoal,
  calculatedTargets,
  isSaving,
  saveError,
  onSave,
  onGoBackToStats,
}: SummaryStepProps) {
  const { colors } = useTheme();

  const handleSave = () => {
    playSuccessSound();
    onSave();
  };

  const handleGoBack = () => {
    playClickSound();
    if (onGoBackToStats) onGoBackToStats();
  };

  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="summary-empty-state">
        <Text style={[styles.emptyTitle, { color: colors.text }]}>
          {t('onboarding.summary.emptyTitle')}
        </Text>
        <Text style={[styles.emptyBody, { color: colors.textMuted }]}>
          {t('onboarding.summary.emptyBody')}
        </Text>
        {onGoBackToStats && (
          <Pressable
            onPress={handleGoBack}
            style={[styles.retryButton, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.back')}
            testID="btn-summary-empty-back"
          >
            <Text style={[styles.retryButtonText, { color: colors.onAccent }]}>
              {t('onboarding.back')}
            </Text>
          </Pressable>
        )}
      </View>
    );
  }

  const { targetKcal, macros } = calculatedTargets;

  // Calculate percentages of total calories
  const proteinPct = Math.round((macros.proteinKcal / targetKcal) * 100);
  const fatPct = Math.round((macros.fatKcal / targetKcal) * 100);
  const carbPct = Math.max(0, 100 - proteinPct - fatPct);

  const goalName =
    goal === 'cut'
      ? t('onboarding.goal.cutTitle')
      : goal === 'maintain'
        ? t('onboarding.goal.maintainTitle')
        : t('onboarding.goal.bulkTitle');

  return (
    <View style={styles.container}>
      {/* Hero Calorie Card */}
      <View
        style={[
          styles.heroCard,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="summary-hero-card"
      >
        <View style={styles.heroBadgeRow}>
          <View
            style={[
              styles.goalBadge,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
            testID="summary-goal-badge"
          >
            <Text style={[styles.goalBadgeText, { color: colors.text }]}>{goalName}</Text>
          </View>
        </View>

        <Text
          style={[styles.heroCalories, { color: colors.text }]}
          testID="summary-hero-calories"
        >
          {t('onboarding.summary.dailyCaloriesHero', { kcal: targetKcal.toLocaleString() })}
        </Text>
        <Text style={[styles.heroUnit, { color: colors.textMuted }]}>
          {t('onboarding.summary.dailyCaloriesUnit')}
        </Text>
      </View>

      {/* Macronutrient Breakdown */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="summary-macros-card"
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {t('onboarding.summary.macrosTitle')}
        </Text>

        {/* Visual Macro Bar */}
        <View style={styles.macroBarTrack}>
          <View
            style={[
              styles.macroBarSegment,
              { width: `${proteinPct}%`, backgroundColor: colors.accent },
            ]}
          />
          <View
            style={[
              styles.macroBarSegment,
              { width: `${carbPct}%`, backgroundColor: colors.textMuted },
            ]}
          />
          <View
            style={[
              styles.macroBarSegment,
              { width: `${fatPct}%`, backgroundColor: colors.border },
            ]}
          />
        </View>

        {/* 3 Macro Metrics */}
        <View style={styles.macrosRow}>
          <View style={styles.macroMetric} testID="summary-macro-protein">
            <Text style={[styles.macroLabel, { color: colors.textMuted }]}>
              {t('onboarding.summary.proteinLabel')}
            </Text>
            <Text style={[styles.macroValue, { color: colors.text }]}>
              {macros.proteinGrams}g
            </Text>
            <Text style={[styles.macroSub, { color: colors.textMuted }]}>{proteinPct}%</Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-carbs">
            <Text style={[styles.macroLabel, { color: colors.textMuted }]}>
              {t('onboarding.summary.carbsLabel')}
            </Text>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macros.carbGrams}g</Text>
            <Text style={[styles.macroSub, { color: colors.textMuted }]}>{carbPct}%</Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-fat">
            <Text style={[styles.macroLabel, { color: colors.textMuted }]}>
              {t('onboarding.summary.fatLabel')}
            </Text>
            <Text style={[styles.macroValue, { color: colors.text }]}>{macros.fatGrams}g</Text>
            <Text style={[styles.macroSub, { color: colors.textMuted }]}>{fatPct}%</Text>
          </View>
        </View>
      </View>

      {/* Daily Habits (Steps & Water) */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Text style={[styles.cardTitle, { color: colors.text }]}>
          {t('onboarding.summary.habitsTitle')}
        </Text>

        <View style={styles.habitRow}>
          <View style={styles.habitItem} testID="summary-step-goal">
            <Text style={[styles.habitLabel, { color: colors.textMuted }]}>
              {t('onboarding.summary.stepGoalLabel')}
            </Text>
            <Text style={[styles.habitValue, { color: colors.text }]}>
              {t('onboarding.summary.stepGoalValue', { steps: stepGoal.toLocaleString() })}
            </Text>
          </View>

          <View style={styles.habitItem} testID="summary-water-goal">
            <Text style={[styles.habitLabel, { color: colors.textMuted }]}>
              {t('onboarding.summary.waterGoalLabel')}
            </Text>
            <Text style={[styles.habitValue, { color: colors.text }]}>
              {t('onboarding.summary.waterGoalValue', { ml: waterMlGoal.toLocaleString() })}
            </Text>
          </View>
        </View>
      </View>

      {/* Save Error */}
      {saveError && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.surfaceAlt, borderColor: colors.danger },
          ]}
          testID="summary-save-error"
        >
          <Text style={[styles.errorText, { color: colors.danger }]}>{saveError}</Text>
        </View>
      )}

      {/* Save / Finish Button */}
      <Pressable
        testID="btn-save-targets"
        accessibilityRole="button"
        accessibilityLabel={t('onboarding.summary.saveButton')}
        disabled={isSaving}
        onPress={handleSave}
        style={({ pressed }) => [
          styles.saveButton,
          {
            backgroundColor: colors.accent,
            opacity: isSaving ? 0.7 : pressed ? 0.9 : 1,
          },
        ]}
      >
        {isSaving ? (
          <View style={styles.savingRow}>
            <ActivityIndicator size="small" color={colors.onAccent} />
            <Text style={[styles.saveButtonText, { color: colors.onAccent }]}>
              {t('onboarding.saving')}
            </Text>
          </View>
        ) : (
          <Text style={[styles.saveButtonText, { color: colors.onAccent }]}>
            {t('onboarding.summary.saveButton')}
          </Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
    paddingBottom: spacing.lg,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.md,
  },
  emptyTitle: {
    fontSize: fontSize.lg,
    fontWeight: '700',
    textAlign: 'center',
  },
  emptyBody: {
    fontSize: fontSize.sm,
    textAlign: 'center',
    lineHeight: 20,
  },
  retryButton: {
    minHeight: 44,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.pill,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  retryButtonText: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  heroCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    gap: spacing.xs,
  },
  heroBadgeRow: {
    marginBottom: spacing.xs,
  },
  goalBadge: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  goalBadgeText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  heroCalories: {
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: -1,
  },
  heroUnit: {
    fontSize: fontSize.md,
    fontWeight: '500',
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  macroBarTrack: {
    flexDirection: 'row',
    height: 8,
    borderRadius: radius.pill,
    overflow: 'hidden',
    width: '100%',
  },
  macroBarSegment: {
    height: '100%',
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroMetric: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  macroLabel: {
    fontSize: fontSize.sm - 2,
    fontWeight: '500',
  },
  macroValue: {
    fontSize: fontSize.lg,
    fontWeight: '700',
  },
  macroSub: {
    fontSize: fontSize.sm - 2,
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  habitItem: {
    flex: 1,
    gap: 2,
  },
  habitLabel: {
    fontSize: fontSize.sm - 1,
  },
  habitValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
  },
  howCalculatedLink: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  howCalculatedText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  errorBanner: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorText: {
    fontSize: fontSize.sm,
    fontWeight: '500',
  },
  saveButton: {
    minHeight: 52,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  savingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  saveButtonText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
