import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, WorkoutToggle, StickyCtaBar } from '../s_common';
import type { GeneratedPlanDay } from '@calipartner/core';

interface S24CustomPlanSetupScreenProps {
  planName?: string;
  onChangePlanName?: (name: string) => void;
  days?: GeneratedPlanDay[];
  onChangeDays?:
    ((days: GeneratedPlanDay[]) => void) | React.Dispatch<React.SetStateAction<GeneratedPlanDay[]>>;
  onSavePlan: (name: string, days: GeneratedPlanDay[]) => void;
  onEditDayExercises: (day: GeneratedPlanDay, dayIndex: number) => void;
  onBack: () => void;
}

export function S24CustomPlanSetupScreen({
  planName,
  onChangePlanName,
  days,
  onChangeDays,
  onSavePlan,
  onEditDayExercises,
  onBack,
}: S24CustomPlanSetupScreenProps) {
  const defaultDays: GeneratedPlanDay[] = [
    { weekday: 1, is_rest: false, name: 'Upper Body', exercises: [], about_minutes: 60 },
    { weekday: 2, is_rest: false, name: 'Lower Body', exercises: [], about_minutes: 60 },
    { weekday: 3, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
    { weekday: 4, is_rest: false, name: 'Push', exercises: [], about_minutes: 60 },
    { weekday: 5, is_rest: false, name: 'Pull', exercises: [], about_minutes: 60 },
    { weekday: 6, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
    { weekday: 7, is_rest: true, name: 'Rest Day', exercises: [], about_minutes: 0 },
  ];

  const [localPlanName, setLocalPlanName] = useState('My Custom Plan');
  const [localDays, setLocalDays] = useState<GeneratedPlanDay[]>(defaultDays);

  const activePlanName = planName !== undefined ? planName : localPlanName;
  const setEffectivePlanName = onChangePlanName || setLocalPlanName;

  const activeDays = days !== undefined ? days : localDays;
  const setEffectiveDays = (
    updater: GeneratedPlanDay[] | ((prev: GeneratedPlanDay[]) => GeneratedPlanDay[]),
  ) => {
    if (onChangeDays) {
      if (typeof updater === 'function') {
        const next = updater(activeDays);
        (onChangeDays as (val: GeneratedPlanDay[]) => void)(next);
      } else {
        (onChangeDays as (val: GeneratedPlanDay[]) => void)(updater);
      }
    } else {
      setLocalDays(updater);
    }
  };

  const weekdayNames = [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ];

  const toggleDayRest = (index: number) => {
    setEffectiveDays((prev) => {
      const updated = [...prev];
      const targetDay = updated[index];
      if (!targetDay) return prev;
      const isRest = !targetDay.is_rest;
      updated[index] = {
        ...targetDay,
        is_rest: isRest,
        name: isRest ? 'Rest Day' : `Workout ${index + 1}`,
        exercises: isRest ? [] : targetDay.exercises,
      };
      return updated;
    });
  };

  const trainingDays = activeDays.filter((d) => !d.is_rest);
  const isValid =
    activePlanName.trim().length > 0 &&
    trainingDays.length > 0 &&
    trainingDays.every((d) => d.name.trim().length > 0 && d.exercises.length > 0);

  return (
    <View style={styles.screenContainer} testID="s24-custom-plan-setup-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="custom-plan-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <Text style={styles.headerTitle}>Build custom plan</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Plan Name */}
        <Text style={styles.fieldLabel}>PLAN NAME</Text>
        <TextInput
          value={activePlanName}
          onChangeText={setEffectivePlanName}
          placeholder="e.g. 4-Day Strength Routine"
          placeholderTextColor={workoutTokens.dim}
          style={styles.textInput}
          testID="custom-plan-name-input"
        />

        {/* 7 Days List */}
        <Text style={[styles.fieldLabel, { marginTop: 24 }]}>WEEKLY SCHEDULE</Text>
        <View style={styles.daysList}>
          {activeDays.map((day, idx) => {
            return (
              <View key={day.weekday} style={styles.dayCard}>
                <View style={styles.dayTopRow}>
                  <Text style={styles.weekdayText}>{weekdayNames[day.weekday - 1]}</Text>
                  <View style={styles.restToggleGroup}>
                    <Text style={styles.restToggleText}>
                      {day.is_rest ? 'Rest day' : 'Training'}
                    </Text>
                    <WorkoutToggle
                      value={!day.is_rest}
                      onValueChange={() => toggleDayRest(idx)}
                      testID={`day-toggle-${day.weekday}`}
                    />
                  </View>
                </View>

                {!day.is_rest ? (
                  <Pressable
                    testID={`configure-day-${day.weekday}`}
                    accessibilityRole="button"
                    accessibilityLabel={`Configure ${day.name}, ${day.exercises.length} exercises`}
                    onPress={() => onEditDayExercises(day, idx)}
                    style={styles.dayConfigRow}
                  >
                    <View style={styles.dayConfigInfo}>
                      <Text style={styles.dayWorkoutName}>{day.name}</Text>
                      <Text style={styles.dayExerciseCount}>
                        {day.exercises.length} exercise{day.exercises.length === 1 ? '' : 's'}{' '}
                        configured
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={workoutTokens.dim} />
                  </Pressable>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Save CTA */}
      <StickyCtaBar>
        <PrimaryButton
          label="Save plan"
          onPress={() => onSavePlan(activePlanName.trim(), activeDays)}
          disabled={!isValid}
          testID="save-custom-plan-btn"
        />
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 110,
  },
  fieldLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  textInput: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 14,
    height: 48,
    color: workoutTokens.text,
    fontSize: 15,
  },
  daysList: {
    gap: 10,
  },
  dayCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
  },
  dayTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  weekdayText: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  restToggleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  restToggleText: {
    color: workoutTokens.dim,
    fontSize: 13,
  },
  dayConfigRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: workoutTokens.inset,
  },
  dayConfigInfo: {
    flex: 1,
  },
  dayWorkoutName: {
    color: workoutTokens.accent,
    fontSize: 15,
    fontWeight: '700',
  },
  dayExerciseCount: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  scrollSpacer: {
    height: 40,
  },
});
