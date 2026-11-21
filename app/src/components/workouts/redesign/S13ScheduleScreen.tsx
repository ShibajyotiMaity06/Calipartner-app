import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, StepperRow, WorkoutChip, StickyCtaBar } from '../s_common';
import type { AiWorkoutInputs } from '@calipartner/core';

interface S13ScheduleScreenProps {
  inputs: Partial<AiWorkoutInputs>;
  onUpdate: (updates: Partial<AiWorkoutInputs>) => void;
  onContinue: () => void;
  onClose: () => void;
}

export function S13ScheduleScreen({
  inputs,
  onUpdate,
  onContinue,
  onClose,
}: S13ScheduleScreenProps) {
  const daysPerWeek = inputs.days_per_week || 3;
  const trainingDays = inputs.training_days || [1, 3, 5];
  const sessionMinutes = inputs.session_minutes || 60;

  const weekdays = [
    { num: 1, label: 'Mon' },
    { num: 2, label: 'Tue' },
    { num: 3, label: 'Wed' },
    { num: 4, label: 'Thu' },
    { num: 5, label: 'Fri' },
    { num: 6, label: 'Sat' },
    { num: 7, label: 'Sun' },
  ];

  const durations: (30 | 60 | 90 | 120)[] = [30, 60, 90, 120];

  const handleToggleWeekday = (num: number) => {
    let next: number[];
    if (trainingDays.includes(num)) {
      if (trainingDays.length <= 1) return;
      next = trainingDays.filter((d) => d !== num);
    } else {
      if (trainingDays.length >= daysPerWeek) {
        // replace the oldest or rotate
        next = [...trainingDays.slice(1), num];
      } else {
        next = [...trainingDays, num];
      }
    }
    next.sort();
    onUpdate({ training_days: next });
  };

  const handleDaysPerWeekChange = (newCount: number) => {
    let nextTraining = [...trainingDays];
    if (nextTraining.length > newCount) {
      nextTraining = nextTraining.slice(0, newCount);
    } else if (nextTraining.length < newCount) {
      for (const w of weekdays) {
        if (!nextTraining.includes(w.num)) {
          nextTraining.push(w.num);
          if (nextTraining.length === newCount) break;
        }
      }
    }
    nextTraining.sort();
    onUpdate({ days_per_week: newCount, training_days: nextTraining });
  };

  const isValid = trainingDays.length === daysPerWeek;

  return (
    <View style={styles.screenContainer} testID="s13-schedule-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.stepInfoCol}>
          <Text style={styles.stepCount}>Step 1 of 6</Text>
          <Text style={styles.headerTitle}>Your schedule</Text>
        </View>
        <Pressable
          testID="ai-step-close-btn"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={workoutTokens.text} />
        </Pressable>
      </View>

      {/* Progress Bar (6 segments) */}
      <View style={styles.progressBarRow}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View
            key={step}
            style={[
              styles.progressSegment,
              step === 1 ? styles.segmentActive : styles.segmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Days Per Week Stepper */}
        <View style={styles.card}>
          <StepperRow
            label="Days per week"
            value={daysPerWeek}
            onIncrement={() => handleDaysPerWeekChange(Math.min(6, daysPerWeek + 1))}
            onDecrement={() => handleDaysPerWeekChange(Math.max(1, daysPerWeek - 1))}
            testID="days-per-week-stepper"
          />
        </View>

        {/* Training Days Selection */}
        <Text style={styles.sectionHeader}>
          CHOOSE {daysPerWeek} TRAINING DAY{daysPerWeek > 1 ? 'S' : ''}
        </Text>
        <View style={styles.weekdaysRow}>
          {weekdays.map((w) => {
            const isSelected = trainingDays.includes(w.num);
            return (
              <Pressable
                key={w.num}
                testID={`weekday-chip-${w.num}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${w.label}, ${isSelected ? 'selected' : 'not selected'}`}
                onPress={() => handleToggleWeekday(w.num)}
                style={[styles.weekdayBtn, isSelected && styles.weekdayBtnSelected]}
              >
                <Text style={[styles.weekdayLabel, isSelected && styles.weekdayLabelSelected]}>
                  {w.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Duration */}
        <Text style={[styles.sectionHeader, { marginTop: 28 }]}>SESSION DURATION</Text>
        <View style={styles.durationsRow}>
          {durations.map((d) => (
            <WorkoutChip
              key={d}
              label={`${d} min`}
              selected={sessionMinutes === d}
              onPress={() => onUpdate({ session_minutes: d })}
              testID={`duration-chip-${d}`}
            />
          ))}
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Continue */}
      <StickyCtaBar>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!isValid}
          testID="schedule-continue-btn"
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
  },
  stepInfoCol: {
    flex: 1,
  },
  stepCount: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 24,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressBarRow: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    gap: 6,
    marginBottom: 20,
  },
  progressSegment: {
    flex: 1,
    height: 4,
    borderRadius: workoutRadius.dot,
  },
  segmentActive: {
    backgroundColor: workoutTokens.accent,
  },
  segmentInactive: {
    backgroundColor: workoutTokens.border,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  card: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  sectionHeader: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  weekdaysRow: {
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
  },
  weekdayBtn: {
    flex: 1,
    height: 48,
    borderRadius: workoutRadius.control,
    backgroundColor: workoutTokens.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekdayBtnSelected: {
    backgroundColor: workoutTokens.accent,
    borderColor: workoutTokens.accent,
  },
  weekdayLabel: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
  },
  weekdayLabelSelected: {
    color: workoutTokens.onAccent,
  },
  durationsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  scrollSpacer: {
    height: 40,
  },
});
