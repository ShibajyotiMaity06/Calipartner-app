import React, { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
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
  const [showWeights, setShowWeights] = useState(
    Boolean(initialSets?.some((set) => set.weightKg > 0)),
  );
  const [count, setCount] = useState<number | null>(initialSets?.length ?? null);
  const [sets, setSets] = useState<{ reps: number | null; weightKg: number | null }[]>(
    initialSets ?? [],
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
                (_, index) => previous[index] ?? { reps: 10, weightKg: 0 },
              ),
            );
          else setSets([]);
        }}
      />
      {sets.length > 0 && (
        <Pressable
          style={{ minHeight: homeLayout.touchSize, justifyContent: 'center' }}
          accessibilityRole="button"
          accessibilityState={{ expanded: showWeights }}
          accessibilityLabel={t(showWeights ? 'personalDay.hideWeights' : 'personalDay.addWeights')}
          onPress={() => setShowWeights((value) => !value)}
          testID="exercise-add-weights"
        >
          <Text variant="bodyS" style={{ textDecorationLine: 'underline' }}>
            {t(showWeights ? 'personalDay.hideWeights' : 'personalDay.addWeights')}
          </Text>
        </Pressable>
      )}
      {sets.map((set, index) => (
        <View key={index} style={{ gap: space[2] }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: space[2] }}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workoutFlow.repsLess', { set: index + 1 })}
              disabled={saving || (set.reps ?? 0) <= 1}
              onPress={() => change(index, 'reps', Math.max(1, (set.reps ?? 1) - 1))}
              style={{
                minWidth: homeLayout.touchSize,
                minHeight: homeLayout.touchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              testID={`exercise-set-minus-${index}`}
            >
              <Text>-</Text>
            </Pressable>
            <View style={{ flex: 1 }}>
              <NumberField
                centered
                label={t('personalDay.setReps', { set: index + 1 })}
                value={set.reps}
                onChange={(value) => change(index, 'reps', value)}
                testID={`exercise-set-reps-${index}`}
              />
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('workoutFlow.repsMore', { set: index + 1 })}
              disabled={saving || (set.reps ?? 0) >= 100}
              onPress={() => change(index, 'reps', Math.min(100, (set.reps ?? 0) + 1))}
              style={{
                minWidth: homeLayout.touchSize,
                minHeight: homeLayout.touchSize,
                alignItems: 'center',
                justifyContent: 'center',
              }}
              testID={`exercise-set-plus-${index}`}
            >
              <Text>+</Text>
            </Pressable>
          </View>
          {showWeights && (
            <NumberField
              optional
              label={t('personalDay.setWeight', { set: index + 1 })}
              value={set.weightKg}
              onChange={(value) => change(index, 'weightKg', value)}
              testID={`exercise-set-weight-${index}`}
            />
          )}
        </View>
      ))}
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
