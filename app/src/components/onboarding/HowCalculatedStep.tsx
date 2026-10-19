import React from 'react';
import { StyleSheet, View } from 'react-native';
import type { CalculateTargetsResult } from '@calipartner/core';
import { Text, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';

interface HowCalculatedStepProps {
  calculatedTargets: CalculateTargetsResult | null;
  bodyFatPercentage: number | null;
}

export function HowCalculatedStep({
  calculatedTargets,
  bodyFatPercentage,
}: HowCalculatedStepProps) {
  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="how-calc-empty">
        <Text variant="body" color={dark.textLo}>
          {t('onboarding.summary.emptyBody')}
        </Text>
      </View>
    );
  }

  const { bmr, tdee, targetKcal, dailyChangeKcal, weeklyRateKg } = calculatedTargets;
  const activityMultiplier = bmr > 0 ? (Math.round((tdee / bmr) * 1000) / 1000).toFixed(3) : '1.55';
  const hasBodyFat = bodyFatPercentage !== null && bodyFatPercentage > 0;

  return (
    <View style={styles.container}>
      {/* 1. BMR Card (Inputs & Formula) */}
      <View style={styles.card} testID="how-calc-bmr">
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.howCalculated.bmrHeader')}
        </Text>
        <Text variant="bodyS" color={dark.textMid} style={styles.formulaIntro}>
          {hasBodyFat
            ? t('onboarding.howCalculated.bmrKatch')
            : t('onboarding.howCalculated.bmrMifflin')}
        </Text>
        <View style={styles.formulaBox}>
          <Text variant="label" color={dark.textHi} style={styles.formulaCode}>
            {hasBodyFat
              ? t('onboarding.howCalculated.bmrFormulaKatch')
              : t('onboarding.howCalculated.bmrFormulaMifflin')}
          </Text>
        </View>
        <Text variant="body" color={dark.textHi} style={styles.resultText}>
          {t('onboarding.howCalculated.bmrResult', { kcal: bmr.toLocaleString() })}
        </Text>
      </View>

      {/* 2. TDEE Card */}
      <View style={styles.card} testID="how-calc-tdee">
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.howCalculated.tdeeHeader')}
        </Text>
        <View style={styles.formulaBox}>
          <Text variant="label" color={dark.textHi} style={styles.formulaCode}>
            {t('onboarding.howCalculated.tdeeFormula', { multiplier: activityMultiplier })}
          </Text>
        </View>
        <Text variant="body" color={dark.textHi} style={styles.resultText}>
          {t('onboarding.howCalculated.tdeeResult', { kcal: tdee.toLocaleString() })}
        </Text>
      </View>

      {/* 3. Goal Adjustment Card & Result */}
      <View style={styles.card} testID="how-calc-adjustment">
        <Text variant="heading" color={dark.textHi}>
          {t('onboarding.howCalculated.adjustmentHeader')}
        </Text>
        <View style={styles.formulaBox}>
          <Text variant="label" color={dark.textHi} style={styles.formulaCode}>
            {t('onboarding.howCalculated.adjustmentFormula', { rate: weeklyRateKg })}
          </Text>
        </View>
        <Text variant="body" color={dark.textHi} style={styles.resultText}>
          {t('onboarding.howCalculated.adjustmentResult', {
            diff: dailyChangeKcal < 0 ? `-${Math.abs(dailyChangeKcal)}` : `+${dailyChangeKcal}`,
          })}
          {' → '}
          <Text variant="body" color={dark.apricot} style={{ fontWeight: '700' }}>
            {targetKcal.toLocaleString()} kcal / day
          </Text>
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: space[3],
    paddingTop: space[2],
  },
  emptyContainer: {
    padding: space[4],
    alignItems: 'center',
  },
  card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    padding: space[4],
    gap: space[2],
  },
  formulaIntro: {
    lineHeight: 18,
  },
  formulaBox: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  formulaCode: {
    fontFamily: 'monospace',
    lineHeight: 16,
  },
  resultText: {
    fontWeight: '600',
    marginTop: 2,
  },
});
