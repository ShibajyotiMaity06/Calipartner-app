import React, { useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Chip, Text, space, useTheme } from '@calipartner/ui';
import {
  WEEK_DAYS,
  type WorkoutRoutineContent,
  type WorkoutRoutineExercise,
} from '@calipartner/core';
import { ModalNavigation } from '@/components/ModalNavigation';
import { PlanField } from '@/components/onboarding/WeeklyPlanForm';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { generateClientUuid } from '@/services/foodService';
import { t } from '@/i18n';
import { ExerciseSetsForm } from './ExerciseSetsForm';

export function CustomWorkoutPlan({
  initial,
  weekday,
  onClose,
  onSaved,
}: {
  initial: WorkoutRoutineContent['days'];
  weekday: number;
  onClose: () => void;
  onSaved: (plan: WorkoutRoutineContent) => Promise<void>;
}) {
  const { colors } = useTheme();
  const [day, setDay] = useState(weekday);
  const [days, setDays] = useState(() =>
    WEEK_DAYS.map(
      (label, index) =>
        initial[index] ?? {
          day: index,
          title: t(`fixNovember.${label}`),
          minutes: 0,
          exercises: [],
        },
    ),
  );
  const [exercise, setExercise] = useState<WorkoutRoutineExercise | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);
  const lock = useRef(false);
  const workouts = days[day]!.exercises;
  const close = () => {
    if (!lock.current) onClose();
  };
  const back = () => setExercise(null);
  useBrowserModalBack(true, close, { depth: exercise ? 1 : 0, onDepthChange: back });

  const changeDay = (exercises: WorkoutRoutineExercise[]) =>
    setDays((previous) =>
      previous.map((value) =>
        value.day === day
          ? {
              ...value,
              title: exercises.length
                ? t(`fixNovember.${WEEK_DAYS[day]!}`)
                : t('workoutFlow.weekdayEmpty'),
              exercises,
            }
          : value,
      ),
    );
  const edit = (value: WorkoutRoutineExercise) => {
    setName(value.name);
    setExercise(value);
    setError(false);
  };

  return (
    <Modal
      visible
      animationType="none"
      onRequestClose={exercise ? back : close}
      testID="custom-plan-modal"
    >
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg0 }}>
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: space[4] }}
        >
          <View style={{ gap: space[3] }} testID="custom-workout-plan">
            <ModalNavigation
              onBack={exercise ? back : undefined}
              onClose={close}
              disabled={saving}
              closeTestID="custom-plan-close"
              backTestID="custom-plan-back"
            />
            <Text variant="title2">{t('workoutFlow.customPlan')}</Text>
            {exercise ? (
              <>
                <PlanField
                  label={t('workoutFlow.workoutName')}
                  value={name}
                  onChange={setName}
                  maxLength={100}
                  id="custom-plan-exercise-name"
                />
                {!name.trim() || name.trim().length > 100 ? null : (
                  <ExerciseSetsForm
                    name={t('workoutFlow.targets')}
                    planOnly
                    initialSets={exercise.targetSets}
                    submitLabel={t('workoutFlow.saveExercise')}
                    onAdd={(targetSets) => {
                      const updated = { ...exercise, name: name.trim(), targetSets };
                      changeDay(
                        workouts.some((item) => item.id === exercise.id)
                          ? workouts.map((item) => (item.id === exercise.id ? updated : item))
                          : [...workouts, updated],
                      );
                      back();
                    }}
                  />
                )}
              </>
            ) : (
              <View pointerEvents={saving ? 'none' : 'auto'} style={{ gap: space[3] }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[2] }}>
                  {WEEK_DAYS.map((label, index) => (
                    <Chip
                      key={label}
                      label={t(`fixNovember.${label}`)}
                      selected={day === index}
                      onPress={() => setDay(index)}
                      testID={`custom-plan-day-${index}`}
                    />
                  ))}
                </View>
                {!workouts.length && (
                  <Text variant="bodyS">{t('workoutFlow.planExercisesEmpty')}</Text>
                )}
                {workouts.map((item) => (
                  <View key={item.id} style={{ gap: space[1] }}>
                    <Button
                      variant="secondary"
                      label={item.name}
                      onPress={() => edit(item)}
                      testID={`custom-plan-edit-${item.id}`}
                    />
                    <Button
                      variant="tertiary"
                      fullWidth={false}
                      label={t('workoutFlow.remove', { name: item.name })}
                      onPress={() => changeDay(workouts.filter((value) => value.id !== item.id))}
                      testID={`custom-plan-remove-${item.id}`}
                    />
                  </View>
                ))}
                <Button
                  label={t('workoutFlow.add')}
                  variant="secondary"
                  disabled={saving || workouts.length >= 8}
                  onPress={() =>
                    edit({
                      id: generateClientUuid(),
                      name: '',
                      equipment: 'bodyweight',
                      targetSets: [
                        { reps: 10, weightKg: 0 },
                        { reps: 10, weightKg: 0 },
                        { reps: 10, weightKg: 0 },
                      ],
                    })
                  }
                  testID="custom-plan-add-exercise"
                />
                {error && <Text accessibilityRole="alert">{t('workoutFlow.manualPlanError')}</Text>}
                <Button
                  label={t(saving ? 'common.saving' : 'workoutFlow.saveCustomPlan')}
                  disabled={saving || days.every((value) => !value.exercises.length)}
                  testID="custom-plan-save"
                  onPress={async () => {
                    if (lock.current) return;
                    lock.current = true;
                    setSaving(true);
                    setError(false);
                    try {
                      await onSaved({ days });
                    } catch {
                      setError(true);
                    } finally {
                      lock.current = false;
                      setSaving(false);
                    }
                  }}
                />
              </View>
            )}
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
