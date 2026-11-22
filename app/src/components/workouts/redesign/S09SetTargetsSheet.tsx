import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { workoutTokens } from '@calipartner/ui';
import { WorkoutSheet, PrimaryButton, SecondaryButton, StepperRow, WorkoutChip } from '../s_common';
import type { GeneratedPlanExercise } from '@calipartner/core';

interface S09SetTargetsSheetProps {
  visible: boolean;
  exercise: GeneratedPlanExercise | null;
  mode?: 'plan_targets' | 'log_exercise';
  onSave: (sets: number, reps: number, weightKg: number | null, restSeconds: number) => void;
  onStartSession?: (sets: number, reps: number, weightKg: number | null, restSeconds: number) => void;
  onClose: () => void;
}

export function S09SetTargetsSheet({
  visible,
  exercise,
  mode = 'plan_targets',
  onSave,
  onStartSession,
  onClose,
}: S09SetTargetsSheetProps) {
  const [sets, setSets] = useState<number>(3);
  const [reps, setReps] = useState<number>(10);
  const [weightKg, setWeightKg] = useState<number>(0);
  const [restSeconds, setRestSeconds] = useState<number>(60);
  const prevExerciseKey = useRef<string | null>(null);

  useEffect(() => {
    if (exercise) {
      const key = `${exercise.id || ''}_${exercise.name || ''}`;
      if (prevExerciseKey.current !== key) {
        prevExerciseKey.current = key;
        setSets(exercise.target_sets || 3);
        setReps(exercise.target_reps || 10);
        setWeightKg(exercise.target_weight_kg || 0);
        setRestSeconds(exercise.rest_seconds || 60);
      }
    } else {
      prevExerciseKey.current = null;
    }
  }, [exercise]);

  if (!exercise) return null;

  const restOptions = [30, 60, 90, 120, 180];

  const handleSave = () => {
    onSave(sets, reps, weightKg > 0 ? weightKg : null, restSeconds);
  };

  const isLogMode = mode === 'log_exercise';

  return (
    <WorkoutSheet
      visible={visible}
      onClose={onClose}
      title={isLogMode ? exercise.name : `Targets for ${exercise.name}`}
      testID="s09-set-targets-sheet"
    >
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <StepperRow
          label={isLogMode ? 'Sets' : 'Target sets'}
          value={sets}
          onIncrement={() => setSets((prev) => Math.min(10, prev + 1))}
          onDecrement={() => setSets((prev) => Math.max(1, prev - 1))}
          testID="targets-sets-stepper"
        />

        <StepperRow
          label={isLogMode ? 'Reps per set' : 'Target reps'}
          value={reps}
          onIncrement={() => setReps((prev) => Math.min(50, prev + 1))}
          onDecrement={() => setReps((prev) => Math.max(1, prev - 1))}
          testID="targets-reps-stepper"
        />

        <StepperRow
          label={isLogMode ? 'Weight' : 'Target weight'}
          value={weightKg > 0 ? `${weightKg} kg` : 'Bodyweight'}
          onIncrement={() => setWeightKg((prev) => prev + 2.5)}
          onDecrement={() => setWeightKg((prev) => Math.max(0, prev - 2.5))}
          testID="targets-weight-stepper"
        />

        <Text style={styles.sectionLabel}>REST TIMER</Text>
        <View style={styles.restChipsRow}>
          {restOptions.map((sec) => (
            <WorkoutChip
              key={sec}
              label={`${sec}s`}
              selected={restSeconds === sec}
              onPress={() => setRestSeconds(sec)}
              testID={`rest-chip-${sec}`}
            />
          ))}
        </View>

        <PrimaryButton
          label={isLogMode ? 'Log as completed' : 'Save targets'}
          onPress={handleSave}
          style={styles.saveBtn}
          testID="save-targets-btn"
        />

        {isLogMode && onStartSession ? (
          <SecondaryButton
            label="Start workout session"
            onPress={() => onStartSession(sets, reps, weightKg > 0 ? weightKg : null, restSeconds)}
            style={styles.startSessionBtn}
            testID="start-session-from-targets-btn"
          />
        ) : null}
      </ScrollView>
    </WorkoutSheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: 10,
    paddingBottom: 20,
  },
  sectionLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginTop: 18,
    marginBottom: 10,
  },
  restChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 24,
  },
  saveBtn: {
    width: '100%',
  },
  startSessionBtn: {
    width: '100%',
    marginTop: 10,
  },
});
