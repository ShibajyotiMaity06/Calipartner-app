import React, { useState } from 'react';
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
}: {
  name: string;
  onAdd: (sets: ExerciseSetInput[]) => void;
  onCancel: () => void;
}) {
  const [showWeights, setShowWeights] = useState(false);
  const [count, setCount] = useState<number | null>(null);
  const [sets, setSets] = useState<{ reps: number | null; weightKg: number | null }[]>([]);
  const [error, setError] = useState(false);
  const change = (index: number, key: 'reps' | 'weightKg', value: number | null) => {
    setSets((previous) => previous.map((set, i) => (i === index ? { ...set, [key]: value } : set)));
    setError(false);
  };
  return (
    <View style={{ gap: space[3] }} testID="exercise-sets-form">
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
                (_, index) => previous[index] ?? { reps: null, weightKg: null },
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
          <NumberField
            label={t('personalDay.setReps', { set: index + 1 })}
            value={set.reps}
            onChange={(value) => change(index, 'reps', value)}
            testID={`exercise-set-reps-${index}`}
          />
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
      {error && <Text accessibilityRole="alert">{t('personalDay.invalidSets')}</Text>}
      <Button
        label={t('workouts.exercises.addExercise')}
        testID="exercise-confirm-sets"
        onPress={() => {
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
          onAdd(sets.map((set) => ({ reps: set.reps!, weightKg: set.weightKg ?? 0 })));
        }}
      />
      <Button
        variant="secondary"
        label={t('common.cancel')}
        onPress={onCancel}
        testID="exercise-cancel-sets"
      />
    </View>
  );
}
