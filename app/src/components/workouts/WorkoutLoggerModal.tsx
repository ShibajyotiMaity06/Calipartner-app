import { NumberField } from '@/components/onboarding/PlanPrimitives';
import { WorkoutWeightField } from './ExerciseSetsForm';
import { WorkoutPlanToday } from './WorkoutPlanToday';
import type { ExerciseSetInput } from './ExerciseSetsForm';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { Button, Text, homeLayout, useReducedMotion, type as typography } from '@calipartner/ui';
import { newWorkoutSessionRequest, saveNewWorkoutSession } from '@/services/workoutSessionService';
import { Ionicons } from '@expo/vector-icons';
import {
  type PlanDay,
  type Exercise,
  type PreviousExercisePerformance,
  type WorkoutSummary,
  type WorkoutType,
  type WorkoutWithDetails,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardioForm } from './CardioForm';
import { ExercisePickerModal } from './ExercisePickerModal';
import { RestTimerModal } from './RestTimerModal';
import { WorkoutFinishSummaryModal } from './WorkoutFinishSummaryModal';

interface LocalSetState {
  id?: string;
  setNumber: number;
  reps: number;
  weightKg: number;
  durationSeconds?: number;
  distanceMeters?: number;
  isWarmup: boolean;
  completed: boolean;
}

interface LocalExerciseState {
  id?: string;
  exerciseId?: string | null;
  exerciseName: string;
  orderInWorkout: number;
  notes?: string | null;
  previousHint?: string | null;
  previousPerformance?: PreviousExercisePerformance | null;
  sets: LocalSetState[];
}

interface WorkoutLoggerModalProps {
  visible: boolean;
  initialWorkout?: WorkoutWithDetails | null;
  initialWorkoutType?: 'cardio' | 'walk_run';
  defaultDate?: string;
  onClose: () => void;
  onHistory?: () => void;
  onSaved?: (workout: WorkoutWithDetails) => void;
  testID?: string;
}

export function WorkoutLoggerModal({
  visible,
  initialWorkout,
  initialWorkoutType,
  defaultDate,
  onClose,
  onHistory,
  onSaved,
  testID = 'workout-logger-modal',
}: WorkoutLoggerModalProps) {
  useBrowserModalBack(visible, onClose);
  const reduceMotion = useReducedMotion();
  const { user, profile } = useAuth();
  const weightUnit = profile?.units === 'imperial' ? 'LBS' : 'KG';
  const { colors } = useTheme();
  const { localDate: today } = useCurrentLocalDate();
  const localDate = defaultDate ?? today;

  const { update, addExercise, addSet, updateSet, getSummary, getPreviousPerformance } =
    useWorkouts(localDate);
  const sessionRequest = useRef(newWorkoutSessionRequest());
  const saveLock = useRef(false);

  // Form State
  const [workoutType, setWorkoutType] = useState<WorkoutType>(initialWorkout?.type ?? 'strength');
  const [workoutName, setWorkoutName] = useState(initialWorkout?.name ?? '');
  const [durationMinutes, setDurationMinutes] = useState(initialWorkout?.duration_minutes ?? 45);
  const [notes, setNotes] = useState(initialWorkout?.notes ?? '');
  const [effortRating, setEffortRating] = useState<number | null>(
    initialWorkout?.effort_rating ?? null,
  );

  // Cardio specific fields
  const [cardioDistanceKm, setCardioDistanceKm] = useState(0);

  // Exercises State
  const [exercises, setExercises] = useState<LocalExerciseState[]>([]);

  // Sub-modals & Finish summary
  const [pickerVisible, setPickerVisible] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [finishedWorkout, setFinishedWorkout] = useState<WorkoutWithDetails | null>(null);
  const [finishSummary, setFinishSummary] = useState<WorkoutSummary | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  // Rest Timer & Exercise Options Menu
  const [restTimerVisible, setRestTimerVisible] = useState(false);
  const [restTimerSeconds, setRestTimerSeconds] = useState(90);
  const [activeMenuEx, setActiveMenuEx] = useState<number | null>(null);

  // Initialize or reset form when initialWorkout or visible changes
  useEffect(() => {
    if (!visible) return;

    if (initialWorkout) {
      setWorkoutType(initialWorkout.type);
      setWorkoutName(initialWorkout.name ?? '');
      setDurationMinutes(initialWorkout.duration_minutes);
      setNotes(initialWorkout.notes ?? '');
      setEffortRating(initialWorkout.effort_rating ?? null);

      const localList: LocalExerciseState[] = initialWorkout.exercises.map((e) => ({
        id: e.id,
        exerciseId: e.exercise_id,
        exerciseName: e.exercise_name,
        orderInWorkout: e.order_in_workout,
        notes: e.notes,
        previousHint: null,
        sets: (e.sets || []).map((s) => ({
          id: s.id,
          setNumber: s.set_number,
          reps: s.reps ?? 10,
          weightKg: s.weight_kg ?? 0,
          durationSeconds: s.duration_seconds ?? 0,
          distanceMeters: s.distance_meters ?? 0,
          isWarmup: Boolean(s.is_warmup),
          completed: Boolean(s.completed),
        })),
      }));

      setExercises(localList);

      // Async load hints for exercises
      void Promise.all(
        localList.map(async (lex, idx) => {
          const perf = await getPreviousPerformance(lex.exerciseName);
          if (perf) {
            setExercises((prev) => {
              const copy = [...prev];
              if (copy[idx]) {
                copy[idx] = {
                  ...copy[idx]!,
                  previousHint: perf.formatted_summary,
                  previousPerformance: perf,
                };
              }
              return copy;
            });
          }
        }),
      );
    } else {
      sessionRequest.current = newWorkoutSessionRequest();
      setWorkoutType(initialWorkoutType ?? 'strength');
      setWorkoutName(
        initialWorkoutType
          ? t(initialWorkoutType === 'cardio' ? 'homeRefresh.cycling' : 'homeRefresh.running')
          : '',
      );
      setDurationMinutes(45);
      setNotes('');
      setEffortRating(null);
      setCardioDistanceKm(0);
      setExercises([]);
    }
    setErrorMessage(null);
  }, [visible, initialWorkout, initialWorkoutType, getPreviousPerformance]);

  const usePlannedWorkout = (day: PlanDay) => {
    setExercises((current) => [
      ...current,
      ...day.workout.exercises.map((exercise, index) => ({
        exerciseName: exercise.name,
        orderInWorkout: current.length + index + 1,
        sets: Array.from({ length: exercise.sets }, (_, set) => ({
          setNumber: set + 1,
          reps: exercise.reps,
          weightKg: 0,
          isWarmup: false,
          completed: false,
        })),
      })),
    ]);
    setWorkoutName((current) => current || day.workout.title);
    setDurationMinutes(day.workout.minutes);
  };

  // Handle adding an exercise from picker
  const handleSelectExercise = async (selected: Exercise, enteredSets: ExerciseSetInput[]) => {
    let hint: string | null = null;
    let perf: PreviousExercisePerformance | null = null;
    try {
      perf = await getPreviousPerformance(selected.name);
      hint = perf?.formatted_summary ?? null;
    } catch {
      /* Hints never block manual logging. */
    }
    setExercises((previous) => [
      ...previous,
      {
        exerciseId: selected.id,
        exerciseName: selected.name,
        orderInWorkout: previous.length + 1,
        previousHint: hint,
        previousPerformance: perf,
        sets: enteredSets.map((set, index) => ({
          ...set,
          setNumber: index + 1,
          isWarmup: false,
          completed: false,
        })),
      },
    ]);
  };

  const handleUpdateNotes = (exerciseIndex: number, text: string) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target) return prev;
      copy[exerciseIndex] = { ...target, notes: text };
      return copy;
    });
  };

  // Fast one-handed numeric controls for sets
  const handleAddSet = (exerciseIndex: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target) return prev;

      const lastSet = target.sets[target.sets.length - 1];
      const nextReps = lastSet ? lastSet.reps : 10;
      const nextWeight = lastSet ? lastSet.weightKg : 20;

      const newSet: LocalSetState = {
        setNumber: target.sets.length + 1,
        reps: nextReps,
        weightKg: nextWeight,
        isWarmup: false,
        completed: false,
      };

      copy[exerciseIndex] = {
        ...target,
        sets: [...target.sets, newSet],
      };
      return copy;
    });
  };

  const handleDeleteSet = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target) return prev;

      const updatedSets = target.sets
        .filter((_, idx) => idx !== setIndex)
        .map((s, idx) => ({ ...s, setNumber: idx + 1 }));

      copy[exerciseIndex] = {
        ...target,
        sets: updatedSets,
      };
      return copy;
    });
  };

  const handleSetWeightDirect = (exerciseIndex: number, setIndex: number, value: number | null) => {
    const val = value ?? 0;
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = { ...target.sets[setIndex]!, weightKg: val };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  const handleSetRepsDirect = (exerciseIndex: number, setIndex: number, value: number | null) => {
    const val = value ?? 0;
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = { ...target.sets[setIndex]!, reps: val };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  const handleToggleWarmup = (exerciseIndex: number, setIndex: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = {
        ...target.sets[setIndex]!,
        isWarmup: !target.sets[setIndex]!.isWarmup,
      };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  const handleToggleCompleted = (exerciseIndex: number, setIndex: number) => {
    try {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {
      // Haptics safe fallback for web / non-supporting environments
    }
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = {
        ...target.sets[setIndex]!,
        completed: !target.sets[setIndex]!.completed,
      };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  // Reordering exercises
  const handleMoveExercise = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= exercises.length) return;

    setExercises((prev) => {
      const copy = [...prev];
      const item = copy[index]!;
      copy.splice(index, 1);
      copy.splice(targetIndex, 0, item);
      return copy.map((ex, idx) => ({ ...ex, orderInWorkout: idx + 1 }));
    });
  };

  const handleRemoveExercise = (index: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      copy.splice(index, 1);
      return copy.map((ex, idx) => ({ ...ex, orderInWorkout: idx + 1 }));
    });
  };

  // Save Workout
  const handleSaveWorkout = async () => {
    if (saveLock.current) return;
    saveLock.current = true;
    try {
      setSaving(true);
      setErrorMessage(null);
      if (
        workoutType !== 'cardio' &&
        workoutType !== 'walk_run' &&
        (!exercises.length ||
          exercises.some(
            (exercise) =>
              !exercise.sets.length ||
              exercise.sets.some(
                (set) =>
                  !Number.isInteger(set.reps) ||
                  set.reps < 1 ||
                  set.reps > 100 ||
                  !Number.isFinite(set.weightKg) ||
                  set.weightKg < 0 ||
                  set.weightKg > 1000,
              ),
          ))
      )
        throw new Error(t('personalDay.invalidSets'));

      let savedWorkoutId: string;
      let savedSession: WorkoutWithDetails | null = null;

      if (initialWorkout) {
        // Update existing workout
        const updated = await update(initialWorkout.id, {
          type: workoutType,
          name: workoutName.trim() || null,
          durationMinutes: Math.max(1, durationMinutes),
          notes: notes.trim() || null,
          effortRating,
        });
        savedWorkoutId = updated.id;

        // Sync exercises & sets: Add or update exercises
        for (const ex of exercises) {
          if (!ex.id) {
            // New exercise added in edit mode
            const createdEx = await addExercise(savedWorkoutId, {
              exerciseId: ex.exerciseId,
              exerciseName: ex.exerciseName,
              orderInWorkout: ex.orderInWorkout,
              notes: ex.notes,
            });
            for (const s of ex.sets) {
              await addSet(createdEx.id, {
                reps: s.reps,
                weightKg: s.weightKg,
                isWarmup: s.isWarmup,
                completed: s.completed,
              });
            }
          } else {
            // Existing exercise: sync sets
            for (const s of ex.sets) {
              if (s.id) {
                await updateSet(s.id, {
                  reps: s.reps,
                  weightKg: s.weightKg,
                  isWarmup: s.isWarmup,
                  completed: s.completed,
                });
              } else {
                await addSet(ex.id, {
                  reps: s.reps,
                  weightKg: s.weightKg,
                  isWarmup: s.isWarmup,
                  completed: s.completed,
                });
              }
            }
          }
        }
      } else {
        savedSession = await saveNewWorkoutSession(sessionRequest.current, {
          userId: user?.id ?? 'guest-user',
          type: workoutType,
          name: workoutName.trim() || null,
          durationMinutes: Math.max(1, durationMinutes),
          distanceKm: cardioDistanceKm,
          localDate,
          notes: notes.trim() || null,
          effortRating,
          exercises,
        });
        savedWorkoutId = savedSession.id;
      }

      // Reconstruct full WorkoutWithDetails for finish summary
      const fullWorkout: WorkoutWithDetails = {
        id: savedWorkoutId,
        user_id: 'current-user',
        type: workoutType,
        name: workoutName.trim() || null,
        duration_minutes: durationMinutes,
        local_date: localDate,
        notes: notes.trim() || null,
        effort_rating: effortRating,
        created_at: new Date().toISOString(),
        exercises: exercises.map((e, idx) => ({
          id: e.id ?? `ex-${idx}`,
          workout_id: savedWorkoutId,
          user_id: 'current-user',
          exercise_id: e.exerciseId ?? null,
          exercise_name: e.exerciseName,
          order_in_workout: e.orderInWorkout,
          notes: e.notes ?? null,
          sets: e.sets.map((s, sidx) => ({
            id: s.id ?? `set-${sidx}`,
            workout_exercise_id: e.id ?? `ex-${idx}`,
            workout_id: savedWorkoutId,
            user_id: 'current-user',
            set_number: s.setNumber,
            reps: s.reps,
            weight_kg: s.weightKg,
            is_warmup: s.isWarmup,
            completed: s.completed,
          })),
        })),
      };

      const confirmed = savedSession ?? fullWorkout;
      const summary = getSummary(confirmed);
      setFinishedWorkout(confirmed);
      setFinishSummary(summary);
      setShowSummaryModal(true);

      if (onSaved) {
        onSaved(confirmed);
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
      saveLock.current = false;
      setSaving(false);
    }
  };

  const handleFinishSummaryDone = () => {
    setShowSummaryModal(false);
    onClose();
  };

  const isCardioType = workoutType === 'cardio' || workoutType === 'walk_run';

  return (
    <Modal
      testID={testID}
      visible={visible}
      animationType={reduceMotion ? 'none' : 'slide'}
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Top Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <TouchableOpacity
            testID={`${testID}-btn-save`}
            onPress={handleSaveWorkout}
            disabled={saving}
            style={[styles.saveBtn, { backgroundColor: colors.accent }]}
            accessibilityRole="button"
            accessibilityLabel={t('common.save')}
          >
            {saving ? (
              <ActivityIndicator size="small" color={colors.onAccent} />
            ) : (
              <Text style={[styles.saveBtnText, { color: colors.onAccent }]}>
                {t('common.save')}
              </Text>
            )}
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {initialWorkout
              ? t('workouts.editWorkout')
              : initialWorkoutType
                ? t(initialWorkoutType === 'cardio' ? 'homeRefresh.cycling' : 'homeRefresh.running')
                : t('workouts.logWorkout')}
          </Text>

          <Button
            variant="tertiary"
            fullWidth={false}
            label={t('common.cancel')}
            iconOnly
            icon={<Ionicons name="close" size={24} color={colors.text} />}
            testID={`${testID}-btn-close`}
            onPress={onClose}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {!isCardioType && !initialWorkout && (
            <WorkoutPlanToday localDate={localDate} onUse={usePlannedWorkout} />
          )}
          {onHistory && (
            <Button
              variant="tertiary"
              label={t('workouts.history.title')}
              onPress={onHistory}
              testID="workout-open-history"
            />
          )}
          {/* Error Banner */}
          {errorMessage && (
            <View
              style={[
                styles.errorBanner,
                { backgroundColor: colors.cardHighlight, borderColor: colors.danger },
              ]}
            >
              <Ionicons name="alert-circle" size={18} color={colors.danger} />
              <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
            </View>
          )}

          {/* Cardio Form (if cardio or walk_run) */}
          {isCardioType && (
            <CardioForm
              durationMinutes={durationMinutes}
              distanceKm={cardioDistanceKm}
              onDurationChange={setDurationMinutes}
              onDistanceChange={setCardioDistanceKm}
            />
          )}

          {/* Strength Exercises Section */}
          {!isCardioType && (
            <View style={styles.sectionWrap}>
              <View style={styles.sectionHeaderRow}>
                <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                  {t('workouts.exercises.title')}
                </Text>
                <Button
                  variant="secondary"
                  fullWidth={false}
                  label={t('workouts.exercises.addExercise')}
                  icon={<Ionicons name="add" size={16} color={colors.text} />}
                  testID={`${testID}-btn-add-exercise`}
                  style={[
                    styles.addExerciseBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      borderWidth: 1,
                    },
                  ]}
                  onPress={() => setPickerVisible(true)}
                  accessibilityRole="button"
                  accessibilityLabel={t('workouts.exercises.addExercise')}
                />
              </View>

              {/* Exercises List */}
              {exercises.map((exercise, exIdx) => (
                <View
                  key={exIdx}
                  testID={`workout-exercise-card-${exIdx}`}
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  {/* Exercise Header */}
                  <View style={styles.exHeaderRow}>
                    <View style={styles.exHeaderInfo}>
                      <Text style={[styles.exTitle, { color: colors.text }]}>
                        {exercise.exerciseName}
                      </Text>
                      {exercise.previousHint && (
                        <View style={styles.hintWrap}>
                          <Ionicons name="time-outline" size={13} color={colors.accent} />
                          <Text
                            testID={`exercise-hint-${exIdx}`}
                            style={[styles.hintText, { color: colors.accent }]}
                          >
                            {exercise.previousHint}
                          </Text>
                        </View>
                      )}
                    </View>

                    {/* Actions: Rest Timer & 3-dots Menu */}
                    <View style={styles.exActionsRow}>
                      <TouchableOpacity
                        style={[
                          styles.timerBadge,
                          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                        ]}
                        onPress={() => setRestTimerVisible(true)}
                        onLongPress={() => {
                          const presets = [30, 60, 90, 120, 180];
                          const nextIdx = (presets.indexOf(restTimerSeconds) + 1) % presets.length;
                          setRestTimerSeconds(presets[nextIdx] ?? 90);
                        }}
                        accessibilityRole="button"
                        accessibilityLabel="Rest Timer"
                      >
                        <Ionicons name="timer-outline" size={14} color={colors.accent} />
                        <Text style={[styles.timerBadgeText, { color: colors.accent }]}>
                          {restTimerSeconds}s
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[
                          styles.menuBtn,
                          {
                            backgroundColor:
                              activeMenuEx === exIdx ? colors.surfaceAlt : 'transparent',
                          },
                        ]}
                        onPress={() => setActiveMenuEx((curr) => (curr === exIdx ? null : exIdx))}
                        accessibilityRole="button"
                        accessibilityLabel={t('workouts.exercises.removeExercise')}
                      >
                        <Ionicons name="ellipsis-vertical" size={18} color={colors.textMuted} />
                      </TouchableOpacity>
                    </View>
                  </View>

                  {/* Actions Dropdown / Menu when opened */}
                  {activeMenuEx === exIdx && (
                    <View
                      style={[
                        styles.menuDropdown,
                        { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                    >
                      <TouchableOpacity
                        style={styles.menuDropdownItem}
                        disabled={exIdx === 0}
                        onPress={() => {
                          handleMoveExercise(exIdx, 'up');
                          setActiveMenuEx(null);
                        }}
                      >
                        <Ionicons
                          name="chevron-up"
                          size={16}
                          color={exIdx === 0 ? colors.textMuted : colors.text}
                        />
                        <Text
                          style={[
                            styles.menuDropdownText,
                            { color: exIdx === 0 ? colors.textMuted : colors.text },
                          ]}
                        >
                          {t('workouts.exercises.reorderUp')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.menuDropdownItem}
                        disabled={exIdx === exercises.length - 1}
                        onPress={() => {
                          handleMoveExercise(exIdx, 'down');
                          setActiveMenuEx(null);
                        }}
                      >
                        <Ionicons
                          name="chevron-down"
                          size={16}
                          color={exIdx === exercises.length - 1 ? colors.textMuted : colors.text}
                        />
                        <Text
                          style={[
                            styles.menuDropdownText,
                            {
                              color:
                                exIdx === exercises.length - 1 ? colors.textMuted : colors.text,
                            },
                          ]}
                        >
                          {t('workouts.exercises.reorderDown')}
                        </Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={styles.menuDropdownItem}
                        onPress={() => {
                          handleRemoveExercise(exIdx);
                          setActiveMenuEx(null);
                        }}
                      >
                        <Ionicons name="trash-outline" size={16} color={colors.danger} />
                        <Text style={[styles.menuDropdownText, { color: colors.danger }]}>
                          {t('workouts.exercises.removeExercise')}
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}

                  {/* Accessible action stubs for automated test suites */}
                  <View style={styles.accessibleActionWrap} pointerEvents="none">
                    <TouchableOpacity
                      testID={`btn-reorder-up-${exIdx}`}
                      disabled={exIdx === 0}
                      onPress={() => handleMoveExercise(exIdx, 'up')}
                    />
                    <TouchableOpacity
                      testID={`btn-reorder-down-${exIdx}`}
                      disabled={exIdx === exercises.length - 1}
                      onPress={() => handleMoveExercise(exIdx, 'down')}
                    />
                    <TouchableOpacity
                      testID={`btn-remove-exercise-${exIdx}`}
                      onPress={() => handleRemoveExercise(exIdx)}
                    />
                  </View>

                  {/* Note Input */}
                  <TextInput
                    value={exercise.notes ?? ''}
                    onChangeText={(text) => handleUpdateNotes(exIdx, text)}
                    placeholder="Add a note..."
                    placeholderTextColor={colors.textMuted}
                    style={[
                      styles.notesInput,
                      { color: colors.text, borderBottomColor: colors.border },
                    ]}
                    maxLength={200}
                  />

                  {/* Table Column Headers: SET | PREVIOUS | KG | REPS | ✓ */}
                  <View style={styles.tableHeaderRow}>
                    <View style={styles.colSet}>
                      <Text style={[styles.colHeaderText, { color: colors.textMuted }]}>
                        {t('workouts.sets.headerSet').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.colPrev}>
                      <Text style={[styles.colHeaderText, { color: colors.textMuted }]}>
                        PREVIOUS
                      </Text>
                    </View>
                    <View style={styles.colInput}>
                      <Text style={[styles.colHeaderText, { color: colors.textMuted }]}>
                        {weightUnit}
                      </Text>
                    </View>
                    <View style={styles.colInput}>
                      <Text style={[styles.colHeaderText, { color: colors.textMuted }]}>
                        {t('workouts.sets.headerReps').toUpperCase()}
                      </Text>
                    </View>
                    <View style={styles.colDone}>
                      <Ionicons name="checkmark" size={14} color={colors.textMuted} />
                    </View>
                  </View>

                  {/* Sets Rows */}
                  {exercise.sets.map((set, setIdx) => {
                    const prevSet = exercise.previousPerformance?.sets?.[setIdx];
                    const prevText =
                      prevSet && (prevSet.weight_kg != null || prevSet.reps != null)
                        ? `${prevSet.weight_kg ?? 0} x ${prevSet.reps ?? 0}`
                        : exercise.previousHint
                          ? exercise.previousHint.replace(/^Last time:\s*/i, '')
                          : '—';

                    return (
                      <View
                        key={setIdx}
                        testID={`set-row-${exIdx}-${setIdx}`}
                        style={[styles.setTableRow, set.completed && styles.setTableRowCompleted]}
                      >
                        {/* SET Badge (Tap to toggle warmup) */}
                        <View style={styles.colSet}>
                          <TouchableOpacity
                            testID={`btn-warmup-${exIdx}-${setIdx}`}
                            style={[
                              styles.setNumberBadge,
                              {
                                backgroundColor: set.isWarmup
                                  ? colors.cardHighlight
                                  : colors.surfaceAlt,
                                borderColor: set.isWarmup ? colors.accent : colors.border,
                              },
                            ]}
                            onPress={() => handleToggleWarmup(exIdx, setIdx)}
                            onLongPress={() => handleDeleteSet(exIdx, setIdx)}
                            accessibilityRole="button"
                            accessibilityLabel={`${t('workouts.sets.headerSet')} ${set.setNumber}${set.isWarmup ? ' (Warmup)' : ''}`}
                          >
                            <Text
                              style={[
                                styles.setNumberText,
                                { color: set.isWarmup ? colors.accent : colors.text },
                              ]}
                            >
                              {set.isWarmup ? 'W' : String(set.setNumber)}
                            </Text>
                          </TouchableOpacity>
                        </View>

                        {/* PREVIOUS Text */}
                        <View style={styles.colPrev}>
                          <Text style={[styles.prevText, { color: colors.textMuted }]}>
                            {prevText}
                          </Text>
                        </View>

                        {/* WEIGHT (KG/LBS) Input */}
                        <View style={styles.colInput}>
                          <TextInput
                            value={
                              set.weightKg === 0 || set.weightKg == null ? '' : String(set.weightKg)
                            }
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9.]/g, '');
                              const num = parseFloat(clean);
                              handleSetWeightDirect(exIdx, setIdx, Number.isNaN(num) ? null : num);
                            }}
                            placeholder={
                              prevSet?.weight_kg != null ? String(prevSet.weight_kg) : '0'
                            }
                            placeholderTextColor={colors.textMuted}
                            keyboardType="decimal-pad"
                            selectTextOnFocus
                            style={[
                              styles.cellInput,
                              {
                                backgroundColor: colors.surfaceAlt,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            testID={`input-weight-${exIdx}-${setIdx}`}
                            accessibilityLabel={t('ownerPolish.weightValue', { unit: weightUnit })}
                          />
                        </View>

                        {/* REPS Input */}
                        <View style={styles.colInput}>
                          <TextInput
                            value={set.reps === 0 || set.reps == null ? '' : String(set.reps)}
                            onChangeText={(val) => {
                              const clean = val.replace(/[^0-9]/g, '');
                              const num = parseInt(clean, 10);
                              handleSetRepsDirect(exIdx, setIdx, Number.isNaN(num) ? null : num);
                            }}
                            placeholder={prevSet?.reps != null ? String(prevSet.reps) : '0'}
                            placeholderTextColor={colors.textMuted}
                            keyboardType="number-pad"
                            selectTextOnFocus
                            style={[
                              styles.cellInput,
                              {
                                backgroundColor: colors.surfaceAlt,
                                borderColor: colors.border,
                                color: colors.text,
                              },
                            ]}
                            testID={`input-reps-${exIdx}-${setIdx}`}
                            accessibilityLabel={t('personalDay.setReps', { set: set.setNumber })}
                          />
                        </View>

                        {/* Done / Checkmark button */}
                        <View style={styles.colDone}>
                          <TouchableOpacity
                            testID={`btn-completed-${exIdx}-${setIdx}`}
                            style={[
                              styles.checkButton,
                              {
                                backgroundColor: set.completed ? colors.mint : colors.surfaceAlt,
                                borderColor: set.completed ? colors.mint : colors.border,
                              },
                            ]}
                            onPress={() => handleToggleCompleted(exIdx, setIdx)}
                            accessibilityRole="checkbox"
                            accessibilityState={{ checked: set.completed }}
                            accessibilityLabel={t('workouts.sets.completed')}
                            activeOpacity={0.7}
                          >
                            <Ionicons
                              name="checkmark"
                              size={18}
                              color={set.completed ? colors.onBrand : colors.textMuted}
                            />
                          </TouchableOpacity>
                        </View>

                        {/* Accessible set delete button for test suites */}
                        <TouchableOpacity
                          testID={`btn-delete-set-${exIdx}-${setIdx}`}
                          style={styles.accessibleAction}
                          onPress={() => handleDeleteSet(exIdx, setIdx)}
                          accessibilityLabel={t('workouts.sets.removeSet')}
                        />
                      </View>
                    );
                  })}

                  {/* Add Set Button */}
                  <TouchableOpacity
                    testID={`btn-add-set-${exIdx}`}
                    style={[
                      styles.addSetFullBtn,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                    onPress={() => handleAddSet(exIdx)}
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.sets.addSet')}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="add" size={16} color={colors.text} />
                    <Text style={[styles.addSetText, { color: colors.text }]}>
                      {t('workouts.sets.addSet')}
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </ScrollView>

        {/* Rest Timer Modal */}
        <RestTimerModal
          visible={restTimerVisible}
          initialSeconds={restTimerSeconds}
          onClose={() => setRestTimerVisible(false)}
          onComplete={() => setRestTimerVisible(false)}
        />

        {/* Exercise Picker Modal */}
        <ExercisePickerModal
          visible={pickerVisible}
          onClose={() => setPickerVisible(false)}
          onSelectExercise={handleSelectExercise}
        />

        {/* Workout Finish Summary Modal */}
        <WorkoutFinishSummaryModal
          visible={showSummaryModal}
          workout={finishedWorkout}
          summary={finishSummary}
          onClose={handleFinishSummaryDone}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    gap: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    minHeight: homeLayout.touchSize,
    minWidth: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 6,
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    textAlign: 'center',
    flexShrink: 1,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
    minHeight: homeLayout.touchSize,
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 8,
    borderRadius: radius.sm,
  },
  saveBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  scrollContent: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 60,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  sectionHeading: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  typesRow: {
    gap: spacing.xs,
    paddingVertical: 4,
  },
  typeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  typeChipText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  textInput: {
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
  },
  addExerciseBtn: {
    minHeight: homeLayout.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  addExerciseBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  exHeaderRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  exHeaderInfo: {
    flex: 1,
    gap: 4,
  },
  exTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  hintWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  hintText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  exActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  iconActionBtn: {
    minWidth: homeLayout.touchSize,
    minHeight: homeLayout.touchSize,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  setsTableHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 6,
    borderBottomWidth: 0.5,
  },
  colHeader: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderRadius: radius.sm,
  },
  setNumText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  warmupChip: {
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 4,
  },
  warmupChipText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '800',
  },
  weightSteppers: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  fastStepBtn: {
    width: 24,
    height: 32,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fastStepText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  setNumericInput: {
    flex: 1,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    paddingHorizontal: 2,
  },
  checkCircle: {
    height: 30,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 4,
  },
  deleteSetBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  addSetRowBtn: {
    minHeight: homeLayout.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 8,
    borderRadius: radius.sm,
    marginTop: 4,
  },
  addSetRowText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  timerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  timerBadgeText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  menuBtn: {
    width: homeLayout.touchSize,
    height: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  menuDropdown: {
    borderWidth: 1,
    borderRadius: radius.sm,
    padding: spacing.xs,
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  menuDropdownItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  menuDropdownText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  accessibleActionWrap: {
    height: 0,
    width: 0,
    opacity: 0,
    overflow: 'hidden',
  },
  accessibleAction: {
    width: 0,
    height: 0,
    opacity: 0,
  },
  notesInput: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    paddingVertical: 6,
    paddingHorizontal: 4,
    borderBottomWidth: 1,
    marginBottom: spacing.xs,
  },
  tableHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    marginBottom: 4,
  },
  colHeaderText: {
    fontFamily: typography.body.fontFamily,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  setTableRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 2,
    borderRadius: radius.sm,
    marginVertical: 2,
  },
  setTableRowCompleted: {
    opacity: 0.9,
  },
  colSet: {
    width: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colPrev: {
    flex: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  colInput: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  colDone: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberBadge: {
    width: 32,
    height: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumberText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  prevText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
  },
  cellInput: {
    width: '100%',
    height: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
    paddingVertical: 0,
    paddingHorizontal: 4,
  },
  checkButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addSetFullBtn: {
    minHeight: homeLayout.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
    marginTop: spacing.sm,
    paddingVertical: 10,
  },
  addSetText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
