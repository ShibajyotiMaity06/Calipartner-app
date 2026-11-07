import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  isGymPlanValid,
  type GymTargetsResult,
  type OnboardingTargetOverrides,
} from '@calipartner/core';
import { Button, Text, useTheme, homeLayout, space } from '@calipartner/ui';
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
  if (!isGymPlanValid(result))
    return (
      <Text
        fontSet="onboarding"
        color={colors.danger}
        accessibilityRole="alert"
        testID="plan-safety-notice"
      >
        {t('fixes.invalidPlan')}
      </Text>
    );
  const { safety } = result;
  const reason = safety.isBmiTooLowForCut
    ? t('fixes.bmiAdvisory')
    : safety.isFloorApplied
      ? t('fixes.floorAdvisory', { floor: safety.calorieFloor })
      : safety.isCapApplied
        ? t('fixes.rateAdvisory')
        : !isGymPlanValid(result)
          ? t('setup.macroReason')
          : null;
  if (reason)
    return (
      <Text
        fontSet="onboarding"
        color={colors.textMid}
        accessibilityRole="alert"
        testID="plan-safety-notice"
      >
        {reason} {t('fixes.advisory')}
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
  onPlanned,
  onCalculation,
  saving,
  error,
}: {
  state: OnboardingState;
  onWeight: (value: number) => void;
  onDays: (value: number) => void;
  onAdjustment: (value: number) => void;
  onRecommended: () => void;
  onPlanned: (overrides?: OnboardingTargetOverrides) => void;
  onCalculation?: () => void;
  onChangeGoal: () => void;
  saving: boolean;
  error: string | null;
}) {
  const { colors } = useTheme();
  const result = state.calculatedTargets;
  const [editing, setEditing] = React.useState(false);
  const [overrides, setOverrides] = React.useState<OnboardingTargetOverrides>({});
  const fields = [
    ['calories', result?.targetKcal, 'personalDay.caloriesInput'],
    ['protein', result?.macros.proteinGrams, 'customMacros.protein'],
    ['carbs', result?.macros.carbGrams, 'customMacros.carbs'],
    ['fat', result?.macros.fatGrams, 'customMacros.fat'],
  ] as const;
  return (
    <View style={planStyles.section}>
      {result ? (
        <>
          <PlanCard testID="plan-target-card">
            <Text variant="bodyS">{t('setup.dailyTarget')}</Text>
            <Text nutrient="calories" variant="numeralXL" tabular testID="plan-calorie-target">
              {result.targetKcal.toLocaleString()}
            </Text>
            <Text variant="bodyS">
              {t('setup.kcalDay', { kcal: result.targetKcal.toLocaleString() })}
            </Text>
            <Text variant="bodyS">{t('setup.estimateNote')}</Text>
          </PlanCard>
          <PlanCard testID="plan-macro-split">
            <Text variant="heading">{t('setup.macros')}</Text>
            <View style={planStyles.row}>
              {fields.map(([key, value, label]) => (
                <View key={key} style={reviewStyles.metric}>
                  <Text variant="bodyS">{t(label)}</Text>
                  <Text variant="heading" tabular>
                    {value}
                  </Text>
                </View>
              ))}
            </View>
          </PlanCard>
        </>
      ) : (
        <Text>{t('onboarding.summary.emptyBody')}</Text>
      )}
      <PlanSafetyNotice result={result} />
      {onCalculation && (
        <Button
          variant="tertiary"
          label={t('setup.howCalculated')}
          onPress={onCalculation}
          testID="btn-how-calculated"
        />
      )}
      {editing && (
        <PlanCard testID="onboarding-custom-targets">
          <Text variant="heading">{t('personalDay.customTitle')}</Text>
          <Text variant="bodyS">{t('personalDay.blankDefaults')}</Text>
          {fields.map(([key, value, label]) => (
            <View key={key} style={planStyles.gap}>
              <NumberField
                label={t(label)}
                value={overrides[key] ?? null}
                optional
                onChange={(next) => setOverrides((previous) => ({ ...previous, [key]: next }))}
                testID={`custom-target-${key}`}
              />
              <Text variant="bodyS" tabular>
                {t('personalDay.defaultValue', { value: value ?? 0 })}
              </Text>
            </View>
          ))}
        </PlanCard>
      )}
      {error && (
        <Text accessibilityRole="alert" color={colors.danger} testID="plan-save-error">
          {error}
        </Text>
      )}
      <Button
        label={t(
          saving
            ? 'setup.statusSaving'
            : editing
              ? 'personalDay.useTargets'
              : 'personalDay.planMacros',
        )}
        onPress={() => (editing ? onPlanned(overrides) : setEditing(true))}
        disabled={saving || !result || !isGymPlanValid(result)}
        testID={editing ? 'btn-use-planned' : 'btn-build-your-plan'}
      />
      {editing && (
        <Button
          variant="secondary"
          label={t('personalDay.skipTargets')}
          onPress={() => onPlanned({})}
          disabled={saving}
          testID="skip-custom-targets"
        />
      )}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  metric: { flexGrow: 1, flexBasis: homeLayout.touchSize * 2, gap: space[2] },
});
