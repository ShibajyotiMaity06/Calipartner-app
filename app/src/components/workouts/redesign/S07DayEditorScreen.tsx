import React, { useState, useEffect } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, WorkoutToggle, StickyCtaBar } from '../s_common';
import type { GeneratedPlanDay, GeneratedPlanExercise } from '@calipartner/core';

interface S07DayEditorScreenProps {
  mode: 'plan' | 'today';
  initialWeekday: number; // 1 Mon to 7 Sun
  allDays: GeneratedPlanDay[];
  onSavePlanMode: (days: GeneratedPlanDay[]) => void;
  onSaveTodayMode: (day: GeneratedPlanDay, scope: 'just_today' | 'update_plan') => void;
  onAddExercise: () => void;
  onEditExerciseTargets: (exercise: GeneratedPlanExercise, exIndex: number) => void;
  onBack: () => void;
}

export function S07DayEditorScreen({
  mode,
  initialWeekday,
  allDays,
  onSavePlanMode,
  onSaveTodayMode,
  onAddExercise,
  onEditExerciseTargets,
  onBack,
}: S07DayEditorScreenProps) {
  const [currentWeekday, setCurrentWeekday] = useState<number>(initialWeekday);
  const [workingDays, setWorkingDays] = useState<GeneratedPlanDay[]>(() =>
    JSON.parse(JSON.stringify(allDays)),
  );
  const [todayScope, setTodayScope] = useState<'just_today' | 'update_plan'>('just_today');

  useEffect(() => {
    setWorkingDays(JSON.parse(JSON.stringify(allDays)));
  }, [allDays]);

  const currentDay = workingDays.find((d) => d.weekday === currentWeekday) || {
    weekday: currentWeekday,
    is_rest: false,
    name: 'Workout',
    exercises: [],
    about_minutes: 60,
  };

  const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const weekdayFull = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const updateCurrentDay = (updates: Partial<GeneratedPlanDay>) => {
    setWorkingDays((prev) =>
      prev.map((d) => (d.weekday === currentWeekday ? { ...d, ...updates } : d)),
    );
  };

  const handleToggleRestDay = (val: boolean) => {
    if (val && currentDay.exercises.length > 0) {
      Alert.alert(
        'Turn this day into a rest day?',
        'Its exercises will be removed.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Turn into rest day',
            style: 'destructive',
            onPress: () => updateCurrentDay({ is_rest: true, exercises: [] }),
          },
        ],
        { cancelable: true },
      );
    } else {
      updateCurrentDay({ is_rest: val });
    }
  };

  const handleDeleteExercise = (index: number) => {
    const updated = [...currentDay.exercises];
    updated.splice(index, 1);
    updateCurrentDay({ exercises: updated });
  };

  const handleBack = () => {
    // Check if changes exist
    Alert.alert(
      'Discard your changes?',
      'Any unsaved edits will be lost.',
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onBack },
      ],
      { cancelable: true },
    );
  };

  const isSaveEnabled =
    mode === 'today'
      ? currentDay.exercises.length > 0
      : workingDays
          .filter((d) => !d.is_rest)
          .every((d) => d.name.trim().length > 0 && d.exercises.length > 0);

  const handleSave = () => {
    if (mode === 'today') {
      onSaveTodayMode(currentDay, todayScope);
    } else {
      onSavePlanMode(workingDays);
    }
  };

  return (
    <View style={styles.screenContainer} testID="s07-day-editor-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="day-editor-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={handleBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <Text style={styles.headerTitle}>
          {mode === 'today' ? 'Edit today' : `Edit ${weekdayFull[currentWeekday - 1]}`}
        </Text>
        <View style={styles.headerSpacer} />
      </View>

      {/* Weekday Switcher row in plan mode */}
      {mode === 'plan' ? (
        <View style={styles.weekdayRow} testID="weekday-switcher">
          {workingDays.map((d) => {
            const isSelected = d.weekday === currentWeekday;
            return (
              <Pressable
                key={d.weekday}
                testID={`day-btn-${d.weekday}`}
                accessibilityRole="button"
                accessibilityLabel={`${weekdayShort[d.weekday - 1]}, ${d.is_rest ? 'rest' : 'training'}`}
                onPress={() => setCurrentWeekday(d.weekday)}
                style={[styles.dayButton, isSelected && styles.dayButtonSelected]}
              >
                <Text style={[styles.dayButtonLabel, isSelected && styles.dayButtonLabelSelected]}>
                  {weekdayShort[d.weekday - 1]}
                </Text>
                <View
                  style={[
                    styles.dayDot,
                    d.is_rest ? styles.dotHollow : styles.dotFilled,
                    isSelected && styles.dotSelected,
                  ]}
                />
              </Pressable>
            );
          })}
        </View>
      ) : null}

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Training Day Config in Plan mode */}
        {mode === 'plan' ? (
          <>
            {/* Rest Day Switch */}
            <View style={styles.toggleRow}>
              <Text style={styles.toggleLabel}>Rest day</Text>
              <WorkoutToggle
                value={currentDay.is_rest}
                onValueChange={handleToggleRestDay}
                testID="rest-day-toggle"
              />
            </View>

            {!currentDay.is_rest ? (
              <View style={styles.fieldBlock}>
                <Text style={styles.fieldLabel}>WORKOUT NAME</Text>
                <TextInput
                  value={currentDay.name}
                  onChangeText={(val) => updateCurrentDay({ name: val })}
                  placeholder="e.g. Chest & Triceps"
                  placeholderTextColor={workoutTokens.dim}
                  style={styles.textInput}
                  testID="workout-name-input"
                />
              </View>
            ) : null}
          </>
        ) : null}

        {/* Exercises list */}
        {!currentDay.is_rest ? (
          <View style={styles.exercisesSection}>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>EXERCISES · {currentDay.exercises.length}</Text>
              <Text style={styles.reorderHint}>Hold and drag to reorder</Text>
            </View>

            {currentDay.exercises.map((ex, idx) => (
              <View key={ex.id || idx} style={styles.exerciseCard}>
                <Pressable
                  testID={`exercise-row-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${ex.name}, ${ex.target_sets} sets of ${ex.target_reps}`}
                  onPress={() => onEditExerciseTargets(ex, idx)}
                  style={styles.exerciseCardPressable}
                >
                  <Ionicons name="reorder-two-outline" size={20} color={workoutTokens.dim} />
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseName}>{ex.name}</Text>
                    <Text style={styles.exerciseSetsReps}>
                      {ex.target_sets} sets × {ex.target_reps} reps
                    </Text>
                  </View>
                  <View style={styles.loadChip}>
                    <Text style={styles.loadChipText}>
                      {ex.target_weight_kg ? `${ex.target_weight_kg} kg` : 'Bodyweight'}
                    </Text>
                  </View>
                </Pressable>

                <Pressable
                  testID={`delete-exercise-${idx}`}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${ex.name}`}
                  onPress={() => handleDeleteExercise(idx)}
                  style={styles.deleteExBtn}
                >
                  <Ionicons name="trash-outline" size={18} color={workoutTokens.danger} />
                </Pressable>
              </View>
            ))}

            <Pressable
              testID="add-exercise-btn"
              onPress={onAddExercise}
              style={styles.addExerciseBtn}
              accessibilityRole="button"
              accessibilityLabel="Add exercises"
            >
              <Ionicons name="add" size={20} color={workoutTokens.accent} />
              <Text style={styles.addExerciseText}>Add exercises</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.restDayMessage}>
            <Text style={styles.restDayText}>This day is marked as a rest day.</Text>
          </View>
        )}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Bottom Bar */}
      <StickyCtaBar>
        {mode === 'today' ? (
          <View style={styles.todayScopeRow}>
            <Pressable
              testID="apply-just-today"
              accessibilityRole="button"
              accessibilityState={{ selected: todayScope === 'just_today' }}
              onPress={() => setTodayScope('just_today')}
              style={[styles.scopeBtn, todayScope === 'just_today' && styles.scopeBtnActive]}
            >
              <Text
                style={[styles.scopeText, todayScope === 'just_today' && styles.scopeTextActive]}
              >
                Just today
              </Text>
            </Pressable>
            <Pressable
              testID="apply-update-plan"
              accessibilityRole="button"
              accessibilityState={{ selected: todayScope === 'update_plan' }}
              onPress={() => setTodayScope('update_plan')}
              style={[styles.scopeBtn, todayScope === 'update_plan' && styles.scopeBtnActive]}
            >
              <Text
                style={[styles.scopeText, todayScope === 'update_plan' && styles.scopeTextActive]}
              >
                Update my plan
              </Text>
            </Pressable>
          </View>
        ) : null}

        <PrimaryButton
          label="Save changes"
          onPress={handleSave}
          disabled={!isSaveEnabled}
          testID="save-day-changes-btn"
        />

        {mode === 'plan' ? (
          <Text style={styles.footerNotice}>Editing by hand does not use your AI rebuild.</Text>
        ) : null}
      </StickyCtaBar>
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
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 12,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  weekdayRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 6,
    justifyContent: 'space-between',
  },
  dayButton: {
    flex: 1,
    height: 48,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayButtonSelected: {
    backgroundColor: workoutTokens.accent,
    borderColor: workoutTokens.accent,
  },
  dayButtonLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
  },
  dayButtonLabelSelected: {
    color: workoutTokens.onAccent,
  },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: workoutRadius.dot,
    marginTop: 4,
  },
  dotFilled: {
    backgroundColor: workoutTokens.accent,
  },
  dotHollow: {
    borderWidth: 1,
    borderColor: workoutTokens.dim,
  },
  dotSelected: {
    backgroundColor: workoutTokens.onAccent,
    borderColor: workoutTokens.onAccent,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 130,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 16,
  },
  toggleLabel: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  fieldBlock: {
    marginBottom: 16,
  },
  fieldLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  textInput: {
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 14,
    height: 48,
    color: workoutTokens.text,
    fontSize: 15,
  },
  exercisesSection: {
    marginTop: 8,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  sectionTitle: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  reorderHint: {
    color: workoutTokens.dim,
    fontSize: 11,
  },
  exerciseCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 14,
    marginBottom: 8,
  },
  exerciseCardPressable: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  exerciseSetsReps: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  loadChip: {
    backgroundColor: workoutTokens.inset,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: workoutRadius.chip,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  loadChipText: {
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
  },
  deleteExBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  addExerciseBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.row,
    padding: 14,
    marginTop: 6,
  },
  addExerciseText: {
    color: workoutTokens.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  restDayMessage: {
    padding: 24,
    alignItems: 'center',
  },
  restDayText: {
    color: workoutTokens.muted,
    fontSize: 14,
  },
  todayScopeRow: {
    flexDirection: 'row',
    height: 44,
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.control,
    padding: 3,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: workoutTokens.border,
  },
  scopeBtn: {
    flex: 1,
    borderRadius: workoutRadius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scopeBtnActive: {
    backgroundColor: workoutTokens.selected,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  scopeText: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
  },
  scopeTextActive: {
    color: workoutTokens.text,
  },
  footerNotice: {
    color: workoutTokens.dim,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 8,
  },
  scrollSpacer: {
    height: 40,
  },
});
