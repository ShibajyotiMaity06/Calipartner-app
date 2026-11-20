import React from 'react';
import { View } from 'react-native';
import { calculateAge, kgToLb, lbToKg, type Units } from '@calipartner/core';
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
    case 'age':
      input = identityConfirmed ? (
        <Text tabular testID="onboarding-confirmed-age">
          {t('entryPolish.years', { value: calculateAge(state.dateOfBirth) })}
        </Text>
      ) : (
        <InteractiveDobPicker
          value={state.dateOfBirth}
          onChange={(value) => change((draft) => draft.setBodyStats({ dateOfBirth: value }))}
        />
      );
      break;
    case 'height':
      input = (
        <HeightField
          value={state.heightCm > 0 ? state.heightCm : NaN}
          units={state.heightUnits}
          onChangeUnits={(value) => change((draft) => draft.setHeightUnits(value))}
          onChange={(value) => change((draft) => draft.setBodyStats({ heightCm: value }))}
        />
      );
      break;
    case 'weight':
      input = (
        <>
          <SegmentedControl
            options={[
              { value: 'metric', label: t('entryPolish.kg') },
              { value: 'imperial', label: t('entryPolish.lb') },
            ]}
            value={state.units}
            onChange={(value) => change((draft) => draft.setUnits(value as Units))}
            testID="weight-units"
          />
          <NumberField
            key={state.units}
            label={t(imperial ? 'characterSetup.weightLb' : 'setup.weight')}
            value={asDisplayWeight(state.units, state.weightKg > 0 ? state.weightKg : NaN)}
            onChange={(value) =>
              change((draft) => draft.setBodyStats({ weightKg: toKg(value ?? NaN) }))
            }
            testID="input-weight"
          />
        </>
      );
      break;
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
    case 'target_weight':
      input = (
        <NumberField
          optional
          label={t(imperial ? 'characterSetup.targetLb' : 'setup.targetWeight')}
          value={
            state.targetWeightKg === null
              ? null
              : asDisplayWeight(state.units, state.targetWeightKg)
          }
          onChange={(value) =>
            change((draft) =>
              draft.setTargetWeightAndDate(value === null ? null : toKg(value), null),
            )
          }
          testID="input-target-weight"
        />
      );
      break;
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
