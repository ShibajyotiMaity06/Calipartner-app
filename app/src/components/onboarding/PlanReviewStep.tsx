import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  isGymPlanValid,
  type GymTargetsResult,
  type OnboardingTargetOverrides,
} from '@calipartner/core';
import { Button, Text, useTheme, homeLayout, space } from '@calipartner/ui';
import {
  Card,
  LinkButton,
  Ring,
  ScreenTitle,
  Text as V1Text,
  colors as v1Colors,
  fonts as v1Fonts,
  radius as v1Radius,
  space as v1Space,
} from '@calipartner/ui/v1';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';
import { NumberField, PlanCard, planStyles } from './PlanPrimitives';
import { computeOnboardingRevealSummary, formatWeightForUnits } from './onboardingProjection';

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
  onClearError,
  continueLabel,
  variant = 'default',
}: {
  state: OnboardingState;
  onWeight?: (value: number) => void;
  onDays?: (value: number) => void;
  onAdjustment?: (value: number) => void;
  onRecommended?: () => void;
  onPlanned: (overrides?: OnboardingTargetOverrides) => void;
  onCalculation?: () => void;
  onChangeGoal?: () => void;
  saving: boolean;
  error: string | null;
  onClearError?: () => void;
  continueLabel?: string;
  variant?: 'default' | 'v1';
}) {
  const { colors } = useTheme();
  const result = state.calculatedTargets;
  const [editing, setEditing] = React.useState(false);
  const [overrides, setOverrides] = React.useState<OnboardingTargetOverrides>({});

  if (variant === 'v1') {
    const unit = t(state.units === 'metric' ? 'onboardingV1.unitKg' : 'onboardingV1.unitLb');
    const summary = computeOnboardingRevealSummary(state);
    const trimmedName = state.nickname.trim();
    const rateSign = state.goal === 'cut' ? '-' : state.goal === 'bulk' ? '+' : '';
    const paceDisplay = `${rateSign}${formatWeightForUnits(summary.rateKg, state.units)} ${unit}`;
    const targetWeightDisplay =
      state.targetWeightKg !== null
        ? `${formatWeightForUnits(state.targetWeightKg, state.units)} ${unit}`
        : t('onboardingV1.planFlexible');
    const reachByDisplay =
      state.targetWeightKg !== null ? summary.etaLabel : t('onboardingV1.planFlexible');
    const diffKcal = Math.abs(result?.dailyChangeKcal ?? 0);
    const maintText = result ? result.tdee.toLocaleString('en-US') : '0';
    const mathSummary =
      state.goal === 'cut'
        ? t('onboardingV1.planMaintDeficit', { maint: maintText, diff: diffKcal })
        : state.goal === 'bulk'
          ? t('onboardingV1.planMaintSurplus', { maint: maintText, diff: diffKcal })
          : t('onboardingV1.planMaintSteady', { maint: maintText });

    return (
      <View style={v1Styles.root} testID="plan-summary-v1">
        <ScreenTitle
          eyebrow={t('onboardingV1.planEyebrow')}
          title={
            trimmedName
              ? t('onboardingV1.planTitleNamed', { name: trimmedName })
              : t('onboardingV1.planTitleFallback')
          }
          accentWord={t('onboardingV1.planAccent')}
          subtitle={t('onboardingV1.planSubtitle')}
          spacingBottom={v1Space.xl}
          testID="onboarding-title"
        />

        {result ? (
          <>
            <Card variant="hero" style={v1Styles.heroCard} testID="plan-target-card">
              <View style={v1Styles.topRow}>
                <Ring
                  size={136}
                  strokeWidth={12}
                  progress={0.68}
                  testID="plan-calorie-ring"
                  accessibilityLabel={`${result.targetKcal.toLocaleString('en-US')} ${t('onboardingV1.kcalUnitLine')}`}
                >
                  <View style={v1Styles.ringCenter}>
                    <V1Text
                      maxFontSizeMultiplier={1.2}
                      tabular
                      style={v1Styles.ringNum}
                      testID="plan-calorie-target"
                    >
                      {result.targetKcal.toLocaleString('en-US')}
                    </V1Text>
                    <V1Text variant="meta" color="textLo" style={v1Styles.ringUnit}>
                      {t('onboardingV1.kcalUnitLine')}
                    </V1Text>
                  </View>
                </Ring>

                <View style={v1Styles.statsCol}>
                  <View style={v1Styles.statItem}>
                    <V1Text variant="meta" color="textLo">
                      {t('onboardingV1.planWeeklyPace')}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.statVal}>
                      {paceDisplay}
                    </V1Text>
                  </View>
                  <View style={v1Styles.statItem}>
                    <V1Text variant="meta" color="textLo">
                      {t('onboardingV1.planTargetWeight')}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.statVal}>
                      {targetWeightDisplay}
                    </V1Text>
                  </View>
                  <View style={v1Styles.statItem}>
                    <V1Text variant="meta" color="textLo">
                      {t('onboardingV1.planReachBy')}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.statVal}>
                      {reachByDisplay}
                    </V1Text>
                  </View>
                </View>
              </View>

              <View style={v1Styles.divider} />

              <View style={v1Styles.macrosRow} testID="plan-macro-split">
                {(
                  [
                    [
                      'protein',
                      t('onboardingV1.planProtein'),
                      result.macros.proteinGrams,
                      v1Colors.apricot,
                    ],
                    [
                      'carbs',
                      t('onboardingV1.planCarbs'),
                      result.macros.carbGrams,
                      v1Colors.apricotPressed,
                    ],
                    [
                      'fat',
                      t('onboardingV1.planFat'),
                      result.macros.fatGrams,
                      v1Colors.hairlineLit,
                    ],
                  ] as const
                ).map(([key, label, grams, dotColor]) => (
                  <View key={key} style={v1Styles.macroCol}>
                    <View style={v1Styles.macroLabelRow}>
                      <View style={[v1Styles.macroDot, { backgroundColor: dotColor }]} />
                      <V1Text variant="meta" color="textLo">
                        {label}
                      </V1Text>
                    </View>
                    <View style={v1Styles.macroValRow}>
                      <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.macroNum}>
                        {String(grams)}
                      </V1Text>
                      <V1Text style={v1Styles.macroGram}>g</V1Text>
                    </View>
                  </View>
                ))}
              </View>
            </Card>

            <View style={v1Styles.mathRow}>
              <V1Text variant="meta" color="textLo" tabular>
                {mathSummary}
              </V1Text>
              {onCalculation ? (
                <LinkButton
                  title={t('onboardingV1.planSeeMath')}
                  variant="accent"
                  onPress={onCalculation}
                  testID="btn-how-calculated"
                />
              ) : null}
            </View>
          </>
        ) : (
          <V1Text color="textMid">{t('onboarding.summary.emptyBody')}</V1Text>
        )}

        <PlanSafetyNotice result={result} />

        {error ? (
          <V1Text color="danger" accessibilityRole="alert" testID="plan-save-error">
            {error}
          </V1Text>
        ) : null}
      </View>
    );
  }
  const fields = [
    ['calories', result?.targetKcal, 'personalDay.caloriesInput'],
    ['protein', result?.macros.proteinGrams, 'customMacros.protein'],
    ['carbs', result?.macros.carbGrams, 'customMacros.carbs'],
    ['fat', result?.macros.fatGrams, 'customMacros.fat'],
  ] as const;
  return (
    <View style={planStyles.section}>
      {result && !editing ? (
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
              {fields
                .filter(([key]) => key !== 'calories')
                .map(([key, value, label]) => (
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
      ) : !result ? (
        <Text>{t('onboarding.summary.emptyBody')}</Text>
      ) : null}
      <PlanSafetyNotice result={result} />
      {onCalculation && (
        <Button
          variant="tertiary"
          fullWidth={false}
          label={t('setup.howCalculated')}
          accessibilityRole="button"
          accessibilityLabel={t('setup.howCalculated')}
          style={planStyles.link}
          onPress={onCalculation}
          testID="btn-how-calculated"
        />
      )}
      {!editing && (
        <Button
          label={
            saving ? t('setup.statusSaving') : (continueLabel ?? t('personalDay.continuePlan'))
          }
          onPress={() => onPlanned({})}
          disabled={saving || !result || !isGymPlanValid(result)}
          testID="continue-calculated-plan"
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
                placeholder={String(value ?? '')}
                onChange={(next) => {
                  onClearError?.();
                  setOverrides((previous) => ({ ...previous, [key]: next }));
                }}
                testID={`custom-target-${key}`}
              />
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
        variant={editing ? 'primary' : 'secondary'}
        label={t(
          saving
            ? 'setup.statusSaving'
            : editing
              ? 'personalDay.useTargets'
              : 'personalDay.planMacros',
        )}
        onPress={() => {
          onClearError?.();
          if (editing) onPlanned(overrides);
          else setEditing(true);
        }}
        disabled={saving || !result || !isGymPlanValid(result)}
        testID={editing ? 'btn-use-planned' : 'btn-build-your-plan'}
      />
      {editing && (
        <>
          <Button
            variant="secondary"
            label={t('releaseUpdate.returnToTargets')}
            disabled={saving}
            onPress={() => {
              onClearError?.();
              setEditing(false);
            }}
            testID="back-to-recommended-targets"
          />
          <Button
            variant="tertiary"
            label={t('personalDay.skipTargets')}
            onPress={() => onPlanned({})}
            disabled={saving}
            testID="skip-custom-targets"
          />
        </>
      )}
    </View>
  );
}

const reviewStyles = StyleSheet.create({
  metric: { flexGrow: 1, flexBasis: homeLayout.touchSize * 2, gap: space[2] },
});

const v1Styles = StyleSheet.create({
  root: {
    gap: v1Space.md,
  },
  heroCard: {
    padding: v1Space.xl,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.xl,
  },
  ringCenter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringNum: {
    fontFamily: v1Fonts.display,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.9,
    color: v1Colors.textHi,
  },
  ringUnit: {
    fontSize: 12,
    lineHeight: 15,
    marginTop: 2,
  },
  statsCol: {
    flex: 1,
    gap: v1Space.md,
  },
  statItem: {
    gap: 2,
  },
  statVal: {
    fontFamily: v1Fonts.display,
    fontSize: 17,
    lineHeight: 21,
    letterSpacing: -0.3,
    color: v1Colors.textHi,
  },
  divider: {
    height: 1,
    backgroundColor: v1Colors.hairline,
    marginVertical: v1Space.lg,
  },
  macrosRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  macroCol: {
    flex: 1,
    gap: v1Space.xs,
  },
  macroLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  macroDot: {
    width: 6,
    height: 6,
    borderRadius: v1Radius.full,
  },
  macroValRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  macroNum: {
    fontFamily: v1Fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.7,
    color: v1Colors.textHi,
  },
  macroGram: {
    fontFamily: v1Fonts.medium,
    fontSize: 13,
    lineHeight: 16,
    color: v1Colors.textLo,
    marginLeft: 2,
  },
  mathRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: v1Space.xs,
    marginTop: v1Space.xs,
  },
});
