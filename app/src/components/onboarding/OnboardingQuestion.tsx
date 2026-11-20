import React, { useEffect } from 'react';
import { View } from 'react-native';
import { calculateAge, cmToFtIn, ftInToCm, kgToLb, lbToKg, type Units } from '@calipartner/core';
import { Button, SegmentedControl, Text, useTheme } from '@calipartner/ui';
import { CompactSelect } from '@/components/CompactSelect';
import { t, type TranslationKey } from '@/i18n';
import {
  MAX_ONBOARDING_WEEKLY_RATE_KG,
  type OnboardingState,
  type OnboardingStateMachine,
  type OnboardingStep,
} from '@/services/onboardingStateMachine';
import { ActivityStep } from './ActivityStep';
import { GoalStep } from './GoalStep';
import { HeightField } from './HeightField';
import { InteractiveDobPicker } from './InteractiveDobPicker';
import { StatsPicker } from './StatsPicker';
import { PlanSafetyNotice } from './PlanReviewStep';
import { NumberField, PlanChoice, PlanTextField, planStyles } from './PlanPrimitives';

type Copy = { title: TranslationKey; subtitle?: TranslationKey };
export const questionCopy: Record<OnboardingStep, Copy> = {
  goal: { title: 'characterSetup.startTitle' },
  nickname: { title: 'characterSetup.nameTitle' },
  age: { title: 'characterSetup.ageTitle', subtitle: 'setup.ageNote' },
  height: { title: 'characterSetup.heightTitle' },
  weight: { title: 'characterSetup.weightTitle' },
  activity_level: { title: 'onboarding.activity.title', subtitle: 'setup.activitySubtitle' },
  gym_days: { title: 'characterSetup.trainingTitle' },
  target_weight: { title: 'characterSetup.targetTitle' },
  rate_selection: { title: 'characterSetup.paceTitle' },
  step_goal: { title: 'characterSetup.stepTitle' },
  water_goal: { title: 'characterSetup.waterTitle' },
  profile: { title: 'characterSetup.profileTitle' },
  plan_summary: { title: 'characterSetup.summaryTitle' },
  reveal: { title: 'characterSetup.revealTitle' },
  paywall: { title: 'characterSetup.finalTitle' },
};

const errorCopy: Record<string, TranslationKey> = {
  goal: 'characterSetup.goalRequired',
  characterGender: 'characterSetup.genderRequired',
  nickname: 'setup.nicknameRequired',
  dateOfBirth: 'characterSetup.birthError',
  height: 'characterSetup.heightError',
  weight: 'characterSetup.weightError',
  gymDays: 'setup.detailsError',
  targetWeight: 'setup.targetDirectionError',
  rate: 'setup.chooseSafePace',
  stepGoal: 'characterSetup.stepError',
  waterMlGoal: 'characterSetup.waterError',
};
const asDisplayWeight = (units: Units, kg: number) =>
  units === 'metric' || !Number.isFinite(kg) ? kg : Math.round(kgToLb(kg) * 100) / 100;

export function OnboardingQuestion({
  step,
  state,
  machine,
  update,
  identityConfirmed,
}: {
  step: OnboardingStep;
  state: OnboardingState;
  machine: OnboardingStateMachine;
  update: () => void;
  identityConfirmed: boolean;
}) {
  const { colors } = useTheme();
  const change = (edit: (draft: OnboardingStateMachine) => void) => {
    edit(machine);
    update();
  };
  const toKg = (value: number) => (state.units === 'metric' ? value : lbToKg(value));
  const imperial = state.units === 'imperial';

  useEffect(() => {
    if (step === 'age' && !state.dateOfBirth && !identityConfirmed) {
      const now = new Date();
      const year = now.getFullYear() - 25;
      const month = now.getMonth();
      const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
      change((draft) =>
        draft.setBodyStats({
          dateOfBirth: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        }),
      );
    }
  }, [step, state.dateOfBirth, identityConfirmed]);
  let input: React.ReactNode;
  switch (step) {
    case 'goal':
      input = (
        <>
          <Text variant="heading">
            {t(identityConfirmed ? 'characterSetup.character' : 'characterSetup.gender')}
          </Text>
          <SegmentedControl
            options={[
              { value: 'male', label: t('profileSetup.male') },
              { value: 'female', label: t('profileSetup.female') },
            ]}
            value={state.characterGender ?? ''}
            onChange={(value) => {
              if (value === 'male' || value === 'female')
                change((draft) => draft.setCharacterGender(value, !identityConfirmed));
            }}
            testID="onboarding-gender"
          />
          <Text variant="heading">{t('characterSetup.goal')}</Text>
          <GoalStep
            selectedGoal={state.goalSelected ? state.goal : null}
            onSelectGoal={(goal) => change((draft) => draft.setGoal(goal))}
          />
        </>
      );
      break;
    case 'nickname':
      input = (
        <PlanTextField
          label={t('profileSetup.nicknameLabel')}
          hideLabel
          value={state.nickname}
          onChangeText={(value) => change((draft) => draft.setNickname(value))}
          maxLength={60}
          autoComplete="given-name"
          testID="onboarding-nickname"
        />
      );
      break;
    case 'age': {
      const ageVal = state.dateOfBirth ? calculateAge(state.dateOfBirth) : 25;
      input = identityConfirmed ? (
        <Text tabular testID="onboarding-confirmed-age">
          {t('entryPolish.years', { value: ageVal })}
        </Text>
      ) : (
        <View style={planStyles.gap}>
          <Text
            variant="title1"
            tabular
            color={colors.textHi}
            style={{ textAlign: 'center' }}
            testID="age-display"
          >
            {t('entryPolish.years', { value: ageVal })}
          </Text>
          <StatsPicker
            label={t('entryPolish.age')}
            value={ageVal}
            min={18}
            max={90}
            format={(value) => t('entryPolish.years', { value })}
            testID="age-wheel"
            onChange={(value) => {
              const now = new Date();
              const year = now.getFullYear() - value;
              const month = now.getMonth();
              const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
              change((draft) =>
                draft.setBodyStats({
                  dateOfBirth: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
                }),
              );
            }}
          />
        </View>
      );
      break;
    }
    case 'height': {
      const height = state.heightCm > 0 ? state.heightCm : 175;
      const heightMetric = state.heightUnits === 'metric';
      const imperial = cmToFtIn(height);
      input = (
        <View style={planStyles.gap}>
          <SegmentedControl
            options={[
              { value: 'metric', label: t('repairUnits.cm') },
              { value: 'imperial', label: t('entryPolish.ftIn') },
            ]}
            value={state.heightUnits}
            onChange={(value) => change((draft) => draft.setHeightUnits(value as Units))}
            testID="height-units"
          />
          <Text
            variant="title1"
            tabular
            color={colors.textHi}
            style={{ textAlign: 'center' }}
            testID="height-display"
          >
            {heightMetric
              ? `${Math.round(height)} ${t('repairUnits.cm')}`
              : `${imperial.feet} ${t('repairUnits.ft')} ${imperial.inches} ${t('entryPolish.inch')}`}
          </Text>
          {heightMetric ? (
            <StatsPicker
              label={t('onboarding.bodyStats.heightLabel')}
              value={Math.round(height)}
              min={120}
              max={230}
              format={(value) => `${value} ${t('repairUnits.cm')}`}
              onChange={(value) => change((draft) => draft.setBodyStats({ heightCm: value }))}
              testID="height-cm-wheel"
            />
          ) : (
            <View style={planStyles.row}>
              <View style={planStyles.flex}>
                <StatsPicker
                  label={t('repairUnits.ft')}
                  value={imperial.feet}
                  min={4}
                  max={7}
                  format={(value) => `${value} ${t('repairUnits.ft')}`}
                  onChange={(value) =>
                    change((draft) =>
                      draft.setBodyStats({ heightCm: ftInToCm(value, imperial.inches) }),
                    )
                  }
                  testID="height-ft-wheel"
                />
              </View>
              <View style={planStyles.flex}>
                <StatsPicker
                  label={t('entryPolish.inch')}
                  value={imperial.inches}
                  min={0}
                  max={11}
                  format={(value) => `${value} ${t('entryPolish.inch')}`}
                  onChange={(value) =>
                    change((draft) =>
                      draft.setBodyStats({ heightCm: ftInToCm(imperial.feet, value) }),
                    )
                  }
                  testID="height-in-wheel"
                />
              </View>
            </View>
          )}
        </View>
      );
      break;
    }
    case 'weight': {
      const metric = state.units === 'metric';
      const weightVal =
        state.weightKg > 0 ? (metric ? state.weightKg : kgToLb(state.weightKg)) : metric ? 70 : 154;
      const unitLabel = t(metric ? 'entryPolish.kg' : 'entryPolish.lb');
      input = (
        <View style={planStyles.gap}>
          <SegmentedControl
            options={[
              { value: 'metric', label: t('entryPolish.kg') },
              { value: 'imperial', label: t('entryPolish.lb') },
            ]}
            value={state.units}
            onChange={(value) => change((draft) => draft.setUnits(value as Units))}
            testID="weight-units"
          />
          <Text
            variant="title1"
            tabular
            color={colors.textHi}
            style={{ textAlign: 'center' }}
            testID="weight-value"
          >
            {state.weightKg > 0
              ? `${Math.round(weightVal * 10) / 10} ${unitLabel}`
              : t('entryPolish.chooseValue')}
          </Text>
          <StatsPicker
            key={state.units}
            horizontal
            label={t('onboarding.bodyStats.weightLabel')}
            value={Math.round(weightVal * 10) / 10}
            min={metric ? 20 : 45}
            max={metric ? 500 : 1102}
            step={metric ? 0.5 : 1}
            format={(value) => `${value} ${unitLabel}`}
            onChange={(value) => change((draft) => draft.setBodyStats({ weightKg: toKg(value) }))}
            testID="weight-ruler"
          />
        </View>
      );
      break;
    }
    case 'activity_level':
      input = (
        <ActivityStep
          selectedActivityLevel={state.activityLevel}
          onSelectActivityLevel={(value) => change((draft) => draft.setActivityLevel(value))}
        />
      );
      break;
    case 'gym_days':
      input = (
        <CompactSelect
          label={t('setup.gymDays')}
          selected={[state.gymDays]}
          options={Array.from({ length: 8 }, (_, value) => ({
            value,
            label: t('setup.daysLabel', { days: value }),
          }))}
          onSelect={(value) => change((draft) => draft.setGymDays(value))}
          testID="gym-days"
        />
      );
      break;
    case 'target_weight': {
      const metric = state.units === 'metric';
      const unitLabel = t(metric ? 'entryPolish.kg' : 'entryPolish.lb');
      const baseWeight = state.weightKg > 0 ? state.weightKg : 70;
      const suggestedTargetKg =
        state.goal === 'cut'
          ? Math.max(20, Math.round(baseWeight * 0.9 * 10) / 10)
          : Math.min(500, Math.round(baseWeight * 1.05 * 10) / 10);
      const activeKg = state.targetWeightKg ?? suggestedTargetKg;
      const displayVal = asDisplayWeight(state.units, activeKg);
      input = (
        <View style={planStyles.gap}>
          <Text
            variant="title1"
            tabular
            color={colors.textHi}
            style={{ textAlign: 'center' }}
            testID="target-weight-value"
          >
            {state.targetWeightKg !== null
              ? `${Math.round(displayVal * 10) / 10} ${unitLabel}`
              : t('entryPolish.optional')}
          </Text>
          <StatsPicker
            key={state.units}
            horizontal
            label={t(imperial ? 'characterSetup.targetLb' : 'setup.targetWeight')}
            value={Math.round(displayVal * 10) / 10}
            min={metric ? 20 : 45}
            max={metric ? 500 : 1102}
            step={metric ? 0.5 : 1}
            format={(value) => `${value} ${unitLabel}`}
            onChange={(value) => change((draft) => draft.setTargetWeightAndDate(toKg(value), null))}
            testID="target-weight-ruler"
          />
          <Button
            variant="tertiary"
            label={
              state.targetWeightKg === null ? t('setup.targetWeight') : t('entryPolish.optional')
            }
            onPress={() =>
              change((draft) =>
                draft.setTargetWeightAndDate(
                  state.targetWeightKg === null ? suggestedTargetKg : null,
                  null,
                ),
              )
            }
            testID="toggle-target-weight"
          />
        </View>
      );
      break;
    }
    case 'rate_selection':
      input = (
        <>
          <View accessibilityRole="radiogroup" style={planStyles.gap}>
            {state.calculatedTargets?.presetRates.map((rate) => {
              const description = t('setup.kcalDay', { kcal: rate.targetKcal.toLocaleString() });
              const note =
                rate.rateKgPerWeek === state.calculatedTargets?.recommendedRateKg
                  ? t('setup.recommended')
                  : null;
              return (
                <PlanChoice
                  key={rate.rateKgPerWeek}
                  icon="speedometer-outline"
                  testID={`rate-card-${rate.rateKgPerWeek}`}
                  title={t('setup.rate', { rate: rate.rateKgPerWeek })}
                  description={note ? `${description} · ${note}` : description}
                  selected={state.weeklyRateKg === rate.rateKgPerWeek}
                  onPress={() => change((draft) => draft.setWeeklyRate(rate.rateKgPerWeek))}
                />
              );
            })}
          </View>
          <NumberField
            label={t('fixes.customPace')}
            value={state.weeklyRateKg}
            onChange={(value) => change((draft) => draft.setWeeklyRate(value ?? NaN))}
            testID="input-custom-pace"
          />
          <Text variant="bodyS">
            {t('characterSetup.paceLimit', { max: MAX_ONBOARDING_WEEKLY_RATE_KG })}
          </Text>
          <PlanSafetyNotice result={state.calculatedTargets} />
          {state.calculatedTargets?.safety.isBmiTooLowForCut && (
            <Button
              variant="tertiary"
              label={t('setup.changeGoal')}
              onPress={() => change((draft) => draft.goToStep('goal'))}
              testID="pace-change-goal"
            />
          )}
        </>
      );
      break;
    case 'step_goal':
      input = (
        <NumberField
          label={t('setup.stepGoal')}
          value={state.stepGoal}
          onChange={(value) => change((draft) => draft.setStepAndWaterGoals(value ?? NaN))}
          testID="input-step-goal"
        />
      );
      break;
    case 'water_goal':
      input = (
        <NumberField
          label={t('setup.waterGoal')}
          value={state.waterMlGoal}
          onChange={(value) =>
            change((draft) => draft.setStepAndWaterGoals(undefined, value ?? NaN))
          }
          testID="input-water-goal"
        />
      );
      break;
    default:
      return null;
  }
  return (
    <View style={planStyles.section} testID={`onboarding-question-${step}`}>
      {input}
      {Object.keys(state.errors).map(
        (key) =>
          errorCopy[key] && (
            <Text
              key={key}
              color={colors.danger}
              accessibilityRole="alert"
              testID={`onboarding-error-${key}`}
            >
              {t(errorCopy[key])}
            </Text>
          ),
      )}
      {state.errors.rateTooHigh && (
        <Text color={colors.danger} accessibilityRole="alert" testID="onboarding-error-rate-limit">
          {t('characterSetup.paceTooHigh', { max: MAX_ONBOARDING_WEEKLY_RATE_KG })}
        </Text>
      )}
    </View>
  );
}
