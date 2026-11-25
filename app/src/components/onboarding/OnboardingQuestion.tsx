import React, { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { calculateAge, cmToFtIn, ftInToCm, kgToLb, lbToKg, type Units } from '@calipartner/core';
import { Text, useTheme } from '@calipartner/ui';
import {
  Badge,
  BigNameField,
  Card,
  LinkButton,
  LockIcon,
  Radio,
  RulerPicker,
  ScreenTitle,
  Segmented,
  Text as V1Text,
  TrendIcon,
  borders as v1Borders,
  colors as v1Colors,
  fonts as v1Fonts,
  radius as v1Radius,
  space as v1Space,
  triggerHaptic,
} from '@calipartner/ui/v1';
import { t, type TranslationKey } from '@/i18n';
import {
  MAX_ONBOARDING_WEEKLY_RATE_KG,
  type OnboardingState,
  type OnboardingStateMachine,
  type OnboardingStep,
} from '@/services/onboardingStateMachine';
import { ActivityStep } from './ActivityStep';
import { AgeWheelPicker } from './AgeWheelPicker';
import { DailyTargetsStep } from './DailyTargetsStep';
import { GoalStep } from './GoalStep';
import { HealthSyncStep } from './HealthSyncStep';
import { TrackersStep } from './TrackersStep';
import { TrainingDaysStep } from './TrainingDaysStep';
import { planStyles } from './PlanPrimitives';
import {
  estimateWeeksToTarget,
  formatTargetEtaDate,
  formatWeightForUnits,
} from './onboardingProjection';

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
  trackers: { title: 'onboardingV1.trackTitle', subtitle: 'onboardingV1.trackSubtitle' },
  daily_targets: { title: 'onboardingV1.targetsTitle', subtitle: 'onboardingV1.targetsSubtitle' },
  health_sync: { title: 'onboardingV1.healthTitle' },
  profile: { title: 'onboardingV1.profileTitle', subtitle: 'onboardingV1.profileSubtitle' },
  plan_summary: { title: 'characterSetup.summaryTitle' },
  reveal: { title: 'characterSetup.revealTitle' },
  reminders: { title: 'onboardingV1.remindersTitle', subtitle: 'onboardingV1.remindersSubtitle' },
  auth: { title: 'onboardingV1.authCreateTitle', subtitle: 'onboardingV1.authCreateSubtitle' },
  pro_coach: { title: 'onboardingV1.proCoachTitle', subtitle: 'onboardingV1.proCoachSubtitle' },
  pro_partners: {
    title: 'onboardingV1.proPartnersTitle',
    subtitle: 'onboardingV1.proPartnersSubtitle',
  },
  pro_adaptive: {
    title: 'onboardingV1.proAdaptiveTitle',
    subtitle: 'onboardingV1.proAdaptiveSubtitle',
  },
  paywall: { title: 'onboardingV1.paywallTitle', subtitle: 'onboardingV1.paywallSubtitle' },
  all_set: { title: 'onboardingV1.allSetTitleFallback', subtitle: 'onboardingV1.allSetSubtitle' },
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
  trackers: 'onboardingV1.trackError',
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

  useEffect(() => {
    if (step !== 'age' || identityConfirmed) return;
    if (!state.dateOfBirth) {
      const now = new Date();
      const year = now.getFullYear() - 27;
      const month = now.getMonth();
      const day = Math.min(now.getDate(), new Date(year, month + 1, 0).getDate());
      change((draft) => {
        draft.setBodyStats({
          dateOfBirth: `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`,
        });
        if (!draft.getState().characterGender) {
          draft.setCharacterGender('female', true);
        }
      });
    } else if (!state.characterGender) {
      change((draft) => draft.setCharacterGender('female', true));
    }
  }, [step, state.dateOfBirth, state.characterGender, identityConfirmed]);

  useEffect(() => {
    if (step === 'rate_selection' && state.calculatedTargets) {
      const isAvailable = state.calculatedTargets.presetRates.some(
        (r) => r.rateKgPerWeek === state.weeklyRateKg && r.available,
      );
      if (!isAvailable && state.calculatedTargets.recommendedRateKg > 0) {
        change((draft) => draft.useRecommendedRate());
      }
    }
  }, [step, state.calculatedTargets, state.weeklyRateKg]);
  let input: React.ReactNode;
  switch (step) {
    case 'goal':
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.goalEyebrow')}
            title={t('onboardingV1.goalTitle')}
            accentWord={t('onboardingV1.goalAccent')}
            subtitle={t('onboardingV1.goalSubtitle')}
            testID="onboarding-title"
          />
          <GoalStep
            selectedGoal={
              state.goalSelected ? state.goal : state.goal === 'maintain' ? 'maintain' : 'cut'
            }
            onSelectGoal={(goal) => change((draft) => draft.setGoal(goal))}
          />
        </View>
      );
      break;
    case 'nickname': {
      const trimmedName = state.nickname.trim();
      const displayName = trimmedName || t('onboardingV1.previewFallbackName');
      const avatarInitial = displayName.charAt(0).toUpperCase();
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.nameEyebrow')}
            title={t('onboardingV1.nameTitle')}
            accentWord={t('onboardingV1.nameAccent')}
            subtitle={t('onboardingV1.nameSubtitle')}
            testID="onboarding-title"
          />
          <BigNameField
            value={state.nickname}
            onChangeText={(value) => change((draft) => draft.setNickname(value))}
            placeholder={t('onboardingV1.namePlaceholder')}
            maxLength={60}
            autoComplete="given-name"
            autoCapitalize="words"
            returnKeyType="done"
            error={state.errors.nickname ? t('setup.nicknameRequired') : undefined}
            testID="onboarding-nickname"
          />
          <Card variant="default" style={v1Styles.previewCard} testID="nickname-partner-preview">
            <View style={v1Styles.previewRow}>
              <View style={v1Styles.previewAvatar}>
                <V1Text maxFontSizeMultiplier={1.15} style={v1Styles.previewInitial}>
                  {avatarInitial}
                </V1Text>
              </View>
              <View style={v1Styles.previewTextCol}>
                <V1Text
                  variant="rowTitle"
                  color="textHi"
                  numberOfLines={1}
                  style={v1Styles.previewName}
                  testID="nickname-preview-name"
                >
                  {displayName}
                </V1Text>
                <V1Text variant="meta" color="textLo" numberOfLines={1}>
                  {t('onboardingV1.previewActivity')}
                </V1Text>
              </View>
            </View>
          </Card>
          <V1Text variant="meta" color="textLo" style={v1Styles.previewCaption}>
            {t('onboardingV1.previewCaption')}
          </V1Text>
        </View>
      );
      break;
    }
    case 'age': {
      const ageVal = state.dateOfBirth ? calculateAge(state.dateOfBirth) : 27;
      const selectedSex = state.characterGender ?? state.sex;
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.aboutEyebrow')}
            title={t('onboardingV1.aboutTitle')}
            accentWord={t('onboardingV1.aboutAccent')}
            subtitle={t('onboardingV1.aboutSubtitle')}
            spacingBottom={v1Space.xxl}
            testID="onboarding-title"
          />
          {identityConfirmed ? (
            <Card variant="default" testID="onboarding-confirmed-age">
              <V1Text variant="rowTitle" color="textHi" tabular>
                {t('entryPolish.years', { value: ageVal })}
              </V1Text>
            </Card>
          ) : (
            <View>
              <View
                style={v1Styles.sexRow}
                accessibilityRole="radiogroup"
                testID="onboarding-gender"
              >
                {(['female', 'male'] as const).map((sexOption) => {
                  const isSelected = selectedSex === sexOption;
                  const label =
                    sexOption === 'female'
                      ? t('onboardingV1.sexFemale')
                      : t('onboardingV1.sexMale');
                  return (
                    <Pressable
                      key={sexOption}
                      onPress={() => {
                        triggerHaptic('selection');
                        change((draft) => draft.setCharacterGender(sexOption, true));
                      }}
                      accessibilityRole="radio"
                      accessibilityState={{ selected: isSelected }}
                      accessibilityLabel={label}
                      testID={`onboarding-gender-${sexOption}`}
                      style={[
                        v1Styles.sexCard,
                        isSelected ? v1Styles.sexCardSelected : v1Styles.sexCardDefault,
                      ]}
                    >
                      <V1Text
                        style={[
                          v1Styles.sexLabel,
                          {
                            fontFamily: isSelected ? v1Fonts.bold : v1Fonts.semibold,
                            color: isSelected ? v1Colors.textHi : v1Colors.textMid,
                          },
                        ]}
                      >
                        {label}
                      </V1Text>
                    </Pressable>
                  );
                })}
              </View>

              <V1Text variant="meta" color="textLo" style={v1Styles.ageSectionLabel}>
                {t('onboardingV1.ageLabel')}
              </V1Text>

              <AgeWheelPicker
                value={ageVal}
                min={18}
                max={90}
                accessibilityLabel={t('entryPolish.years', { value: ageVal })}
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

              <V1Text variant="meta" color="textLo" style={v1Styles.ageSafetyNote}>
                {t('onboardingV1.ageSafetyNote')}
              </V1Text>
            </View>
          )}
        </View>
      );
      break;
    }
    case 'height': {
      const height = state.heightCm > 0 ? state.heightCm : 175;
      const heightMetric = state.heightUnits === 'metric';
      const totalInches = Math.max(48, Math.min(90, Math.round(height / 2.54)));
      const imperialHeight = cmToFtIn(totalInches * 2.54);
      input = (
        <View style={v1Styles.flexBody}>
          <ScreenTitle
            eyebrow={t('onboardingV1.heightEyebrow')}
            title={t('onboardingV1.heightTitle')}
            accentWord={t('onboardingV1.heightAccent')}
            subtitle={t('onboardingV1.heightSubtitle')}
            spacingBottom={v1Space.lg}
            testID="onboarding-title"
          />
          <View style={v1Styles.heightRow}>
            <View style={v1Styles.heightLeft}>
              <Segmented
                compact
                fullWidth={false}
                options={[
                  { value: 'metric', label: t('onboardingV1.unitCm') },
                  { value: 'imperial', label: t('onboardingV1.unitFt') },
                ]}
                value={state.heightUnits}
                onChange={(value) => change((draft) => draft.setHeightUnits(value))}
                testID="height-units"
              />
              <View style={v1Styles.heightReadout} testID="height-display">
                {heightMetric ? (
                  <View style={v1Styles.heroUnitRow}>
                    <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.heightHeroNum}>
                      {String(Math.round(height))}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.heroUnitLabel}>
                      {t('onboardingV1.unitCm')}
                    </V1Text>
                  </View>
                ) : (
                  <View style={v1Styles.heroUnitRow}>
                    <V1Text
                      maxFontSizeMultiplier={1.2}
                      tabular
                      style={v1Styles.heightHeroNumImperial}
                    >
                      {String(imperialHeight.feet)}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.heroUnitLabel}>
                      {t('onboardingV1.unitFt')}
                    </V1Text>
                    <V1Text
                      maxFontSizeMultiplier={1.2}
                      tabular
                      style={[v1Styles.heightHeroNumImperial, v1Styles.imperialInchesGap]}
                    >
                      {String(imperialHeight.inches)}
                    </V1Text>
                    <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.heroUnitLabel}>
                      {t('onboardingV1.unitIn')}
                    </V1Text>
                  </View>
                )}
              </View>
            </View>

            <RulerPicker
              key={state.heightUnits}
              vertical
              inverted
              align="right"
              length={340}
              breadth={108}
              step={1}
              tickGap={9}
              midStep={heightMetric ? 5 : 6}
              majorStep={heightMetric ? 10 : 12}
              min={heightMetric ? 120 : 48}
              max={heightMetric ? 230 : 90}
              value={heightMetric ? Math.round(height) : totalInches}
              unit={heightMetric ? t('onboardingV1.unitCm') : t('onboardingV1.unitIn')}
              formatLabel={heightMetric ? undefined : (inches) => `${Math.floor(inches / 12)}'`}
              onChange={(value) =>
                change((draft) =>
                  draft.setBodyStats({
                    heightCm: heightMetric
                      ? value
                      : ftInToCm(Math.floor(value / 12), Math.round(value % 12)),
                  }),
                )
              }
              testID={heightMetric ? 'height-cm-wheel' : 'height-in-wheel'}
            />
          </View>
        </View>
      );
      break;
    }
    case 'weight': {
      const metric = state.units === 'metric';
      const weightVal =
        state.weightKg > 0 ? (metric ? state.weightKg : kgToLb(state.weightKg)) : metric ? 70 : 154;
      const roundedWeight = metric ? Math.round(weightVal * 10) / 10 : Math.round(weightVal);
      const unitLabel = t(metric ? 'onboardingV1.unitKg' : 'onboardingV1.unitLb');
      input = (
        <View style={v1Styles.flexBody}>
          <ScreenTitle
            eyebrow={t('onboardingV1.weightEyebrow')}
            title={t('onboardingV1.weightTitle')}
            accentWord={t('onboardingV1.weightAccent')}
            subtitle={t('onboardingV1.weightSubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />
          <View style={v1Styles.weightBody}>
            <View style={v1Styles.weightCenterBlock}>
              <Segmented
                compact
                fullWidth={false}
                options={[
                  { value: 'metric', label: t('onboardingV1.unitKg') },
                  { value: 'imperial', label: t('onboardingV1.unitLb') },
                ]}
                value={state.units}
                onChange={(value) => change((draft) => draft.setUnits(value))}
                testID="weight-units"
              />
              <View style={v1Styles.weightReadout} testID="weight-value">
                <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.weightHeroNum}>
                  {metric ? roundedWeight.toFixed(1) : String(roundedWeight)}
                </V1Text>
                <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.heroUnitLabel}>
                  {unitLabel}
                </V1Text>
              </View>
              <RulerPicker
                key={state.units}
                min={metric ? 30 : 66}
                max={metric ? 250 : 550}
                step={metric ? 0.5 : 1}
                midStep={metric ? 1 : 5}
                majorStep={metric ? 5 : 10}
                tickGap={10}
                value={roundedWeight}
                unit={unitLabel}
                onChange={(value) =>
                  change((draft) => draft.setBodyStats({ weightKg: toKg(value) }))
                }
                testID="weight-ruler"
              />
            </View>

            <Card variant="default" style={v1Styles.privacyCard} testID="weight-privacy-card">
              <View style={v1Styles.privacyRow}>
                <View style={v1Styles.privacyIconTile}>
                  <LockIcon size={16} color={v1Colors.textMid} />
                </View>
                <View style={v1Styles.privacyTextCol}>
                  <V1Text variant="label" color="textHi" style={v1Styles.privacyTitle}>
                    {t('onboardingV1.weightPrivacyTitle')}
                  </V1Text>
                  <V1Text variant="meta" color="textLo" style={v1Styles.privacyBody}>
                    {t('onboardingV1.weightPrivacyBody')}
                  </V1Text>
                </View>
              </View>
            </Card>
          </View>
        </View>
      );
      break;
    }
    case 'activity_level':
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.activityEyebrow')}
            title={t('onboardingV1.activityTitle')}
            accentWord={t('onboardingV1.activityAccent')}
            subtitle={t('onboardingV1.activitySubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />
          <ActivityStep
            selectedActivityLevel={state.activityLevel}
            onSelectActivityLevel={(value) => change((draft) => draft.setActivityLevel(value))}
          />
        </View>
      );
      break;
    case 'gym_days':
      input = (
        <View style={v1Styles.flexBody}>
          <ScreenTitle
            eyebrow={t('onboardingV1.trainingEyebrow')}
            title={t('onboardingV1.trainingTitle')}
            accentWord={t('onboardingV1.trainingAccent')}
            subtitle={t('onboardingV1.trainingSubtitle')}
            spacingBottom={v1Space.lg}
            testID="onboarding-title"
          />
          <TrainingDaysStep
            gymDays={state.gymDays}
            trainingDays={state.trainingDays}
            onSelectCount={(value) => change((draft) => draft.setGymDays(value))}
            onToggleWeekday={(dayIndex) => change((draft) => draft.toggleTrainingDay(dayIndex))}
          />
        </View>
      );
      break;
    case 'target_weight': {
      const metric = state.units === 'metric';
      const unitLabel = t(metric ? 'onboardingV1.unitKg' : 'onboardingV1.unitLb');
      const baseWeight = state.weightKg > 0 ? state.weightKg : 70;
      const suggestedTargetKg =
        state.goal === 'cut'
          ? Math.max(30, Math.round(baseWeight * 0.9 * 2) / 2)
          : Math.min(250, Math.round(baseWeight * 1.07 * 2) / 2);
      const activeKg = state.targetWeightKg ?? suggestedTargetKg;
      const displayVal = asDisplayWeight(state.units, activeKg);
      const roundedVal = metric ? Math.round(displayVal * 10) / 10 : Math.round(displayVal);
      const currentDisplay = asDisplayWeight(state.units, baseWeight);
      const diffDisplay = Math.abs(Math.round((currentDisplay - roundedVal) * 10) / 10);
      const matchesDirection =
        (state.goal === 'cut' && activeKg < baseWeight) ||
        (state.goal === 'bulk' && activeKg > baseWeight);
      const estimatedWeeks = estimateWeeksToTarget(baseWeight, activeKg, state.weeklyRateKg);

      input = (
        <View style={v1Styles.flexBody}>
          <ScreenTitle
            eyebrow={t('onboardingV1.targetEyebrow')}
            title={t('onboardingV1.targetTitle')}
            accentWord={t('onboardingV1.targetAccent')}
            subtitle={t('onboardingV1.targetSubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />
          <View style={v1Styles.weightBody}>
            <View style={v1Styles.weightCenterBlock}>
              <Segmented
                compact
                fullWidth={false}
                options={[
                  { value: 'metric', label: t('onboardingV1.unitKg') },
                  { value: 'imperial', label: t('onboardingV1.unitLb') },
                ]}
                value={state.units}
                onChange={(value) => change((draft) => draft.setUnits(value))}
                testID="target-weight-units"
              />
              <View style={v1Styles.weightReadout} testID="target-weight-value">
                <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.weightHeroNum}>
                  {metric ? roundedVal.toFixed(1) : String(roundedVal)}
                </V1Text>
                <V1Text maxFontSizeMultiplier={1.2} style={v1Styles.heroUnitLabel}>
                  {unitLabel}
                </V1Text>
              </View>
              <RulerPicker
                key={state.units}
                min={metric ? 30 : 66}
                max={metric ? 250 : 550}
                step={metric ? 0.5 : 1}
                midStep={metric ? 1 : 5}
                majorStep={metric ? 5 : 10}
                tickGap={10}
                value={roundedVal}
                unit={unitLabel}
                onChange={(value) =>
                  change((draft) => draft.setTargetWeightAndDate(toKg(value), null))
                }
                testID="target-weight-ruler"
              />
            </View>

            <Card
              variant="default"
              style={v1Styles.privacyCard}
              testID="target-weight-summary-card"
            >
              <View style={v1Styles.privacyRow}>
                <View style={v1Styles.privacyIconTile}>
                  <TrendIcon size={18} color={v1Colors.textMid} />
                </View>
                <View style={v1Styles.privacyTextCol}>
                  {matchesDirection && estimatedWeeks ? (
                    <>
                      <V1Text variant="label" color="textHi" style={v1Styles.privacyTitle} tabular>
                        {t('onboardingV1.targetToGo', {
                          amount: metric ? diffDisplay.toFixed(1) : String(Math.round(diffDisplay)),
                          unit: unitLabel,
                        })}
                      </V1Text>
                      <V1Text variant="meta" color="textLo" style={v1Styles.privacyBody}>
                        {t('onboardingV1.targetWeeksSteady', { weeks: estimatedWeeks })}
                      </V1Text>
                    </>
                  ) : (
                    <V1Text variant="meta" color="textLo" style={v1Styles.privacyBody}>
                      {t('onboardingV1.targetDirectionHint')}
                    </V1Text>
                  )}
                </View>
              </View>
            </Card>
          </View>
        </View>
      );
      break;
    }
    case 'rate_selection': {
      const targets = state.calculatedTargets;
      const recommended = targets?.recommendedRateKg;
      const metric = state.units === 'metric';
      const unitLabel = t(metric ? 'onboardingV1.unitKg' : 'onboardingV1.unitLb');
      const directionSign = state.goal === 'cut' ? '-' : state.goal === 'bulk' ? '+' : '';
      const weeks = estimateWeeksToTarget(state.weightKg, state.targetWeightKg, state.weeklyRateKg);
      const etaDate = weeks ? formatTargetEtaDate(weeks) : null;
      const rateOptions = (targets?.presetRates ?? []).slice(0, 3);

      const paceLabel = (rateKg: number): string => {
        if (rateKg <= 0.3) return t('onboardingV1.paceGentle');
        if (rateKg <= 0.6) return t('onboardingV1.paceSteady');
        return t('onboardingV1.paceFast');
      };

      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.paceEyebrow')}
            title={t('onboardingV1.paceTitle')}
            accentWord={t('onboardingV1.paceAccent')}
            subtitle={t('onboardingV1.paceSubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />

          <View accessibilityRole="radiogroup" style={v1Styles.paceList}>
            {rateOptions.map((rate) => {
              const isSelected = state.weeklyRateKg === rate.rateKgPerWeek;
              const isRecommended = rate.rateKgPerWeek === recommended;
              const isAvailable = rate.available;
              const rateAmount = metric
                ? `${directionSign}${rate.rateKgPerWeek}`
                : `${directionSign}${rate.rateLbPerWeek}`;
              const reasonText = !isAvailable
                ? rate.reason === 'below_calorie_floor'
                  ? t('setup.floorReason', { floor: targets?.safety.calorieFloor ?? 1200 })
                  : rate.reason === 'macro_allocation'
                    ? t('setup.macroReason')
                    : t('setup.capReason')
                : null;

              return (
                <Pressable
                  key={rate.rateKgPerWeek}
                  disabled={!isAvailable}
                  onPress={() => {
                    if (!isAvailable) return;
                    triggerHaptic('selection');
                    change((draft) => draft.setWeeklyRate(rate.rateKgPerWeek));
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: isSelected, disabled: !isAvailable }}
                  testID={`rate-card-${rate.rateKgPerWeek}`}
                  style={[
                    v1Styles.paceCard,
                    isSelected ? v1Styles.paceCardSelected : v1Styles.paceCardDefault,
                    !isAvailable && v1Styles.paceCardDisabled,
                  ]}
                >
                  <View style={v1Styles.paceLeft}>
                    <Radio selected={isSelected} disabled={!isAvailable} />
                    <View style={v1Styles.paceTitleCol}>
                      <View style={v1Styles.paceTitleRow}>
                        <V1Text variant="rowTitle" color="textHi">
                          {paceLabel(rate.rateKgPerWeek)}
                        </V1Text>
                        {isRecommended ? (
                          <Badge label={t('onboardingV1.paceRecommended')} mini />
                        ) : null}
                      </View>
                      <V1Text variant="meta" color="textLo" tabular>
                        {reasonText ??
                          t('onboardingV1.pacePerWeek', { delta: rateAmount, unit: unitLabel })}
                      </V1Text>
                    </View>
                  </View>

                  <View style={v1Styles.paceRight}>
                    <V1Text maxFontSizeMultiplier={1.2} tabular style={v1Styles.paceKcal}>
                      {rate.targetKcal.toLocaleString('en-US')}
                    </V1Text>
                    <V1Text variant="micro" color="textLo">
                      {t('onboardingV1.kcalUnitLine')}
                    </V1Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          {state.targetWeightKg !== null && etaDate ? (
            <Card variant="default" style={v1Styles.paceBanner} testID="pace-projection-banner">
              <V1Text variant="meta" color="textMid" style={v1Styles.paceBannerText}>
                {t('onboardingV1.paceEtaBanner', {
                  target: `${formatWeightForUnits(state.targetWeightKg, state.units)} ${unitLabel}`,
                  date: etaDate,
                })}
              </V1Text>
            </Card>
          ) : null}

          {targets?.safety.isBmiTooLowForCut && (
            <View style={v1Styles.paceFallbackAction}>
              <LinkButton
                title={t('setup.changeGoal')}
                variant="accent"
                onPress={() => change((draft) => draft.goToStep('goal'))}
                testID="pace-change-goal"
              />
            </View>
          )}
        </View>
      );
      break;
    }
    case 'trackers':
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.trackEyebrow')}
            title={t('onboardingV1.trackTitle')}
            accentWord={t('onboardingV1.trackAccent')}
            subtitle={t('onboardingV1.trackSubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />
          <TrackersStep
            enabledTrackers={state.enabledTrackers}
            onToggleTracker={(key) => change((draft) => draft.toggleTracker(key))}
          />
        </View>
      );
      break;
    case 'daily_targets':
      input = (
        <View>
          <ScreenTitle
            eyebrow={t('onboardingV1.targetsEyebrow')}
            title={t('onboardingV1.targetsTitle')}
            accentWord={t('onboardingV1.targetsAccent')}
            subtitle={t('onboardingV1.targetsSubtitle')}
            spacingBottom={v1Space.xl}
            testID="onboarding-title"
          />
          <DailyTargetsStep
            stepGoal={state.stepGoal}
            waterMlGoal={state.waterMlGoal}
            onChangeSteps={(value) => change((draft) => draft.setStepAndWaterGoals(value))}
            onChangeWater={(value) =>
              change((draft) => draft.setStepAndWaterGoals(undefined, value))
            }
          />
        </View>
      );
      break;
    case 'health_sync':
      input = (
        <HealthSyncStep
          options={state.healthSyncOptions}
          onChangeOption={(key, value) => change((draft) => draft.setHealthSyncOption(key, value))}
        />
      );
      break;
    default:
      return null;
  }
  const isFlexV1Step =
    step === 'height' || step === 'weight' || step === 'gym_days' || step === 'target_weight';
  return (
    <View
      style={isFlexV1Step ? v1Styles.flexRoot : planStyles.section}
      testID={`onboarding-question-${step}`}
    >
      {input}
      {Object.keys(state.errors).map(
        (key) =>
          errorCopy[key] &&
          !(step === 'nickname' && key === 'nickname') && (
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

const v1Styles = StyleSheet.create({
  flexRoot: {
    flex: 1,
  },
  flexBody: {
    flex: 1,
  },
  previewCard: {
    marginTop: v1Space.xxl,
    padding: v1Space.lg,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.md,
  },
  previewAvatar: {
    width: 44,
    height: 44,
    borderRadius: v1Radius.full,
    backgroundColor: v1Colors.apricot,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewInitial: {
    fontFamily: v1Fonts.extrabold,
    fontSize: 16,
    lineHeight: 20,
    color: v1Colors.onBrand,
  },
  previewTextCol: {
    flex: 1,
    gap: 2,
  },
  previewName: {
    fontSize: 15,
    lineHeight: 20,
  },
  previewCaption: {
    marginTop: v1Space.optical10,
  },
  sexRow: {
    flexDirection: 'row',
    gap: v1Space.md,
  },
  sexCard: {
    flex: 1,
    height: 54,
    borderRadius: v1Radius.chip,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sexCardDefault: {
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
  },
  sexCardSelected: {
    backgroundColor: v1Colors.s2,
    borderWidth: v1Borders.selectedWidth,
    borderColor: v1Colors.apricot,
  },
  sexLabel: {
    fontSize: 15,
    lineHeight: 20,
  },
  ageSectionLabel: {
    marginTop: v1Space.xxl,
    marginBottom: v1Space.md,
  },
  ageSafetyNote: {
    marginTop: v1Space.md,
    textAlign: 'center',
  },
  heightRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  heightLeft: {
    flex: 1,
    justifyContent: 'center',
    paddingRight: v1Space.md,
  },
  heightReadout: {
    marginTop: v1Space.xxl,
  },
  heroUnitRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  heightHeroNum: {
    fontFamily: v1Fonts.display,
    fontSize: 72,
    lineHeight: 76,
    letterSpacing: -2.2,
    color: v1Colors.textHi,
  },
  heightHeroNumImperial: {
    fontFamily: v1Fonts.display,
    fontSize: 52,
    lineHeight: 58,
    letterSpacing: -1.6,
    color: v1Colors.textHi,
  },
  imperialInchesGap: {
    marginLeft: v1Space.sm,
  },
  heroUnitLabel: {
    fontFamily: v1Fonts.medium,
    fontSize: 18,
    lineHeight: 22,
    color: v1Colors.textLo,
    marginLeft: v1Space.xs + 2,
  },
  weightBody: {
    flex: 1,
    justifyContent: 'space-between',
    paddingBottom: v1Space.sm,
  },
  weightCenterBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightReadout: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: v1Space.xl,
    marginBottom: v1Space.xl,
  },
  weightHeroNum: {
    fontFamily: v1Fonts.display,
    fontSize: 78,
    lineHeight: 82,
    letterSpacing: -2.4,
    color: v1Colors.textHi,
  },
  privacyCard: {
    paddingVertical: v1Space.optical14,
    paddingHorizontal: v1Space.lg,
  },
  privacyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.optical14,
  },
  privacyIconTile: {
    width: 40,
    height: 40,
    borderRadius: v1Radius.control,
    backgroundColor: v1Colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  privacyTextCol: {
    flex: 1,
    gap: 2,
  },
  privacyTitle: {
    fontSize: 14,
    lineHeight: 18,
  },
  privacyBody: {
    fontSize: 12,
    lineHeight: 16,
  },
  paceList: {
    gap: v1Space.md,
  },
  paceCard: {
    borderRadius: v1Radius.optionCard,
    padding: v1Space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: v1Space.md,
  },
  paceCardDefault: {
    backgroundColor: v1Colors.s1,
    borderWidth: v1Borders.width,
    borderColor: v1Colors.hairline,
  },
  paceCardSelected: {
    backgroundColor: v1Colors.s2,
    borderWidth: v1Borders.selectedWidth,
    borderColor: v1Colors.apricot,
  },
  paceCardDisabled: {
    opacity: 0.45,
  },
  paceLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.md,
  },
  paceTitleCol: {
    flex: 1,
    gap: 2,
  },
  paceTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: v1Space.sm,
    flexWrap: 'wrap',
  },
  paceRight: {
    alignItems: 'flex-end',
  },
  paceKcal: {
    fontFamily: v1Fonts.display,
    fontSize: 22,
    lineHeight: 26,
    letterSpacing: -0.5,
    color: v1Colors.textHi,
  },
  paceBanner: {
    marginTop: v1Space.lg,
    paddingVertical: v1Space.md,
    paddingHorizontal: v1Space.lg,
  },
  paceBannerText: {
    lineHeight: 19,
  },
  paceFallbackAction: {
    marginTop: v1Space.md,
    alignItems: 'flex-start',
  },
});
