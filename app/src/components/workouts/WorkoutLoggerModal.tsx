import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Text, type as typography } from '@calipartner/ui';
import { Ionicons } from '@expo/vector-icons';
import type { Exercise, WorkoutSummary, WorkoutType, WorkoutWithDetails } from '@calipartner/core';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CardioForm } from './CardioForm';
import { ExercisePickerModal } from './ExercisePickerModal';
import { RunningTimerBar } from './RunningTimerBar';
import { WorkoutFinishSummaryModal } from './WorkoutFinishSummaryModal';
import { RestTimerModal } from './RestTimerModal';

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
  sets: LocalSetState[];
}

interface WorkoutLoggerModalProps {
  visible: boolean;
  initialWorkout?: WorkoutWithDetails | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved?: (workout: WorkoutWithDetails) => void;
  testID?: string;
}

const WORKOUT_TYPES: Array<{
  key: WorkoutType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}> = [
  { key: 'strength', label: 'Strength', icon: 'barbell-outline' },
  { key: 'cardio', label: 'Cardio', icon: 'speedometer-outline' },
  { key: 'walk_run', label: 'Walk / Run', icon: 'walk-outline' },
  { key: 'sports', label: 'Sports', icon: 'football-outline' },
  { key: 'yoga_mobility', label: 'Yoga & Mobility', icon: 'body-outline' },
  { key: 'other', label: 'Other', icon: 'fitness-outline' },
];

export function WorkoutLoggerModal({
  visible,
  initialWorkout,
  defaultDate,
  onClose,
  onSaved,
  testID = 'workout-logger-modal',
}: WorkoutLoggerModalProps) {
  const { colors } = useTheme();
  const { localDate: today } = useCurrentLocalDate();
  const localDate = defaultDate ?? today;

  const { create, update, addExercise, addSet, updateSet, getSummary, getPreviousPerformance } =
    useWorkouts(localDate);

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
  const [restTimerVisible, setRestTimerVisible] = useState(false);

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
          if (perf?.formatted_summary) {
            setExercises((prev) => {
              const copy = [...prev];
              if (copy[idx]) {
                copy[idx] = { ...copy[idx]!, previousHint: perf.formatted_summary };
              }
              return copy;
            });
          }
        }),
      );
    } else {
      setWorkoutType('strength');
      setWorkoutName('');
      setDurationMinutes(45);
      setNotes('');
      setEffortRating(null);
      setCardioDistanceKm(0);
      setExercises([]);
    }
    setErrorMessage(null);
  }, [visible, initialWorkout, getPreviousPerformance]);

  // Handle adding an exercise from picker
  const handleSelectExercise = async (selected: Exercise) => {
    const perf = await getPreviousPerformance(selected.name);
    const newEx: LocalExerciseState = {
      exerciseId: selected.id,
      exerciseName: selected.name,
      orderInWorkout: exercises.length + 1,
      previousHint: perf?.formatted_summary ?? null,
      sets: [
        {
          setNumber: 1,
          reps: 10,
          weightKg: 20,
          isWarmup: false,
          completed: true,
        },
      ],
    };
    setExercises((prev) => [...prev, newEx]);
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
        completed: true,
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

  const handleUpdateSetWeight = (exerciseIndex: number, setIndex: number, delta: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const current = target.sets[setIndex]!;
      const nextWeight = Math.max(0, Math.round((current.weightKg + delta) * 10) / 10);

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = { ...current, weightKg: nextWeight };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  const handleSetWeightDirect = (exerciseIndex: number, setIndex: number, valText: string) => {
    const num = parseFloat(valText.replace(/[^0-9.]/g, ''));
    const val = isNaN(num) ? 0 : num;
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

  const handleUpdateSetReps = (exerciseIndex: number, setIndex: number, delta: number) => {
    setExercises((prev) => {
      const copy = [...prev];
      const target = copy[exerciseIndex];
      if (!target || !target.sets[setIndex]) return prev;

      const current = target.sets[setIndex]!;
      const nextReps = Math.max(0, current.reps + delta);

      const setsCopy = [...target.sets];
      setsCopy[setIndex] = { ...current, reps: nextReps };
      copy[exerciseIndex] = { ...target, sets: setsCopy };
      return copy;
    });
  };

  const handleSetRepsDirect = (exerciseIndex: number, setIndex: number, valText: string) => {
    const num = parseInt(valText.replace(/[^0-9]/g, ''), 10);
    const val = isNaN(num) ? 0 : num;
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
    try {
      setSaving(true);
      setErrorMessage(null);

      let savedWorkoutId: string;

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
        // Create new workout
        const created = await create({
          type: workoutType,
          name: workoutName.trim() || null,
          durationMinutes: Math.max(1, durationMinutes),
          localDate,
          notes: notes.trim() || null,
          effortRating,
        });
        savedWorkoutId = created.id;

        // Add exercises and sets
        for (const ex of exercises) {
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
        }
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

      const summary = getSummary(fullWorkout);
      setFinishedWorkout(fullWorkout);
      setFinishSummary(summary);
      setShowSummaryModal(true);

      if (onSaved) {
        onSaved(fullWorkout);
      }
    } catch (e) {
      setErrorMessage(e instanceof Error ? e.message : String(e));
    } finally {
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
      animationType="slide"
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
            testID={`${testID}-btn-close`}
            onPress={onClose}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {initialWorkout ? t('workouts.editWorkout') : t('workouts.logWorkout')}
          </Text>

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
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Running Timer Bar */}
          <RunningTimerBar
            testID={`${testID}-running-timer-bar`}
            workoutId={initialWorkout?.id}
            onApplyDuration={(mins) => setDurationMinutes(mins)}
          />

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

          {/* Type Picker Chips */}
          <View style={styles.sectionWrap}>
            <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
              {t('workouts.fields.type')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.typesRow}
            >
              {WORKOUT_TYPES.map((item) => {
                const isSelected = workoutType === item.key;
                return (
                  <TouchableOpacity
                    key={item.key}
                    testID={`chip-workout-type-${item.key}`}
                    style={[
                      styles.typeChip,
                      {
                        backgroundColor: isSelected ? colors.accent : colors.surface,
                        borderColor: isSelected ? colors.accent : colors.border,
                      },
                    ]}
                    onPress={() => setWorkoutType(item.key)}
                    accessibilityRole="button"
                    accessibilityLabel={item.label}
                  >
                    <Ionicons
                      name={item.icon}
                      size={18}
                      color={isSelected ? colors.onAccent : colors.text}
                    />
                    <Text
                      style={[
                        styles.typeChipText,
                        { color: isSelected ? colors.onAccent : colors.text },
                      ]}
                    >
                      {item.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* General Fields */}
          <View
            style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
          >
            {/* Workout Name */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('workouts.fields.name')}
              </Text>
              <TextInput
                testID={`${testID}-input-name`}
                style={[
                  styles.textInput,
                  {
                    color: colors.text,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                value={workoutName}
                onChangeText={setWorkoutName}
                placeholder={t('workouts.fields.namePlaceholder')}
                placeholderTextColor={colors.textMuted}
                accessibilityLabel={t('workouts.fields.name')}
              />
            </View>

            {/* Duration Stepper */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('workouts.fields.duration')}
              </Text>
              <View style={styles.durationStepperRow}>
                <TouchableOpacity
                  testID={`${testID}-btn-dur-minus-5`}
                  style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => setDurationMinutes((m) => Math.max(5, m - 5))}
                  accessibilityRole="button"
                  accessibilityLabel="-5 min"
                >
                  <Text style={[styles.stepperBtnText, { color: colors.text }]}>-5</Text>
                </TouchableOpacity>
                <TextInput
                  testID={`${testID}-input-duration`}
                  style={[
                    styles.durationInput,
                    {
                      color: colors.text,
                      backgroundColor: colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                  keyboardType="number-pad"
                  value={String(durationMinutes)}
                  onChangeText={(txt) => {
                    const num = parseInt(txt.replace(/[^0-9]/g, ''), 10);
                    setDurationMinutes(isNaN(num) ? 0 : num);
                  }}
                  accessibilityLabel={t('workouts.fields.duration')}
                />
                <TouchableOpacity
                  testID={`${testID}-btn-dur-plus-5`}
                  style={[styles.stepperBtn, { backgroundColor: colors.surfaceAlt }]}
                  onPress={() => setDurationMinutes((m) => m + 5)}
                  accessibilityRole="button"
                  accessibilityLabel="+5 min"
                >
                  <Text style={[styles.stepperBtnText, { color: colors.text }]}>+5</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Effort Rating (1 to 10) */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('workouts.fields.effortRating')}
              </Text>
              <View style={styles.effortRow}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((level) => {
                  const isSelected = effortRating === level;
                  return (
                    <TouchableOpacity
                      key={level}
                      testID={`chip-effort-${level}`}
                      style={[
                        styles.effortPill,
                        {
                          backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                        },
                      ]}
                      onPress={() => setEffortRating(isSelected ? null : level)}
                      accessibilityRole="button"
                      accessibilityLabel={`Effort rating ${level}`}
                    >
                      <Text
                        style={[
                          styles.effortPillText,
                          {
                            color: isSelected ? colors.onAccent : colors.text,
                            fontWeight: isSelected ? '800' : '600',
                          },
                        ]}
                      >
                        {level}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {/* Notes */}
            <View style={styles.fieldGroup}>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>
                {t('workouts.fields.notes')}
              </Text>
              <TextInput
                testID={`${testID}-input-notes`}
                style={[
                  styles.textArea,
                  {
                    color: colors.text,
                    backgroundColor: colors.background,
                    borderColor: colors.border,
                  },
                ]}
                value={notes}
                onChangeText={setNotes}
                placeholder={t('workouts.fields.notesPlaceholder')}
                placeholderTextColor={colors.textMuted}
                multiline
                numberOfLines={2}
                accessibilityLabel={t('workouts.fields.notes')}
              />
            </View>
          </View>

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
          <View style={styles.sectionWrap}>
            <View style={styles.sectionHeaderRow}>
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                {t('workouts.exercises.title')}
              </Text>
              <TouchableOpacity
                testID={`${testID}-btn-add-exercise`}
                style={[styles.addExerciseBtn, { backgroundColor: colors.accent }]}
                onPress={() => setPickerVisible(true)}
                accessibilityRole="button"
                accessibilityLabel={t('workouts.exercises.addExercise')}
              >
                <Ionicons name="add" size={16} color={colors.onAccent} />
                <Text style={[styles.addExerciseBtnText, { color: colors.onAccent }]}>
                  {t('workouts.exercises.addExercise')}
                </Text>
              </TouchableOpacity>
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

                  {/* Actions: Reorder & Remove */}
                  <View style={styles.exActionsRow}>
                    <TouchableOpacity
                      testID={`btn-reorder-up-${exIdx}`}
                      disabled={exIdx === 0}
                      onPress={() => handleMoveExercise(exIdx, 'up')}
                      style={[styles.iconActionBtn, { opacity: exIdx === 0 ? 0.3 : 1 }]}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.exercises.reorderUp')}
                    >
                      <Ionicons name="chevron-up" size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`btn-reorder-down-${exIdx}`}
                      disabled={exIdx === exercises.length - 1}
                      onPress={() => handleMoveExercise(exIdx, 'down')}
                      style={[
                        styles.iconActionBtn,
                        { opacity: exIdx === exercises.length - 1 ? 0.3 : 1 },
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.exercises.reorderDown')}
                    >
                      <Ionicons name="chevron-down" size={18} color={colors.textMuted} />
                    </TouchableOpacity>

                    <TouchableOpacity
                      testID={`btn-remove-exercise-${exIdx}`}
                      onPress={() => handleRemoveExercise(exIdx)}
                      style={styles.iconActionBtn}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.exercises.removeExercise')}
                    >
                      <Ionicons name="trash-outline" size={18} color={colors.danger} />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Table Header for Sets */}
                <View style={[styles.setsTableHeader, { borderBottomColor: colors.border }]}>
                  <Text style={[styles.colHeader, { flex: 0.8, color: colors.textMuted }]}>
                    {t('workouts.sets.headerSet')}
                  </Text>
                  <Text style={[styles.colHeader, { flex: 0.8, color: colors.textMuted }]}>
                    {t('workouts.sets.headerWarmup')}
                  </Text>
                  <Text style={[styles.colHeader, { flex: 2.2, color: colors.textMuted }]}>
                    {t('workouts.sets.headerWeight')}
                  </Text>
                  <Text style={[styles.colHeader, { flex: 1.8, color: colors.textMuted }]}>
                    {t('workouts.sets.headerReps')}
                  </Text>
                  <Text
                    style={[
                      styles.colHeader,
                      { flex: 0.9, textAlign: 'center', color: colors.textMuted },
                    ]}
                  >
                    {t('workouts.sets.headerDone')}
                  </Text>
                  <Text style={[styles.colHeader, { flex: 0.6 }]} />
                </View>

                {/* Set Rows */}
                {exercise.sets.map((set, setIdx) => (
                  <View
                    key={setIdx}
                    testID={`set-row-${exIdx}-${setIdx}`}
                    style={[
                      styles.setRow,
                      {
                        backgroundColor: set.completed ? colors.surfaceAlt : colors.surface,
                        borderBottomColor: colors.border,
                      },
                    ]}
                  >
                    {/* Set Number */}
                    <Text style={[styles.setNumText, { flex: 0.8, color: colors.text }]}>
                      {set.setNumber}
                    </Text>

                    {/* Warmup Toggle Chip */}
                    <TouchableOpacity
                      testID={`btn-warmup-${exIdx}-${setIdx}`}
                      style={[
                        styles.warmupChip,
                        {
                          backgroundColor: set.isWarmup ? colors.syncPending : colors.surfaceAlt,
                          borderColor: colors.border,
                        },
                      ]}
                      onPress={() => handleToggleWarmup(exIdx, setIdx)}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.sets.warmupTooltip')}
                    >
                      <Text
                        style={[
                          styles.warmupChipText,
                          {
                            color: set.isWarmup ? '#FFFFFF' : colors.textMuted,
                          },
                        ]}
                      >
                        W
                      </Text>
                    </TouchableOpacity>

                    {/* Fast Weight Stepper & TextInput */}
                    <View style={[styles.weightSteppers, { flex: 2.2 }]}>
                      <TouchableOpacity
                        testID={`btn-weight-minus-${exIdx}-${setIdx}`}
                        style={[styles.fastStepBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleUpdateSetWeight(exIdx, setIdx, -2.5)}
                      >
                        <Text style={[styles.fastStepText, { color: colors.text }]}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        testID={`input-weight-${exIdx}-${setIdx}`}
                        style={[
                          styles.setNumericInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                        keyboardType="decimal-pad"
                        value={set.weightKg > 0 ? String(set.weightKg) : ''}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        onChangeText={(txt) => handleSetWeightDirect(exIdx, setIdx, txt)}
                      />
                      <TouchableOpacity
                        testID={`btn-weight-plus-${exIdx}-${setIdx}`}
                        style={[styles.fastStepBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleUpdateSetWeight(exIdx, setIdx, 2.5)}
                      >
                        <Text style={[styles.fastStepText, { color: colors.text }]}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Fast Reps Stepper & TextInput */}
                    <View style={[styles.weightSteppers, { flex: 1.8 }]}>
                      <TouchableOpacity
                        testID={`btn-reps-minus-${exIdx}-${setIdx}`}
                        style={[styles.fastStepBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleUpdateSetReps(exIdx, setIdx, -1)}
                      >
                        <Text style={[styles.fastStepText, { color: colors.text }]}>-</Text>
                      </TouchableOpacity>
                      <TextInput
                        testID={`input-reps-${exIdx}-${setIdx}`}
                        style={[
                          styles.setNumericInput,
                          {
                            color: colors.text,
                            backgroundColor: colors.background,
                            borderColor: colors.border,
                          },
                        ]}
                        keyboardType="number-pad"
                        value={set.reps > 0 ? String(set.reps) : ''}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                        onChangeText={(txt) => handleSetRepsDirect(exIdx, setIdx, txt)}
                      />
                      <TouchableOpacity
                        testID={`btn-reps-plus-${exIdx}-${setIdx}`}
                        style={[styles.fastStepBtn, { backgroundColor: colors.surfaceAlt }]}
                        onPress={() => handleUpdateSetReps(exIdx, setIdx, 1)}
                      >
                        <Text style={[styles.fastStepText, { color: colors.text }]}>+</Text>
                      </TouchableOpacity>
                    </View>

                    {/* Completed Checkmark Toggle */}
                    <TouchableOpacity
                      testID={`btn-completed-${exIdx}-${setIdx}`}
                      style={[
                        styles.checkCircle,
                        { flex: 0.9 },
                        set.completed
                          ? { backgroundColor: colors.syncSynced }
                          : { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                      ]}
                      onPress={() => handleToggleCompleted(exIdx, setIdx)}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.sets.completed')}
                    >
                      <Ionicons
                        name="checkmark"
                        size={16}
                        color={set.completed ? '#FFFFFF' : colors.textMuted}
                      />
                    </TouchableOpacity>

                    {/* Delete Set */}
                    <TouchableOpacity
                      testID={`btn-delete-set-${exIdx}-${setIdx}`}
                      style={[styles.deleteSetBtn, { flex: 0.6 }]}
                      onPress={() => handleDeleteSet(exIdx, setIdx)}
                      accessibilityRole="button"
                      accessibilityLabel={t('workouts.sets.removeSet')}
                    >
                      <Ionicons name="trash-outline" size={16} color={colors.textMuted} />
                    </TouchableOpacity>
                  </View>
                ))}

                {/* Add Set and Rest Timer Buttons */}
                <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <TouchableOpacity
                    testID={`btn-add-set-${exIdx}`}
                    style={[styles.addSetRowBtn, { backgroundColor: colors.surfaceAlt, flex: 1 }]}
                    onPress={() => handleAddSet(exIdx)}
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.sets.addSet')}
                  >
                    <Ionicons name="add" size={16} color={colors.accent} />
                    <Text style={[styles.addSetRowText, { color: colors.accent }]}>
                      {t('workouts.sets.addSet')}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    testID={`btn-rest-timer-${exIdx}`}
                    style={[styles.addSetRowBtn, { backgroundColor: colors.surfaceAlt, flex: 0.6 }]}
                    onPress={() => setRestTimerVisible(true)}
                    accessibilityRole="button"
                    accessibilityLabel={t('workouts.restTimerTitle')}
                  >
                    <Ionicons name="timer-outline" size={16} color={colors.accent} />
                    <Text style={[styles.addSetRowText, { color: colors.accent }]}>Rest</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>

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

        {/* E17 Rest Timer Modal */}
        <RestTimerModal visible={restTimerVisible} onClose={() => setRestTimerVisible(false)} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  saveBtn: {
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
  fieldGroup: {
    gap: 6,
  },
  fieldLabel: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  textInput: {
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
  },
  textArea: {
    minHeight: 50,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    textAlignVertical: 'top',
  },
  durationStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  stepperBtn: {
    width: 44,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperBtnText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  durationInput: {
    flex: 1,
    height: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    textAlign: 'center',
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.md,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  effortRow: {
    flexDirection: 'row',
    gap: 4,
  },
  effortPill: {
    flex: 1,
    height: 36,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  effortPillText: {
    fontFamily: typography.body.fontFamily,
    fontSize: fontSize.xs,
  },
  addExerciseBtn: {
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
    padding: 6,
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
});
