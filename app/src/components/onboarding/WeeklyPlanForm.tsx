import React, { useCallback, useState } from 'react';
import { BackHandler, Platform, Pressable, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { Button, dark, homeLayout, radius, space, Text, type as typography } from '@calipartner/ui';
import {
  PLAN_EQUIPMENT,
  WEEK_DAYS,
  validatePlanPreferences,
  type PlanPreferences,
} from '@calipartner/core';
import { t, type TranslationKey } from '@/i18n';
import { squadStyles as styles } from '@/components/rooms/SquadViews';

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
function Choice<T extends string | number>({
  label,
  values,
  selected,
  onSelect,
  id,
}: {
  label: string;
  values: { value: T; label: string }[];
  selected: T[];
  onSelect: (value: T) => void;
  id: string;
}) {
  return (
    <View style={styles.stack}>
      <Text variant="label">{label}</Text>
      <View style={styles.row}>
        {values.map((option) => (
          <Pressable
            key={option.value}
            style={({ pressed }) => [
              {
                minHeight: homeLayout.touchSize,
                padding: space[3],
                borderRadius: radius.control,
                borderWidth: 1,
                borderColor: selected.includes(option.value) ? dark.copper : dark.hairline,
                backgroundColor: pressed ? dark.s3 : dark.s1,
              },
            ]}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: selected.includes(option.value) }}
            accessibilityLabel={option.label}
            onPress={() => onSelect(option.value)}
            testID={`${id}-${option.value}`}
          >
            <Text>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
export function PlanField({
  label,
  value,
  onChange,
  id,
  numeric = false,
  hint,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  id: string;
  numeric?: boolean;
  hint?: string;
}) {
  return (
    <View style={styles.stack}>
      <Text variant="label">{label}</Text>
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
  initial,
  onBuild,
  onLater,
}: {
  singleDay?: boolean;
  initial?: PlanPreferences;
  onBuild: (preferences: PlanPreferences) => void;
  onLater: () => void;
}) {
  const [preferences, setPreferences] = useState(initial ?? initialPlanPreferences);
  const [step, setStep] = useState<'workout' | 'food'>('workout'),
    [consent, setConsent] = useState(false),
    [error, setError] = useState(false);
  const [allergies, setAllergies] = useState(initial ? initial.allergies.join(', ') || 'none' : ''),
    [exclusions, setExclusions] = useState(initial ? initial.exclusions.join(', ') || 'none' : '');
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
      label={label(key)}
      values={values.map((value) => ({ value, label: label(value) }))}
      selected={[preferences[key]]}
      id={`plan-${key}`}
      onSelect={(value) => {
        update(key, value);
        if (key === 'location' && value !== 'advanced')
          setPreferences((p) => ({
            ...p,
            equipment: p.equipment.filter((e) => !['cable', 'legpress'].includes(e)),
          }));
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
      if (!consent || !allergies.trim() || !exclusions.trim()) throw new Error('INVALID_PLAN');
      onBuild(
        validatePlanPreferences({
          ...preferences,
          allergies: list(allergies),
          exclusions: list(exclusions),
        }),
      );
    } catch {
      setError(true);
    }
  };
  return (
    <View style={styles.stack} testID="weekly-plan-form">
      <Text variant="title1">{t(singleDay ? 'personalDay.title' : 'fixNovember.planTitle')}</Text>
      <Text>{t(singleDay ? 'personalDay.subtitle' : 'fixNovember.planSubtitle')}</Text>
      <Text variant="title2">
        {t(step === 'workout' ? 'fixNovember.workoutTitle' : 'fixNovember.dietTitle')}
      </Text>
      {step === 'workout' ? (
        <>
          <Choice
            label={t('fixNovember.trainingDays')}
            values={WEEK_DAYS.map((day, value) => ({ value, label: label(day) }))}
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
          <Choice
            label={t('fixNovember.equipment')}
            values={PLAN_EQUIPMENT.filter(
              (e) => preferences.location === 'advanced' || !['cable', 'legpress'].includes(e),
            ).map((value) => ({ value, label: label(value) }))}
            selected={preferences.equipment}
            id="plan-equipment"
            onSelect={(value) =>
              update(
                'equipment',
                preferences.equipment.includes(value)
                  ? preferences.equipment.filter((e) => e !== value)
                  : [...preferences.equipment, value],
              )
            }
          />
          {choose('experience', ['beginner', 'intermediate', 'experienced'])}
          {field('session_minutes', true)}
          {field('limitations', false, t('fixNovember.limitationsHint'))}
          <Button
            label={t('fixNovember.next')}
            onPress={() => {
              if (
                preferences.workout_days.length < 1 ||
                preferences.workout_days.length > 6 ||
                !preferences.equipment.length ||
                preferences.session_minutes < 15 ||
                preferences.session_minutes > 90
              )
                setError(true);
              else setStep('food');
            }}
            testID="weekly-plan-next"
          />
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
            hint={t('fixNovember.commaHint')}
            id="plan-allergies"
          />
          <PlanField
            label={t('fixNovember.exclusions')}
            value={exclusions}
            onChange={setExclusions}
            hint={t('fixNovember.commaHint')}
            id="plan-exclusions"
          />
          <Choice
            label={t('fixNovember.meals')}
            values={[3, 4, 5].map((value) => ({ value, label: String(value) }))}
            selected={[preferences.meals_per_day]}
            onSelect={(value) => update('meals_per_day', value)}
            id="plan-meals"
          />
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
