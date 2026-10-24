import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { calculateGymTargets, isGymPlanSafe, type GymTargetsResult } from '@calipartner/core';
import { Button, Text, onboardingLayout as layout, space, useTheme } from '@calipartner/ui';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';
import { NumberField, PlanCard, planStyles } from './PlanPrimitives';

export function PlanSafetyNotice({ result }: { result: GymTargetsResult | null }) {
  const { colors } = useTheme();
  if (!result)
    return (
      <Text fontSet="onboarding" color={colors.danger} accessibilityRole="alert">
        {t('setup.detailsError')}
      </Text>
    );
  const { safety } = result;
  const reason = safety.isBmiTooLowForCut
    ? t('setup.bmiReason')
    : safety.isFloorApplied
      ? t('setup.floorReason', { floor: safety.calorieFloor })
      : safety.isCapApplied
        ? t('setup.capReason', { cap: safety.rateCapKgPerWeek })
        : !isGymPlanSafe(result)
          ? t('setup.macroReason')
          : null;
  if (reason)
    return (
      <Text
        fontSet="onboarding"
        color={colors.danger}
        accessibilityRole="alert"
        testID="plan-safety-notice"
      >
        {reason}
      </Text>
    );
  const advisory = safety.advisories.includes('lean_gain_advisory')
    ? 'setup.leanGainNotice'
    : safety.advisories.includes('large_deficit_advisory')
      ? 'setup.deficitNotice'
      : null;
  return advisory ? (
    <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
      {t(advisory)}
    </Text>
  ) : null;
}

export function PlanReviewStep({
  state,
  onWeight,
  onDays,
  onAdjustment,
  onRecommended,
  onPlanned,
  onCalculation,
  onHealth,
  onChangeGoal,
  saving,
  error,
}: {
  state: OnboardingState;
  onWeight: (value: number) => void;
  onDays: (value: number) => void;
  onAdjustment: (value: number) => void;
  onRecommended: () => void;
  onPlanned: () => void;
  onCalculation: () => void;
  onHealth: () => void;
  onChangeGoal: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  const result = state.calculatedTargets;
  const recommendation = result
    ? calculateGymTargets({
        ...result.inputs,
        activityLevel: state.activityLevel,
        goal: state.goal,
        weeklyRateKg: result.recommendedRateKg,
      })
    : null;
  return (
    <View style={planStyles.section}>
      {result ? (
        <>
          <PlanCard testID="plan-target-card">
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t('setup.dailyTarget')}
            </Text>
            <Text
              fontSet="onboarding"
              variant="numeralXL"
              color={colors.textHi}
              maxFontSizeMultiplier={2}
              testID="plan-calorie-target"
            >
              {result.targetKcal.toLocaleString()}
            </Text>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t('setup.kcalDay', { kcal: result.targetKcal.toLocaleString() })}
            </Text>
            <View style={planStyles.row}>
              <Metric title={t('setup.bmr')} value={result.bmr.toLocaleString()} />
              <Metric title={t('setup.maintenance')} value={result.tdee.toLocaleString()} />
              <Metric
                title={t('setup.monthly')}
                value={t('setup.monthlyValue', {
                  change: `${result.monthlyChangeKg > 0 ? '+' : ''}${result.monthlyChangeKg.toFixed(2)}`,
                })}
              />
            </View>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t('setup.estimateNote')}
            </Text>
          </PlanCard>
          {isGymPlanSafe(result) ? <MacroSplit result={result} /> : null}
        </>
      ) : (
        <PlanCard>
          <Text fontSet="onboarding" color={colors.textMid}>
            {t('onboarding.summary.emptyBody')}
          </Text>
        </PlanCard>
      )}
      <PlanCard testID="plan-controls">
        <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
          {t('setup.editPlan')}
        </Text>
        <NumberField
          label={t('setup.weight')}
          value={state.weightKg}
          onChange={(value) => onWeight(value ?? NaN)}
          testID="review-weight"
        />
        <NumberField
          label={t('setup.gymDays')}
          value={state.gymDays}
          onChange={(value) => onDays(value ?? NaN)}
          testID="review-gym-days"
        />
        {state.goal !== 'maintain' ? (
          <NumberField
            label={t(state.goal === 'bulk' ? 'setup.surplus' : 'setup.deficit')}
            value={state.dailyAdjustmentKcal ?? (result ? Math.abs(result.dailyChangeKcal) : null)}
            onChange={(value) => onAdjustment(value ?? NaN)}
            testID="review-adjustment"
          />
        ) : null}
        <PlanSafetyNotice result={result} />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('setup.changeGoal')}
          testID="review-change-goal"
          onPress={onChangeGoal}
          style={planStyles.link}
        >
          <Text fontSet="onboarding" color={colors.textMid}>
            {t('setup.changeGoal')}
          </Text>
        </Pressable>
      </PlanCard>
      <PlanCard testID="plan-recommendation">
        <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
          {t('setup.recommendedPlan')}
        </Text>
        {recommendation ? (
          <Text fontSet="onboarding" color={colors.textMid} tabular>
            {t(
              state.goal === 'maintain'
                ? 'setup.recommendationMaintain'
                : 'setup.recommendationDetail',
              {
                rate: result?.recommendedRateKg ?? 0,
                kcal: recommendation.targetKcal.toLocaleString(),
              },
            )}
          </Text>
        ) : null}
        <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
          {t('setup.guardrails', {
            floor: result?.safety.calorieFloor ?? '—',
            cap: result?.safety.rateCapKgPerWeek ?? '—',
          })}
        </Text>
      </PlanCard>
      <Pressable
        onPress={onCalculation}
        accessibilityRole="button"
        accessibilityLabel={t('setup.howCalculated')}
        testID="btn-how-calculated"
        style={planStyles.link}
      >
        <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
          {t('setup.howCalculated')}
        </Text>
      </Pressable>
      <Pressable
        onPress={onHealth}
        accessibilityRole="button"
        accessibilityLabel={t('setup.privateHealth')}
        testID="btn-private-health"
        style={planStyles.link}
      >
        <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
          {t('setup.privateHealth')}
        </Text>
      </Pressable>
      {error ? (
        <Text
          fontSet="onboarding"
          accessibilityRole="alert"
          color={colors.danger}
          testID="plan-save-error"
        >
          {error}
        </Text>
      ) : null}
      {saving ? (
        <Text fontSet="onboarding" accessibilityLiveRegion="polite" color={colors.textMid}>
          {t('setup.statusSaving')}
        </Text>
      ) : null}
      <Button
        fontSet="onboarding"
        label={t('setup.useRecommended')}
        onPress={onRecommended}
        disabled={saving || !recommendation || !isGymPlanSafe(recommendation)}
        testID="btn-use-recommended"
      />
      <Button
        fontSet="onboarding"
        variant="secondary"
        label={t('setup.usePlanned')}
        onPress={onPlanned}
        disabled={saving || !result || !isGymPlanSafe(result)}
        testID="btn-use-planned"
      />
    </View>
  );
}

function Metric({ title, value }: { title: string; value: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.metric}>
      <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
        {title}
      </Text>
      <Text
        fontSet="onboarding"
        variant="heading"
        color={colors.textHi}
        tabular
        maxFontSizeMultiplier={2}
      >
        {value}
      </Text>
    </View>
  );
}

function MacroSplit({ result }: { result: GymTargetsResult }) {
  const { colors } = useTheme();
  const size = layout.ring;
  const r = (size - layout.ringStroke) / 2;
  const circumference = 2 * Math.PI * r;
  const segments = [
    {
      label: t('setup.carbs'),
      grams: result.macros.carbGrams,
      kcal: result.macros.carbKcal,
      percent: result.macroShares.carbs,
      color: colors.cream,
    },
    {
      label: t('setup.fat'),
      grams: result.macros.fatGrams,
      kcal: result.macros.fatKcal,
      percent: result.macroShares.fat,
      color: colors.teal,
    },
    {
      label: t('setup.protein'),
      grams: result.macros.proteinGrams,
      kcal: result.macros.proteinKcal,
      percent: result.macroShares.protein,
      color: colors.iris,
    },
  ];
  let offset = 0;
  return (
    <PlanCard testID="plan-macro-split">
      <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
        {t('setup.macros')}
      </Text>
      <View
        style={planStyles.centered}
        accessible
        accessibilityLabel={t('setup.macroSummary', {
          protein: result.macros.proteinGrams,
          fat: result.macros.fatGrams,
          carbs: result.macros.carbGrams,
          total: result.totalMacroGrams,
        })}
      >
        <View
          style={{ width: size, height: size }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <Circle
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={colors.s3}
              strokeWidth={layout.ringStroke}
            />
            {segments.map((segment) => {
              const length = (segment.percent / 100) * circumference;
              const start = offset;
              offset += length;
              return (
                <Circle
                  key={segment.label}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={segment.color}
                  strokeWidth={layout.ringStroke}
                  strokeDasharray={`${Math.max(0, length - space[1])} ${circumference}`}
                  strokeDashoffset={-start}
                  transform={`rotate(-90 ${size / 2} ${size / 2})`}
                  strokeLinecap="round"
                />
              );
            })}
          </Svg>
          <View style={styles.ringCenter}>
            <Text
              fontSet="onboarding"
              variant="numeralM"
              color={colors.textHi}
              maxFontSizeMultiplier={2}
            >
              {t('setup.grams', { grams: result.totalMacroGrams })}
            </Text>
            <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
              {t('setup.totalMacros')}
            </Text>
          </View>
        </View>
      </View>
      {segments.map((segment) => (
        <View key={segment.label} style={planStyles.gap}>
          <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
            {segment.label}
          </Text>
          <Text fontSet="onboarding" variant="bodyS" color={colors.textMid} tabular>
            {t('setup.macroDetail', {
              grams: segment.grams,
              kcal: segment.kcal.toLocaleString(),
              percent: segment.percent,
            })}
          </Text>
        </View>
      ))}
    </PlanCard>
  );
}

const styles = StyleSheet.create({
  metric: { flexGrow: 1, flexBasis: layout.logo, gap: space[1] },
  ringCenter: {
    position: 'absolute',
    inset: space[0],
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
});
