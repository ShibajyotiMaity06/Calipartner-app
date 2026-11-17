import React, { useRef, useState } from 'react';
import { View } from 'react-native';
import { Button, Text, homeLayout, space } from '@calipartner/ui';
import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { t } from '@/i18n';

export interface ExerciseSetInput {
  reps: number;
  weightKg: number;
}
export function ExerciseSetsForm({
  name,
  onAdd,
  onCancel,
  initialSets,
  submitLabel,
}: {
  name: string;
  onAdd: (sets: ExerciseSetInput[]) => void | Promise<void>;
  initialSets?: ExerciseSetInput[];
  submitLabel?: string;
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
      <ExerciseSetRows sets={sets} onChange={change} disabled={saving} />
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
        variant="secondary"
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
}: {
  sets: Array<{ reps: number | null; weightKg: number | null }>;
  onChange: (index: number, key: 'reps' | 'weightKg', value: number | null) => void;
  disabled?: boolean;
  prefix?: string;
}) {
  return (
    <View style={{ gap: space[3] }}>
      {sets.map((set, index) => (
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
              />
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                {(['minus', 'plus'] as const).map((action) => (
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    label={action === 'minus' ? '\u2212' : '+'}
                    key={action}
                    accessibilityRole="button"
                    accessibilityLabel={t(
                      action === 'minus' ? 'workoutFlow.repsLess' : 'workoutFlow.repsMore',
                      { set: index + 1 },
                    )}
                    disabled={
                      disabled ||
                      (action === 'minus' ? (set.reps ?? 0) <= 1 : (set.reps ?? 0) >= 100)
                    }
                    onPress={() =>
                      onChange(
                        index,
                        'reps',
                        action === 'minus'
                          ? Math.max(1, (set.reps ?? 1) - 1)
                          : Math.min(100, (set.reps ?? 0) + 1),
                      )
                    }
                    style={{
                      minWidth: homeLayout.touchSize,
                      minHeight: homeLayout.touchSize,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                    testID={`${prefix}-${action}-${index}`}
                  />
                ))}
              </View>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <NumberField
                optional
                centered
                label={t('workoutPolish.weight')}
                value={set.weightKg}
                onChange={(value) => onChange(index, 'weightKg', value)}
                testID={`${prefix}-weight-${index}`}
              />
            </View>
          </View>
        </View>
      ))}
    </View>
  );
}
