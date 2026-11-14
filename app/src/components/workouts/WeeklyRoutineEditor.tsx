import React, { useRef, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { Button, Sheet, Text } from '@calipartner/ui';
import { validatePlanExercises, type PlanExercise, type WeeklyPlanView } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { editPreferredRoutine } from '@/services/weeklyPlanService';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { PlanField } from '@/components/onboarding/WeeklyPlanForm';
import { useSquadStyles } from '@/components/rooms/SquadViews';
import { t } from '@/i18n';

export function WeeklyRoutineEditor({
  plan,
  day,
  onClose,
  onSaved,
}: {
  plan: WeeklyPlanView;
  day: number;
  onClose: () => void;
  onSaved: (plan: WeeklyPlanView) => void;
}) {
  const styles = useSquadStyles();

  const { user } = useAuth();
  const [exercises, setExercises] = useState<PlanExercise[]>(
    plan.days.find((d) => d.day === day)?.workout.exercises ?? [],
  );
  const [busy, setBusy] = useState(false),
    [failed, setFailed] = useState(false);
  const lock = useRef(false);
  const close = () => {
    if (!lock.current) onClose();
  };
  useBrowserModalBack(true, close);
  const update = (index: number, field: keyof PlanExercise, value: string | number) =>
    setExercises((current) => current.map((e, i) => (i === index ? { ...e, [field]: value } : e)));
  const save = async () => {
    if (!user || lock.current) return;
    lock.current = true;
    setBusy(true);
    setFailed(false);
    try {
      const validated = validatePlanExercises(exercises, plan.preferences);
      onSaved(await editPreferredRoutine(user.id, plan, day, validated));
      onClose();
    } catch {
      setFailed(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Sheet
      visible
      onClose={close}
      snapPoint="tall"
      accessibilityLabel={t('fixNovember.edit')}
      testID="weekly-routine-editor"
    >
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text variant="title2">{t('fixNovember.edit')}</Text>
        <Text>{t('fixNovember.editHint')}</Text>
        {exercises.map((exercise, index) => (
          <View style={styles.card} key={index}>
            <PlanField
              label={t('fixNovember.exercise')}
              value={exercise.name}
              onChange={(value) => update(index, 'name', value)}
              id={`routine-name-${index}`}
            />
            {(['sets', 'reps', 'rest_seconds'] as const).map((field) => (
              <PlanField
                key={field}
                label={t(
                  field === 'rest_seconds' ? 'fixNovember.restSeconds' : `fixNovember.${field}`,
                )}
                numeric
                value={String(exercise[field])}
                onChange={(value) => update(index, field, Number(value))}
                id={`routine-${field}-${index}`}
              />
            ))}
            <Button
              variant="tertiary"
              label={t('fixNovember.removeExercise', { name: exercise.name })}
              onPress={() => setExercises((current) => current.filter((_, i) => i !== index))}
              disabled={busy || failed}
              testID={`routine-remove-${index}`}
            />
          </View>
        ))}
        <Button
          variant="secondary"
          label={t('fixNovember.addExercise')}
          disabled={busy || failed || exercises.length >= 8}
          onPress={() =>
            setExercises((current) => [
              ...current,
              {
                name: '',
                equipment: plan.preferences.equipment[0] ?? 'bodyweight',
                sets: 3,
                reps: 10,
                rest_seconds: 60,
              },
            ])
          }
          testID="routine-add-exercise"
        />
        {failed && <Text accessibilityRole="alert">{t('fixNovember.editFailure')}</Text>}
        <Button
          label={t(busy ? 'common.saving' : 'fixNovember.saveRoutine')}
          onPress={() => void save()}
          disabled={busy}
          testID="save-weekly-routine"
        />
        <Button
          variant="tertiary"
          label={t('common.cancel')}
          onPress={close}
          disabled={busy}
          testID="close-weekly-routine"
        />
      </ScrollView>
    </Sheet>
  );
}
