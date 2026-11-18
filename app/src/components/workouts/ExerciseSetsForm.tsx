import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, homeLayout, space } from '@calipartner/ui';
import { kgToLb, lbToKg } from '@calipartner/core';
import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export interface ExerciseSetInput {
  reps: number;
  weightKg: number;
}

export function WorkoutWeightField({
  value,
  onChange,
  testID,
}: {
  value: number | null;
  onChange: (kg: number | null) => void;
  testID: string;
}) {
  const [unit, setUnit] = useState<'kg' | 'lb'>('kg');
  const next = unit === 'kg' ? 'lb' : 'kg';
  const display = value == null || unit === 'kg' ? value : Number(kgToLb(value).toFixed(4));
  return (
    <NumberField
      optional
      centered
      label={t('ownerPolish.weightValue', { unit })}
      value={display}
      onChange={(amount) => onChange(amount == null || unit === 'kg' ? amount : lbToKg(amount))}
      testID={testID}
      trailing={
        <Button
          variant="tertiary"
          fullWidth={false}
          label={unit}
          accessibilityLabel={t('ownerPolish.weightUnit', { unit, next })}
          testID={testID + '-unit'}
          onPress={() => setUnit(next)}
        />
      }
    />
  );
}
export function ExerciseSetsForm({
  name,
  onAdd,
  onCancel,
  initialSets,
  submitLabel,
  planOnly = false,
}: {
  name: string;
  onAdd: (sets: ExerciseSetInput[]) => void | Promise<void>;
  initialSets?: ExerciseSetInput[];
  submitLabel?: string;
  planOnly?: boolean;
  onCancel: () => void;
}) {
  const [count, setCount] = useState<number | null>(initialSets?.length ?? null);
  const [sets, setSets] = useState<{ reps: number | null; weightKg: number | null }[]>(
    initialSets?.map((set) => ({ ...set, weightKg: set.weightKg || null })) ?? [],
  );
  const [error, setError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const lock = useRef(false);
  const change = (index: number, key: 'reps' | 'weightKg', value: number | null) => {
    setSets((previous) => previous.map((set, i) => (i === index ? { ...set, [key]: value } : set)));
    setError(false);
  };
  return (
    <View
      style={{ gap: space[3] }}
      pointerEvents={saving ? 'none' : 'auto'}
      testID="exercise-sets-form"
    >
      <Text variant="heading">{name}</Text>
      <NumberField
        label={t('personalDay.setsCount')}
        value={count}
        testID="exercise-set-count"
        onChange={(value) => {
          setCount(value);
          setError(false);
          if (value != null && Number.isInteger(value) && value >= 1 && value <= 20)
            setSets((previous) =>
              Array.from(
                { length: value },
                (_, index) => previous[index] ?? { reps: 10, weightKg: null },
              ),
            );
          else setSets([]);
        }}
      />
      <ExerciseSetRows sets={sets} onChange={change} disabled={saving} showWeight={!planOnly} />
      {saveError && <Text accessibilityRole="alert">{t('workoutFlow.error')}</Text>}
      {error && <Text accessibilityRole="alert">{t('personalDay.invalidSets')}</Text>}
      <Button
        label={saving ? t('common.saving') : (submitLabel ?? t('workouts.exercises.addExercise'))}
        disabled={saving}
        testID="exercise-confirm-sets"
        onPress={async () => {
          if (lock.current) return;
          if (
            !sets.length ||
            sets.some(
              (set) =>
                !Number.isInteger(set.reps) ||
                set.reps! < 1 ||
                set.reps! > 100 ||
                !Number.isFinite(set.weightKg ?? 0) ||
                (set.weightKg ?? 0) < 0 ||
                (set.weightKg ?? 0) > 1000,
            )
          ) {
            setError(true);
            return;
          }
          lock.current = true;
          setSaving(true);
          setSaveError(false);
          try {
            await onAdd(sets.map((set) => ({ reps: set.reps!, weightKg: set.weightKg ?? 0 })));
          } catch {
            setSaveError(true);
          } finally {
            lock.current = false;
            setSaving(false);
          }
        }}
      />
      <Button
        variant="cancel"
        label={t('common.cancel')}
        disabled={saving}
        onPress={onCancel}
        testID="exercise-cancel-sets"
      />
    </View>
  );
}

export function ExerciseSetRows({
  sets,
  onChange,
  disabled = false,
  prefix = 'exercise-set',
  showWeight = true,
}: {
  sets: Array<{ reps: number | null; weightKg: number | null }>;
  onChange: (index: number, key: 'reps' | 'weightKg', value: number | null) => void;
  disabled?: boolean;
  prefix?: string;
  showWeight?: boolean;
}) {
  return (
    <View style={{ gap: space[3] }}>
      {sets.map((set, index) => {
        const step = (direction: -1 | 1) => {
          const action = direction === -1 ? 'minus' : 'plus';
          const reps = Number.isInteger(set.reps) ? set.reps! : 0;
          return (
            <Button
              variant="tertiary"
              fullWidth={false}
              label={direction === -1 ? '−' : '+'}
              accessibilityLabel={t(
                direction === -1 ? 'workoutFlow.repsLess' : 'workoutFlow.repsMore',
                { set: index + 1 },
              )}
              disabled={disabled || (direction === -1 ? reps <= 1 : reps >= 100)}
              onPress={() => onChange(index, 'reps', Math.min(100, Math.max(1, reps + direction)))}
              style={{
                minWidth: homeLayout.compactTouchSize,
                minHeight: homeLayout.compactTouchSize,
              }}
              testID={prefix + '-' + action + '-' + index}
            />
          );
        };
        return (
          <View key={index} testID={`${prefix}-row-${index}`} style={{ gap: space[1] }}>
            <Text variant="micro">{t('workoutPolish.set', { number: index + 1 })}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: space[2] }}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <NumberField
                  centered
                  label={t('workoutPolish.reps')}
                  value={set.reps}
                  onChange={(value) => onChange(index, 'reps', value)}
                  testID={`${prefix}-reps-${index}`}
                  leading={step(-1)}
                  trailing={step(1)}
                />
              </View>
              {showWeight && (
                <View style={{ flex: 1, minWidth: 0 }}>
                  <WorkoutWeightField
                    value={set.weightKg}
                    onChange={(value) => onChange(index, 'weightKg', value)}
                    testID={`${prefix}-weight-${index}`}
                  />
                </View>
              )}
            </View>
          </View>
        );
      })}
    </View>
  );
}
