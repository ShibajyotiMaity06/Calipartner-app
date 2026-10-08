import { StyleSheet, Text, View } from 'react-native';
import type { CalculateTargetsResult } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface HowCalculatedStepProps {
  calculatedTargets: CalculateTargetsResult | null;
  bodyFatPercentage: number | null;
}

export function HowCalculatedStep({
  calculatedTargets,
  bodyFatPercentage,
}: HowCalculatedStepProps) {
  const { colors } = useTheme();

  if (!calculatedTargets) {
    return (
      <View style={styles.emptyContainer} testID="how-calc-empty">
        <Text style={[styles.emptyText, { color: colors.textMuted }]}>
          {t('onboarding.summary.emptyBody')}
        </Text>
      </View>
    );
  }

  const {
    bmr,
    tdee,
    targetKcal,
    dailyChangeKcal,
    weeklyRateKg,
    safety,
    macros,
    goal,
  } = calculatedTargets;

  const activityMultiplier = bmr > 0 ? (Math.round((tdee / bmr) * 1000) / 1000).toFixed(3) : '1.55';
  const proteinPerKg = goal === 'cut' ? 2.0 : goal === 'maintain' ? 1.6 : 1.8;
  const hasBodyFat = bodyFatPercentage !== null && bodyFatPercentage > 0;

  return (
    <View style={styles.container}>
      {/* 1. BMR Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="how-calc-bmr"
      >
        <Text style={[styles.cardHeader, { color: colors.text }]}>
          {t('onboarding.howCalculated.bmrHeader')}
        </Text>
        <Text style={[styles.formulaIntro, { color: colors.textMuted }]}>
          {hasBodyFat
            ? t('onboarding.howCalculated.bmrKatch')
            : t('onboarding.howCalculated.bmrMifflin')}
        </Text>
        <View style={[styles.formulaBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.formulaCode, { color: colors.text }]}>
            {hasBodyFat
              ? t('onboarding.howCalculated.bmrFormulaKatch')
              : t('onboarding.howCalculated.bmrFormulaMifflin')}
          </Text>
        </View>
        <Text style={[styles.resultText, { color: colors.text }]}>
          {t('onboarding.howCalculated.bmrResult', { kcal: bmr })}
        </Text>
      </View>

      {/* 2. TDEE Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="how-calc-tdee"
      >
        <Text style={[styles.cardHeader, { color: colors.text }]}>
          {t('onboarding.howCalculated.tdeeHeader')}
        </Text>
        <View style={[styles.formulaBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.formulaCode, { color: colors.text }]}>
            {t('onboarding.howCalculated.tdeeFormula', { multiplier: activityMultiplier })}
          </Text>
        </View>
        <Text style={[styles.resultText, { color: colors.text }]}>
          {t('onboarding.howCalculated.tdeeResult', { kcal: tdee })}
        </Text>
      </View>

      {/* 3. Goal Adjustment Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="how-calc-adjustment"
      >
        <Text style={[styles.cardHeader, { color: colors.text }]}>
          {t('onboarding.howCalculated.adjustmentHeader')}
        </Text>
        <View style={[styles.formulaBox, { backgroundColor: colors.surfaceAlt }]}>
          <Text style={[styles.formulaCode, { color: colors.text }]}>
            {t('onboarding.howCalculated.adjustmentFormula', { rate: weeklyRateKg })}
          </Text>
        </View>
        <Text style={[styles.resultText, { color: colors.text }]}>
          {t('onboarding.howCalculated.adjustmentResult', {
            diff:
              dailyChangeKcal < 0
                ? `-${Math.abs(dailyChangeKcal)}`
                : `+${dailyChangeKcal}`,
          })}
          {' → '}
          <Text style={{ fontWeight: '700' }}>{targetKcal} kcal / day</Text>
        </Text>
      </View>

      {/* 4. Safety Guards Applied */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="how-calc-safety"
      >
        <Text style={[styles.cardHeader, { color: colors.text }]}>
          {t('onboarding.howCalculated.safetyHeader')}
        </Text>
        <View style={styles.bulletList}>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            • {t('onboarding.howCalculated.safetyFloorRule', { floor: safety.calorieFloor })}
          </Text>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            • {t('onboarding.howCalculated.safetyCapRule', { cap: safety.rateCapKgPerWeek })}
          </Text>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            • {t('onboarding.howCalculated.safetyBmiRule')}
          </Text>
        </View>
      </View>

      {/* 5. Macro Distribution Card */}
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
        testID="how-calc-macros"
      >
        <Text style={[styles.cardHeader, { color: colors.text }]}>
          {t('onboarding.howCalculated.macrosHeader')}
        </Text>
        <View style={styles.bulletList}>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            •{' '}
            {t('onboarding.howCalculated.proteinRule', {
              perKg: proteinPerKg,
              grams: macros.proteinGrams,
              kcal: macros.proteinKcal,
            })}
          </Text>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            •{' '}
            {t('onboarding.howCalculated.fatRule', {
              grams: macros.fatGrams,
              kcal: macros.fatKcal,
            })}
          </Text>
          <Text style={[styles.bulletItem, { color: colors.textMuted }]}>
            •{' '}
            {t('onboarding.howCalculated.carbRule', {
              grams: macros.carbGrams,
              kcal: macros.carbKcal,
            })}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.md,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: fontSize.md,
    textAlign: 'center',
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.xs,
  },
  cardHeader: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  formulaIntro: {
    fontSize: fontSize.sm - 1,
  },
  formulaBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.xs,
  },
  formulaCode: {
    fontSize: fontSize.sm - 1,
    fontFamily: 'monospace',
    fontWeight: '500',
  },
  resultText: {
    fontSize: fontSize.sm,
    marginTop: spacing.xs,
    fontWeight: '500',
  },
  bulletList: {
    gap: spacing.xs,
    paddingTop: spacing.xs,
  },
  bulletItem: {
    fontSize: fontSize.sm - 1,
    lineHeight: 18,
  },
});
