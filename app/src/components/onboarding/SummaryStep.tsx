import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import type { CalculateTargetsResult, Goal } from '@calipartner/core';
import { Text, Button, TargetRevealRing, MacroBar, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound, playSuccessSound } from '@/lib/sound';

interface SummaryStepProps {
  goal: Goal;
  stepGoal: number;
  waterMlGoal: number;
  calculatedTargets: CalculateTargetsResult | null;
  isSaving: boolean;
  saveError: string | null;
  onSave: () => void;
  onGoBackToStats?: () => void;
  onGoBackToRate?: () => void;
  onOpenHowCalculated?: () => void;
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
  onGoBackToRate,
  onOpenHowCalculated,
}: SummaryStepProps) {
  const handleSave = () => {
    playSuccessSound();
    onSave();
  };

  const handleGoBack = () => {
    playClickSound();
    if (onGoBackToStats) onGoBackToStats();
  };

  const handleChangeRate = () => {
    playClickSound();
    if (onGoBackToRate) {
      onGoBackToRate();
    } else if (onGoBackToStats) {
      onGoBackToStats();
    }
  };

  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="summary-empty-state">
        <Text variant="title1" color={dark.textHi} style={styles.emptyTitle}>
          {t('onboarding.summary.emptyTitle')}
        </Text>
        <Text variant="body" color={dark.textMid} style={styles.emptyBody}>
          {t('onboarding.summary.emptyBody')}
        </Text>
        {onGoBackToStats && (
          <Button
            variant="primary"
            size="md"
            label={t('onboarding.back')}
            onPress={handleGoBack}
            testID="btn-summary-empty-back"
          />
        )}
      </View>
    );
  }

  const { targetKcal, macros, weeklyRateKg } = calculatedTargets;

  // Rate statement per Spec A10
  const rateSentence =
    goal === 'maintain'
      ? 'Based on your stats, this maintains your current weight.'
      : goal === 'cut'
        ? `Based on your stats, this puts you on track to lose ${weeklyRateKg} kg a week.`
        : `Based on your stats, this puts you on track to gain ${weeklyRateKg} kg a week.`;

  return (
    <View style={styles.container}>
      {/* Spec A10: The first "wow" — Single large ring (184) with iris→apricot→teal gradient */}
      <View style={styles.heroRingCard} testID="summary-hero-card">
        <TargetRevealRing
          targetKcal={targetKcal}
          size={184}
          strokeWidth={16}
          caption="kcal a day"
          testID="summary-hero-calories"
        />

        {/* Supportive goal sentence per Spec A10 */}
        <Text variant="body" color={dark.textMid} style={styles.rateSentence}>
          {rateSentence}
        </Text>
      </View>

      {/* Macronutrient Distribution Card with MacroBar */}
      <View style={styles.card} testID="summary-macros-card">
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.summary.macrosTitle')}
        </Text>

        <MacroBar
          proteinGrams={macros.proteinGrams}
          carbsGrams={macros.carbGrams}
          fatGrams={macros.fatGrams}
          identityHue="iris"
        />

        {/* 3 Macro Metrics */}
        <View style={styles.macrosRow}>
          <View style={styles.macroMetric} testID="summary-macro-protein">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.proteinLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {macros.proteinGrams}g
            </Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-carbs">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.carbsLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {macros.carbGrams}g
            </Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-fat">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.fatLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {macros.fatGrams}g
            </Text>
          </View>
        </View>

        {/* Spec A10 & A11: Link to "How is this worked out?" */}
        {onOpenHowCalculated && (
          <TouchableOpacity
            onPress={onOpenHowCalculated}
            style={styles.howCalcLink}
            accessibilityRole="button"
            accessibilityLabel={t('onboarding.summary.howCalculatedLink')}
            testID="btn-how-calculated-link"
          >
            <Text variant="bodyS" color={dark.apricot} style={styles.howCalcText}>
              How is this worked out? →
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Daily Habits (Steps & Water) */}
      <View style={styles.card}>
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.summary.habitsTitle')}
        </Text>

        <View style={styles.habitRow}>
          <View style={styles.habitItem} testID="summary-step-goal">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.stepGoalLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.habitValue}>
              {stepGoal.toLocaleString()} steps
            </Text>
          </View>

          <View style={styles.habitItem} testID="summary-water-goal">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.waterGoalLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.habitValue}>
              {waterMlGoal.toLocaleString()} ml
            </Text>
          </View>
        </View>
      </View>

      {/* Save Error */}
      {saveError && (
        <View style={styles.errorBanner} testID="summary-save-error">
          <Text variant="bodyS" color={dark.danger}>
            {saveError}
          </Text>
        </View>
      )}

      {/* Primary & Secondary Action Buttons (Spec A10) */}
      <View style={styles.actionsGroup}>
        <Button
          variant="primary"
          size="lg"
          label={isSaving ? t('onboarding.saving') : 'Looks good'}
          onPress={handleSave}
          disabled={isSaving}
          testID="btn-save-targets"
        />

        <Button
          variant="secondary"
          size="md"
          label="Change my rate"
          onPress={handleChangeRate}
          disabled={isSaving}
          testID="btn-change-rate"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    gap: space[4],
    paddingTop: space[2],
    paddingBottom: space[4],
  },
  emptyContainer: {
    padding: space[4],
    alignItems: 'center',
    gap: space[3],
  },
  emptyTitle: {
    textAlign: 'center',
  },
  emptyBody: {
    textAlign: 'center',
    lineHeight: 20,
  },
  heroRingCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    alignItems: 'center',
    gap: space[3],
  },
  rateSentence: {
    textAlign: 'center',
    lineHeight: 22,
    maxWidth: 320,
  },
  card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[3],
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space[1],
  },
  macroMetric: {
    alignItems: 'center',
    flex: 1,
    gap: 2,
  },
  macroValue: {
    fontWeight: '700',
  },
  howCalcLink: {
    minHeight: 44,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: space[1],
  },
  howCalcText: {
    fontWeight: '600',
  },
  habitRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space[3],
  },
  habitItem: {
    flex: 1,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[3],
    gap: 4,
  },
  habitValue: {
    fontWeight: '600',
  },
  errorBanner: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.danger,
    borderRadius: radius.control,
    padding: space[3],
  },
  actionsGroup: {
    gap: space[3],
    marginTop: space[2],
  },
});
