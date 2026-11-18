import { useTheme as useAppearance } from '@calipartner/ui/theme';
import { CompactSelect, type CompactSelectOption } from '@/components/CompactSelect';
import React, { useCallback, useState, type ComponentProps } from 'react';
import { BackHandler, Platform, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { Button, homeLayout, radius, space, Text, type as typography } from '@calipartner/ui';
import {
  WORKOUT_SPLITS,
  equipmentForLocation,
  WORKOUT_SPLIT_DAYS,
  defaultWorkoutDays,
  WEEK_DAYS,
  validatePlanPreferences,
  validateWorkoutPreferences,
  type PlanPreferences,
} from '@calipartner/core';
import { t, type TranslationKey } from '@/i18n';
import { useSquadStyles } from '@/components/rooms/SquadViews';

export const initialPlanPreferences: PlanPreferences = {
  workout_days: [0, 2, 4],
  location: 'home',
  equipment: ['bodyweight'],
  experience: 'beginner',
  session_minutes: 30,
  limitations: '',
  country: '',
  cuisine: '',
  diet: 'mixed',
  allergies: [],
  exclusions: [],
  meals_per_day: 3,
  cooking_minutes: 30,
  budget: 'economical',
};

const OPTION_ICONS: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  home: 'home-outline',
  basic: 'barbell-outline',
  advanced: 'fitness-outline',
  bodyweight: 'body-outline',
  dumbbell: 'barbell-outline',
  barbell: 'barbell-outline',
  kettlebell: 'cube-outline',
  cable: 'git-branch-outline',
  band: 'radio-button-off-outline',
  machine: 'hardware-chip-outline',
  bench: 'layers-outline',
  pullup_bar: 'reorder-three-outline',
  legpress: 'barbell-outline',
  beginner: 'leaf-outline',
  intermediate: 'trending-up-outline',
  experienced: 'trophy-outline',
  mixed: 'restaurant-outline',
  vegetarian: 'nutrition-outline',
  vegan: 'leaf-outline',
  keto: 'flame-outline',
  pescatarian: 'fish-outline',
  economical: 'wallet-outline',
  moderate: 'cash-outline',
  premium: 'diamond-outline',
};

function Choice<T extends string | number>({
  label,
  values,
  selected,
  onSelect,
  id,
  multiple = true,
  icon,
}: {
  label: string;
  values: CompactSelectOption<T>[];
  selected: T[];
  onSelect: (value: T) => void;
  id: string;
  multiple?: boolean;
  icon?: ComponentProps<typeof Ionicons>['name'];
}) {
  return (
    <CompactSelect
      label={label}
      icon={icon}
      options={values}
      selected={selected}
      onSelect={onSelect}
      testID={id}
      multiple={multiple}
    />
  );
}
export function PlanField({
  label,
  value,
  onChange,
  id,
  numeric = false,
  hint,
  optional = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  numeric?: boolean;
  hint?: string;
  optional?: boolean;
}) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  return (
    <View style={styles.stack}>
      <Text variant="label">
        {label}
        {optional ? (
          <Text variant="label" color={dark.textLo}>
            {' '}
            {t('releaseUpdate.optional')}
          </Text>
        ) : null}
      </Text>
      {hint && <Text variant="bodyS">{hint}</Text>}
      <TextInput
        accessibilityLabel={label}
        value={value}
        onChangeText={onChange}
        keyboardType={numeric ? 'number-pad' : 'default'}
        maxLength={numeric ? 3 : 500}
        style={{
          ...typography.body,
          minHeight: homeLayout.touchSize,
          color: dark.textHi,
          backgroundColor: dark.s1,
          borderRadius: radius.control,
          borderColor: dark.hairline,
          borderWidth: 1,
          padding: space[3],
        }}
        testID={id}
      />
    </View>
  );
}
export function WeeklyPlanForm({
  singleDay = false,
  workoutOnly = false,
  initial,
  onBuild,
  onLater,
}: {
  singleDay?: boolean;
  workoutOnly?: boolean;
  initial?: PlanPreferences;
  onBuild: (preferences: PlanPreferences) => void;
  onLater: () => void;
}) {
  const styles = useSquadStyles();

  const { colors: dark } = useAppearance();

  const [preferences, setPreferences] = useState(() => {
    const value = initial ?? initialPlanPreferences;
    return {
      ...value,
      session_minutes: [30, 60, 90, 120].includes(value.session_minutes)
        ? value.session_minutes
        : 30,
    };
  });
  const splitDays = preferences.workout_split
    ? (WORKOUT_SPLIT_DAYS[preferences.workout_split] ?? [])
    : [];
  const splitValid =
    !!preferences.workout_split && splitDays.includes(preferences.workout_days.length);
  const [step, setStep] = useState<'workout' | 'food'>('workout'),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(false);
  const [allergies, setAllergies] = useState(
    [...new Set([...(initial?.allergies ?? []), ...(initial?.exclusions ?? [])])].join(', '),
  );
  useBrowserModalBack(step === 'food', () => setStep('workout'));
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android' || step !== 'food') return;
      const listener = BackHandler.addEventListener('hardwareBackPress', () => {
        setStep('workout');
        return true;
      });
      return () => listener.remove();
    }, [step]),
  );
  const update = <K extends keyof PlanPreferences>(key: K, value: PlanPreferences[K]) => {
    setPreferences((p) => ({ ...p, [key]: value }));
    setError(false);
  };
  const label = (value: string) => t(`fixNovember.${value}` as TranslationKey);
  const field = (
    key: 'session_minutes' | 'limitations' | 'country' | 'cuisine' | 'cooking_minutes',
    numeric = false,
    hint?: string,
  ) => (
    <PlanField
      label={label(
        ({ session_minutes: 'minutes', cooking_minutes: 'cooking' } as Record<string, string>)[
          key
        ] ?? key,
      )}
      value={String(preferences[key])}
      onChange={(value) => update(key, (numeric ? Number(value) : value) as never)}
      id={`plan-${key}`}
      numeric={numeric}
      hint={hint}
    />
  );
  const choose = <K extends 'location' | 'experience' | 'diet' | 'budget'>(
    key: K,
    values: PlanPreferences[K][],
  ) => (
    <Choice
      multiple={false}
      label={label(key)}
      icon={
        key === 'location'
          ? 'location-outline'
          : key === 'experience'
            ? 'trophy-outline'
            : key === 'diet'
              ? 'restaurant-outline'
              : 'wallet-outline'
      }
      values={values.map((value) => ({
        value,
        label: label(value),
        icon: OPTION_ICONS[value],
      }))}
      selected={[preferences[key]]}
      id={`plan-${key}`}
      onSelect={(value) => {
        update(key, value);
      }}
    />
  );
  const build = () => {
    const list = (value: string) =>
      value
        .split(',')
        .map((v) => v.trim())
        .filter((v) => v && !/^none$/i.test(v));
    try {
      if (!consent || (workoutOnly && !splitValid)) throw new Error('INVALID_PLAN');
      onBuild(
        (workoutOnly ? validateWorkoutPreferences : validatePlanPreferences)({
          ...preferences,
          ...(singleDay ? { meals_per_day: 4 } : {}),
          allergies: list(allergies),
          exclusions: [],
          equipment: equipmentForLocation(preferences.location),
        }),
      );
    } catch {
      setError(true);
    }
  };
  return (
    <View style={styles.stack} testID="weekly-plan-form">
      <Text variant="title1">
        {t(
          workoutOnly
            ? 'workoutFlow.buildTitle'
            : singleDay
              ? 'personalDay.title'
              : 'fixNovember.planTitle',
        )}
      </Text>
      <Text>
        {t(
          workoutOnly
            ? 'workoutFlow.buildHint'
            : singleDay
              ? 'personalDay.subtitle'
              : 'fixNovember.planSubtitle',
        )}
      </Text>
      <Text variant="title2">
        {t(step === 'workout' ? 'fixNovember.workoutTitle' : 'fixNovember.dietTitle')}
      </Text>
      {step === 'workout' ? (
        <>
          {
            <>
              <Choice
                label={t('workoutFlow.daysPerWeek')}
                icon="calendar-outline"
                multiple={false}
                values={[2, 3, 4, 5, 6].map((value) => ({
                  value,
                  label: t('workoutFlow.dayCount', { count: value }),
                }))}
                selected={[preferences.workout_days.length]}
                onSelect={(count) => update('workout_days', defaultWorkoutDays(count))}
                id="plan-day-count"
              />
              <Choice
                label={t('workoutFlow.split')}
                icon="barbell-outline"
                multiple={false}
                values={WORKOUT_SPLITS.map((value) => ({
                  value,
                  label: t(`workoutFlow.splits.${value}`),
                  description: t(`workoutFlow.splitDescriptions.${value}`),
                }))}
                selected={preferences.workout_split ? [preferences.workout_split] : []}
                onSelect={(value) => update('workout_split', value)}
                id="plan-split"
              />
              {preferences.workout_split && (
                <Text variant="bodyS" testID="plan-split-description">
                  {t(`workoutFlow.splitDescriptions.${preferences.workout_split}`)}
                </Text>
              )}
              {preferences.workout_split && !splitValid && (
                <Text accessibilityRole="alert" testID="plan-split-days-error">
                  {t('workoutFlow.splitDays', { days: splitDays.join(' / ') })}
                </Text>
              )}
            </>
          }
          <Choice
            label={t('fixNovember.trainingDays')}
            icon="calendar-outline"
            values={WEEK_DAYS.map((day, value) => ({
              value,
              label: label(day),
              icon: 'calendar-outline',
            }))}
            selected={preferences.workout_days}
            id="plan-day"
            onSelect={(day) => {
              const days = preferences.workout_days.includes(day)
                ? preferences.workout_days.filter((d) => d !== day)
                : [...preferences.workout_days, day];
              update('workout_days', days);
            }}
          />
          <Text variant="bodyS">{t('fixNovember.trainingDaysHint')}</Text>
          {choose('location', ['home', 'basic', 'advanced'])}
          {choose('experience', ['beginner', 'intermediate', 'experienced'])}
          <View style={styles.stack}>
            <Text variant="label">{t('fixNovember.minutes')}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
              {[30, 60, 90, 120].map((minutes) => (
                <Button
                  key={minutes}
                  variant="secondary"
                  fullWidth={false}
                  label={t('entryPolish.durationMinutes', { minutes })}
                  icon={
                    preferences.session_minutes === minutes ? (
                      <Ionicons
                        name="checkmark"
                        size={homeLayout.editIconSize}
                        color={dark.textHi}
                      />
                    ) : undefined
                  }
                  accessibilityRole="radio"
                  accessibilityState={{ checked: preferences.session_minutes === minutes }}
                  style={{
                    backgroundColor: preferences.session_minutes === minutes ? dark.s3 : dark.s1,
                  }}
                  onPress={() => update('session_minutes', minutes)}
                  testID={`plan-minutes-${minutes}`}
                />
              ))}
            </View>
          </View>
          <PlanField
            label={t('releaseUpdate.avoid')}
            optional
            value={preferences.workout_notes ?? ''}
            onChange={(value) => update('workout_notes', value)}
            id="plan-workout-notes"
          />
          {!workoutOnly && (
            <Button
              label={t('fixNovember.next')}
              onPress={() => {
                if (
                  (Boolean(preferences.workout_split) && !splitValid) ||
                  preferences.workout_days.length < 1 ||
                  preferences.workout_days.length > 6 ||
                  !preferences.equipment.length ||
                  preferences.session_minutes < 15 ||
                  preferences.session_minutes > 120
                )
                  setError(true);
                else setStep('food');
              }}
              testID="weekly-plan-next"
            />
          )}
        </>
      ) : (
        <>
          {field('country')}
          {field('cuisine')}
          {choose('diet', ['mixed', 'vegetarian', 'vegan', 'pescatarian'])}
          <PlanField
            label={t('fixNovember.allergies')}
            value={allergies}
            onChange={setAllergies}
            optional
            id="plan-allergies"
          />
          {!singleDay && (
            <Choice
              multiple={false}
              label={t('fixNovember.meals')}
              icon="restaurant-outline"
              values={[3, 4, 5].map((value) => ({
                value,
                label: String(value),
                icon: 'restaurant-outline',
              }))}
              selected={[preferences.meals_per_day]}
              onSelect={(value) => update('meals_per_day', value)}
              id="plan-meals"
            />
          )}
          {field('cooking_minutes', true)}
          {choose('budget', ['economical', 'flexible'])}
          <Pressable
            style={styles.selector}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((value) => !value)}
            testID="weekly-plan-consent"
          >
            <Text>
              {consent ? '☑ ' : '☐ '}
              {t('fixNovember.consent')}
            </Text>
          </Pressable>
          <Text variant="bodyS">{t('fixNovember.consentHint')}</Text>
          <Button
            label={t(singleDay ? 'personalDay.build' : 'fixNovember.build')}
            onPress={build}
            disabled={!consent}
            testID="build-weekly-plan"
          />
          <Button
            variant="secondary"
            label={t('fixNovember.previous')}
            onPress={() => setStep('workout')}
            testID="weekly-plan-form-back"
          />
        </>
      )}
      {workoutOnly && (
        <>
          <Pressable
            style={styles.selector}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: consent }}
            onPress={() => setConsent((value) => !value)}
            testID="weekly-plan-consent"
          >
            <Text>{t('fixNovember.consent')}</Text>
            <Text>{consent ? '\u2713' : ''}</Text>
          </Pressable>
          <Text variant="bodyS">{t('fixNovember.consentHint')}</Text>
          <Button
            label={t('workoutFlow.build')}
            onPress={build}
            disabled={!consent || !splitValid}
            testID="build-weekly-plan"
          />
        </>
      )}
      {error && (
        <Text accessibilityRole="alert" color={dark.danger}>
          {t('fixNovember.invalidPreferences')}
        </Text>
      )}
      <Button
        variant="tertiary"
        label={t('fixNovember.later')}
        onPress={onLater}
        testID="skip-weekly-plan"
      />
    </View>
  );
}
