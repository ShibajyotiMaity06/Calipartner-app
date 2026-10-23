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
  weightKg?: number;
  calculatedTargets: CalculateTargetsResult | null;
  isSaving: boolean;
  saveError: string | null;
  onSave: (customized?: {
    proteinGrams?: number;
    carbGrams?: number;
    fatGrams?: number;
    stepGoal?: number;
    waterMlGoal?: number;
  }) => void;
  onGoBackToStats?: () => void;
  onGoBackToRate?: () => void;
  onOpenHowCalculated?: () => void;
}

export function SummaryStep({
  goal,
  stepGoal,
  waterMlGoal,
  weightKg,
  calculatedTargets,
  isSaving,
  saveError,
  onSave,
  onGoBackToStats,
  onGoBackToRate,
  onOpenHowCalculated,
}: SummaryStepProps) {
  const [customWaterMl, setCustomWaterMl] = React.useState<number>(waterMlGoal || 2500);
  const [customStepGoal, setCustomStepGoal] = React.useState<number>(stepGoal || 8000);

  const handleSave = () => {
    playSuccessSound();
    onSave({
      proteinGrams,
      carbGrams,
      fatGrams,
      stepGoal: customStepGoal,
      waterMlGoal: customWaterMl,
    });
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

  const [proteinMultiplier, setProteinMultiplier] = React.useState<number>(2.0);

  const rawWeight =
    weightKg ??
    (calculatedTargets?.macros?.proteinGrams
      ? Math.round(calculatedTargets.macros.proteinGrams / 2.0)
      : 70);
  const targetKcal = calculatedTargets?.targetKcal ?? 2000;
  const weeklyRateKg = calculatedTargets?.weeklyRateKg ?? 0.5;

  // Recalculate protein grams based on user choice (1.5x vs 2.0x)
  const proteinGrams = Math.round(proteinMultiplier * rawWeight);
  const proteinKcal = proteinGrams * 4;
  const fatGrams = calculatedTargets?.macros.fatGrams ?? Math.round((targetKcal * 0.25) / 9);
  const fatKcal = fatGrams * 9;
  const remainingKcal = Math.max(0, targetKcal - proteinKcal - fatKcal);
  const carbGrams = Math.round(remainingKcal / 4);

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

      {/* Protein Preference Selector */}
      <View style={styles.card} testID="summary-protein-selector-card">
        <View style={styles.proteinHeaderRow}>
          <Text variant="heading" color={dark.textHi}>
            Daily Protein Goal
          </Text>
          <View style={styles.recommendedBadge}>
            <Text variant="micro" color={dark.apricot} style={styles.recommendedBadgeText}>
              Recommended: 1.7x for men • 1.3x for women
            </Text>
          </View>
        </View>
        <Text variant="bodyS" color={dark.textMid} style={styles.proteinSubtitle}>
          Choose your preferred daily protein intake based on your training:
        </Text>

        <View style={styles.proteinOptionsRow}>
          <TouchableOpacity
            style={[
              styles.proteinOptionBtn,
              proteinMultiplier === 1.5 && styles.proteinOptionBtnActive,
            ]}
            onPress={() => {
              playClickSound();
              setProteinMultiplier(1.5);
            }}
            accessibilityRole="button"
            testID="btn-protein-1-5x"
          >
            <Text
              variant="button"
              color={proteinMultiplier === 1.5 ? dark.onBrand : dark.textHi}
            >
              1.5x body weight
            </Text>
            <Text
              variant="micro"
              color={proteinMultiplier === 1.5 ? dark.onBrand : dark.textLo}
            >
              {Math.round(1.5 * rawWeight)}g / day
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.proteinOptionBtn,
              proteinMultiplier === 2.0 && styles.proteinOptionBtnActive,
            ]}
            onPress={() => {
              playClickSound();
              setProteinMultiplier(2.0);
            }}
            accessibilityRole="button"
            testID="btn-protein-2-0x"
          >
            <Text
              variant="button"
              color={proteinMultiplier === 2.0 ? dark.onBrand : dark.textHi}
            >
              2.0x body weight
            </Text>
            <Text
              variant="micro"
              color={proteinMultiplier === 2.0 ? dark.onBrand : dark.textLo}
            >
              {Math.round(2.0 * rawWeight)}g / day
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Macronutrient Distribution Card with MacroBar */}
      <View style={styles.card} testID="summary-macros-card">
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.summary.macrosTitle')}
        </Text>

        <MacroBar
          proteinGrams={proteinGrams}
          carbsGrams={carbGrams}
          fatGrams={fatGrams}
          identityHue="iris"
        />

        {/* 3 Macro Metrics */}
        <View style={styles.macrosRow}>
          <View style={styles.macroMetric} testID="summary-macro-protein">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.proteinLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {proteinGrams}g
            </Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-carbs">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.carbsLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {carbGrams}g
            </Text>
          </View>

          <View style={styles.macroMetric} testID="summary-macro-fat">
            <Text variant="label" color={dark.textLo}>
              {t('onboarding.summary.fatLabel')}
            </Text>
            <Text variant="body" color={dark.textHi} style={styles.macroValue}>
              {fatGrams}g
            </Text>
          </View>
        </View>
      </View>

      {/* Daily Habits (Steps & Water Target Setup) */}
      <View style={styles.card}>
        <Text variant="heading" color={dark.textHi}>
          Daily Habits
        </Text>
        <Text variant="bodyS" color={dark.textMid}>
          Set your daily hydration and movement targets.
        </Text>

        {/* Water Target Selector */}
        <View style={styles.habitControlBlock}>
          <View style={styles.habitHeaderRow}>
            <Text variant="label" color={dark.textLo}>
              Daily Water Target
            </Text>
            <Text variant="body" color={dark.apricot} style={{ fontWeight: '700' }}>
              {(customWaterMl / 1000).toFixed(1)} L ({customWaterMl} ml)
            </Text>
          </View>
          <View style={styles.habitChipsRow}>
            {[2000, 2500, 3000, 3500, 4000].map((ml) => {
              const isSelected = customWaterMl === ml;
              return (
                <TouchableOpacity
                  key={ml}
                  onPress={() => {
                    playClickSound();
                    setCustomWaterMl(ml);
                  }}
                  style={[
                    styles.habitChip,
                    isSelected && { backgroundColor: dark.apricot, borderColor: dark.apricot },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Set water target to ${(ml / 1000).toFixed(1)} litres`}
                >
                  <Text
                    variant="label"
                    color={isSelected ? dark.onBrand : dark.textMid}
                    style={{ fontWeight: isSelected ? '700' : '500' }}
                  >
                    {(ml / 1000).toFixed(1)}L
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* Step Goal Selector */}
        <View style={styles.habitControlBlock}>
          <View style={styles.habitHeaderRow}>
            <Text variant="label" color={dark.textLo}>
              Daily Step Goal
            </Text>
            <Text variant="body" color={dark.apricot} style={{ fontWeight: '700' }}>
              {customStepGoal.toLocaleString()} steps
            </Text>
          </View>
          <View style={styles.habitChipsRow}>
            {[6000, 8000, 10000, 12000, 15000].map((st) => {
              const isSelected = customStepGoal === st;
              return (
                <TouchableOpacity
                  key={st}
                  onPress={() => {
                    playClickSound();
                    setCustomStepGoal(st);
                  }}
                  style={[
                    styles.habitChip,
                    isSelected && { backgroundColor: dark.apricot, borderColor: dark.apricot },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Set daily step goal to ${st.toLocaleString()}`}
                >
                  <Text
                    variant="label"
                    color={isSelected ? dark.onBrand : dark.textMid}
                    style={{ fontWeight: isSelected ? '700' : '500' }}
                  >
                    {(st / 1000)}k
                  </Text>
                </TouchableOpacity>
              );
            })}
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
  habitControlBlock: {
    gap: space[2],
    marginTop: space[1],
  },
  habitHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  habitChipsRow: {
    flexDirection: 'row',
    gap: space[2],
    flexWrap: 'wrap',
  },
  habitChip: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    borderRadius: radius.control,
    paddingVertical: space[2],
    paddingHorizontal: space[3],
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 54,
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
  proteinHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: space[2],
  },
  recommendedBadge: {
    backgroundColor: 'rgba(255, 178, 125, 0.15)',
    paddingHorizontal: space[2],
    paddingVertical: 3,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: 'rgba(255, 178, 125, 0.3)',
  },
  recommendedBadgeText: {
    fontWeight: '700',
  },
  proteinSubtitle: {
    marginTop: -space[1],
    marginBottom: space[1],
  },
  proteinOptionsRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  proteinOptionBtn: {
    flex: 1,
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    paddingVertical: space[3],
    paddingHorizontal: space[2],
    alignItems: 'center',
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 4,
  },
  proteinOptionBtnActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
});
