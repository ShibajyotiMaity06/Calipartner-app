import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, TextButton } from '../s_common';
import type {
  ActiveWorkoutSession,
  SessionExercise,
  SessionSet,
} from '@/services/workoutRedesignService';

interface S05ActiveSessionScreenProps {
  session: ActiveWorkoutSession;
  weightUnit: 'kg' | 'lbs';
  autoRestTimer: boolean;
  onMinimize: () => void;
  onFinish: () => void;
  onSwapExercise: (exercise: SessionExercise) => void;
  onAddExercise: () => void;
  onTickSet: (setId: string, completed: boolean, reps?: number, weightKg?: number) => void;
}

export function S05ActiveSessionScreen({
  session,
  weightUnit,
  autoRestTimer,
  onMinimize,
  onFinish,
  onSwapExercise,
  onAddExercise,
  onTickSet,
}: S05ActiveSessionScreenProps) {
  const [elapsed, setElapsed] = useState(0);
  const [restSecondsRemaining, setRestSecondsRemaining] = useState<number | null>(null);

  // Timer interval for session elapsed
  useEffect(() => {
    const startTime = new Date(session.started_at).getTime();
    const interval = setInterval(() => {
      const now = Date.now();
      setElapsed(Math.max(0, Math.floor((now - startTime) / 1000)));
    }, 1000);
    return () => clearInterval(interval);
  }, [session.started_at]);

  // Rest timer countdown
  useEffect(() => {
    if (restSecondsRemaining === null) return;
    if (restSecondsRemaining <= 0) {
      setRestSecondsRemaining(null);
      return;
    }
    const timer = setInterval(() => {
      setRestSecondsRemaining((prev) => (prev && prev > 0 ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [restSecondsRemaining]);

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  const handleToggleSet = (ex: SessionExercise, s: SessionSet) => {
    const nextCompleted = !s.completed;
    onTickSet(s.id, nextCompleted, s.reps, s.weight_kg ?? undefined);

    if (nextCompleted && autoRestTimer) {
      setRestSecondsRemaining(ex.rest_seconds || 60);
    }
  };

  const addRestTime = () => {
    if (restSecondsRemaining !== null) {
      setRestSecondsRemaining((prev) => Math.min(600, (prev || 0) + 15));
    }
  };

  const skipRestTimer = () => {
    setRestSecondsRemaining(null);
  };

  return (
    <View style={styles.screenContainer} testID="s05-active-session-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="active-session-minimize-btn"
          accessibilityRole="button"
          accessibilityLabel="Minimize session"
          onPress={onMinimize}
          style={styles.headerIconBtn}
        >
          <Ionicons name="chevron-down" size={24} color={workoutTokens.text} />
        </Pressable>

        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {session.name}
          </Text>
          <Text style={styles.headerTimer}>{formatTimer(elapsed)}</Text>
        </View>

        <TextButton label="Finish" onPress={onFinish} testID="active-session-finish-btn" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {session.exercises.map((ex, exIdx) => (
          <View key={ex.id || exIdx} style={styles.exerciseCard}>
            <View style={styles.exerciseHeader}>
              <View style={styles.exerciseTitleCol}>
                <Text style={styles.exerciseName}>{ex.exercise_name}</Text>
                <Text style={styles.exerciseTarget}>
                  {ex.target_sets} sets · {ex.target_reps} reps · {ex.rest_seconds}s rest
                </Text>
              </View>
              <Pressable
                testID={`swap-exercise-${ex.id}`}
                accessibilityRole="button"
                accessibilityLabel={`Swap ${ex.exercise_name}`}
                onPress={() => onSwapExercise(ex)}
                style={styles.swapBtn}
              >
                <Ionicons name="swap-horizontal" size={20} color={workoutTokens.dim} />
              </Pressable>
            </View>

            {/* Set Table Headers */}
            <View style={styles.tableHeaderRow}>
              <Text style={styles.thSet}>SET</Text>
              <Text style={styles.thPrev}>PREVIOUS</Text>
              <Text style={styles.thInput}>{weightUnit.toUpperCase()}</Text>
              <Text style={styles.thInput}>REPS</Text>
              <View style={styles.thCheck} />
            </View>

            {/* Set Rows */}
            {ex.sets.map((s) => (
              <View key={s.id} style={[styles.setRow, s.completed && styles.setRowCompleted]}>
                <Text style={styles.setNumber}>{s.set_number}</Text>
                <Text style={styles.prevText} numberOfLines={1}>
                  {s.previous_performance || '—'}
                </Text>

                {/* Weight Input */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={
                      s.weight_kg !== null && s.weight_kg !== undefined ? String(s.weight_kg) : ''
                    }
                    onChangeText={(txt) => {
                      const num = parseFloat(txt);
                      onTickSet(s.id, s.completed, s.reps, isNaN(num) ? undefined : num);
                    }}
                    keyboardType="numeric"
                    placeholder="—"
                    placeholderTextColor={workoutTokens.dim}
                    style={styles.inputField}
                  />
                </View>

                {/* Reps Input */}
                <View style={styles.inputWrapper}>
                  <TextInput
                    value={s.reps ? String(s.reps) : ''}
                    onChangeText={(txt) => {
                      const num = parseInt(txt, 10);
                      onTickSet(
                        s.id,
                        s.completed,
                        isNaN(num) ? undefined : num,
                        s.weight_kg ?? undefined,
                      );
                    }}
                    keyboardType="number-pad"
                    placeholder={String(ex.target_reps)}
                    placeholderTextColor={workoutTokens.dim}
                    style={styles.inputField}
                  />
                </View>

                {/* Tick Checkbox */}
                <Pressable
                  testID={`tick-set-${s.id}`}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: s.completed }}
                  accessibilityLabel={`Set ${s.set_number} ${s.completed ? 'completed' : 'not completed'}`}
                  onPress={() => handleToggleSet(ex, s)}
                  style={[styles.checkBtn, s.completed && styles.checkBtnCompleted]}
                >
                  <Ionicons
                    name="checkmark"
                    size={18}
                    color={s.completed ? workoutTokens.onAccent : workoutTokens.borderStrong}
                  />
                </Pressable>
              </View>
            ))}
          </View>
        ))}

        <Pressable
          testID="active-session-add-exercise-btn"
          onPress={onAddExercise}
          style={styles.addExerciseCard}
          accessibilityRole="button"
          accessibilityLabel="Add exercise"
        >
          <Ionicons name="add" size={20} color={workoutTokens.accent} />
          <Text style={styles.addExerciseText}>Add exercise</Text>
        </Pressable>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Rest Timer Bar if active */}
      {restSecondsRemaining !== null ? (
        <View style={styles.restTimerBar} testID="rest-timer-bar">
          <View style={styles.restTimerInfo}>
            <Ionicons name="timer-outline" size={20} color={workoutTokens.accent} />
            <Text style={styles.restTimerText}>Rest: {formatTimer(restSecondsRemaining)}</Text>
          </View>
          <View style={styles.restTimerControls}>
            <Pressable
              onPress={addRestTime}
              style={styles.restControlBtn}
              accessibilityRole="button"
              accessibilityLabel="Add 15 seconds"
            >
              <Text style={styles.restControlText}>+15s</Text>
            </Pressable>
            <Pressable
              onPress={skipRestTimer}
              style={styles.restControlBtn}
              accessibilityRole="button"
              accessibilityLabel="Skip rest"
            >
              <Text style={styles.restControlText}>Skip</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: workoutTokens.border,
  },
  headerIconBtn: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.circleMedium,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    alignItems: 'center',
    flex: 1,
    paddingHorizontal: 8,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerTimer: {
    color: workoutTokens.accent,
    fontSize: 13,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 110,
  },
  exerciseCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 16,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseTitleCol: {
    flex: 1,
  },
  exerciseName: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  exerciseTarget: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  swapBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: workoutTokens.border,
  },
  thSet: {
    width: 32,
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
  },
  thPrev: {
    flex: 1,
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    marginRight: 8,
  },
  thInput: {
    width: 60,
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    textAlign: 'center',
    marginRight: 8,
  },
  thCheck: {
    width: 44,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: workoutTokens.inset,
  },
  setRowCompleted: {
    opacity: 0.9,
  },
  setNumber: {
    width: 32,
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  prevText: {
    flex: 1,
    color: workoutTokens.dim,
    fontSize: 12,
    marginRight: 8,
    fontVariant: ['tabular-nums'],
  },
  inputWrapper: {
    width: 60,
    height: 38,
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    justifyContent: 'center',
    marginRight: 8,
  },
  inputField: {
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  checkBtn: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.circleMedium,
    borderWidth: 1.5,
    borderColor: workoutTokens.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBtnCompleted: {
    backgroundColor: workoutTokens.accent,
    borderColor: workoutTokens.accent,
  },
  addExerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.card,
    padding: 16,
    marginBottom: 20,
  },
  addExerciseText: {
    color: workoutTokens.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  restTimerBar: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    height: 56,
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  restTimerInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restTimerText: {
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  restTimerControls: {
    flexDirection: 'row',
    gap: 8,
  },
  restControlBtn: {
    backgroundColor: workoutTokens.inset,
    paddingHorizontal: 10,
    height: 34,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  restControlText: {
    color: workoutTokens.text,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollSpacer: {
    height: 40,
  },
});
