import React from 'react';
import { View } from 'react-native';
import type { GymTargetsResult } from '@calipartner/core';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function GymCalculationStep({ result }: { result: GymTargetsResult | null }) {
  const { colors } = useTheme();
  if (!result)
    return (
      <Text fontSet="onboarding" color={colors.textMid}>
        {t('onboarding.summary.emptyBody')}
      </Text>
    );
  const { inputs, rawMacros } = result;
  const params = {
    weight: inputs.weightKg,
    height: inputs.heightCm,
    age: inputs.age,
    days: inputs.gymDays,
    offset: inputs.sex === 'male' ? 5 : inputs.sex === 'female' ? -161 : -78,
    bmr: result.rawBmr.toFixed(3),
    multiplier: result.activityMultiplier.toFixed(2),
    tdee: result.rawTdee.toFixed(3),
    adjustment: result.dailyChangeKcal,
    target: result.targetKcal,
    protein: rawMacros.proteinGrams.toFixed(2),
    fat: rawMacros.fatGrams.toFixed(2),
    carbs: rawMacros.carbGrams.toFixed(2),
  };
  return (
    <View style={planStyles.section} testID="gym-calculation-breakdown">
      <Text fontSet="onboarding" color={colors.textMid}>
        {t('setup.calculationInputs', params)}
      </Text>
      {(
        [
          ['setup.bmr', 'setup.bmrFormula'],
          ['setup.maintenance', 'setup.tdeeFormula'],
          ['setup.dailyTarget', 'setup.targetFormula'],
          ['setup.macros', 'setup.macroFormula'],
        ] as const
      ).map(([title, formula]) => (
        <PlanCard key={formula}>
          <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
            {t(title)}
          </Text>
          <Text fontSet="onboarding" variant="body" color={colors.textMid} tabular>
            {t(formula, params)}
          </Text>
        </PlanCard>
      ))}
      <Text fontSet="onboarding" color={colors.textMid}>
        {t('setup.rounding')}
      </Text>
    </View>
  );
}
