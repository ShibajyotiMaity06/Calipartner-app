import React, { useRef, useState } from 'react';
import { Modal, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Text, controls, radius, space, useTheme } from '@calipartner/ui';
import type { WorkoutWithDetails } from '@calipartner/core';
import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { ExerciseSetRows } from './ExerciseSetsForm';
import { newWorkoutSessionRequest } from '@/services/workoutSessionService';
import { saveLoggedWorkoutSets } from '@/services/loggedWorkoutEditService';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { t } from '@/i18n';

export function LoggedWorkoutEditModal({
  workout,
  onClose,
  onSaved,
}: {
  workout: WorkoutWithDetails;
  onClose: () => void;
  onSaved: () => void | Promise<void>;
}) {
  const { colors } = useTheme();
  const [draft, setDraft] = useState(() =>
    workout.exercises.map((ex) =>
      (ex.sets ?? []).map((set) => ({ reps: set.reps ?? null, weightKg: set.weight_kg || null })),
    ),
  );
  const [counts, setCounts] = useState<Array<number | null>>(() =>
    draft.map((sets) => sets.length),
  );
  const [saving, setSaving] = useState(false),
    [error, setError] = useState(false);
  const request = useRef(newWorkoutSessionRequest()),
    lock = useRef(false);
  const close = () => {
    if (!lock.current) onClose();
  };
  useBrowserModalBack(true, close);
  return (
    <Modal
      visible
      transparent
      animationType="none"
      onRequestClose={close}
      testID="logged-workout-edit-modal"
    >
      <SafeAreaView
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space[4],
          backgroundColor: colors.modalScrim,
        }}
      >
        <ScrollView
          accessibilityViewIsModal
          style={{
            flexGrow: 0,
            maxHeight: '90%',
            width: '100%',
            maxWidth: controls.dialogMaxWidth,
            alignSelf: 'center',
            borderRadius: radius.sheet,
            backgroundColor: colors.s1,
          }}
          contentContainerStyle={{ padding: space[4], gap: space[4] }}
          keyboardShouldPersistTaps="handled"
        >
          <Text variant="title2">{t('workoutPolish.editTitle')}</Text>
          <Text variant="bodyS">{t('workoutPolish.weightHint')}</Text>
          <View pointerEvents={saving ? 'none' : 'auto'} style={{ gap: space[4] }}>
            {workout.exercises.map((exercise, index) => (
              <View key={exercise.id} style={{ gap: space[2] }}>
                <Text variant="heading">{exercise.exercise_name}</Text>
                <NumberField
                  label={t('personalDay.setsCount')}
                  value={counts[index] ?? null}
                  testID={`logged-edit-count-${index}`}
                  onChange={(count) => {
                    setCounts((values) => values.map((value, i) => (i === index ? count : value)));
                    setDraft((values) =>
                      values.map((sets, i) =>
                        i !== index
                          ? sets
                          : count && Number.isInteger(count) && count >= 1 && count <= 20
                            ? Array.from(
                                { length: count },
                                (_, j) => sets[j] ?? { reps: 10, weightKg: null },
                              )
                            : [],
                      ),
                    );
                  }}
                />
                <ExerciseSetRows
                  prefix={`logged-edit-${index}`}
                  sets={draft[index] ?? []}
                  disabled={saving}
                  onChange={(setIndex, key, value) =>
                    setDraft((previous) =>
                      previous.map((sets, i) =>
                        i !== index
                          ? sets
                          : sets.map((set, j) => (j !== setIndex ? set : { ...set, [key]: value })),
                      ),
                    )
                  }
                />
              </View>
            ))}
          </View>
          {error && (
            <Text accessibilityRole="alert" color={colors.danger}>
              {t('workoutPolish.error')}
            </Text>
          )}
          <Button
            label={t('workoutPolish.save')}
            disabled={saving}
            testID="logged-edit-save"
            onPress={async () => {
              if (lock.current) return;
              lock.current = true;
              setSaving(true);
              setError(false);
              try {
                await saveLoggedWorkoutSets(
                  request.current,
                  workout,
                  draft.map((sets) =>
                    sets.map((set) => ({ reps: set.reps ?? NaN, weightKg: set.weightKg ?? 0 })),
                  ),
                );
                await onSaved();
                onClose();
              } catch {
                setError(true);
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
            onPress={close}
            testID="logged-edit-cancel"
          />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}
