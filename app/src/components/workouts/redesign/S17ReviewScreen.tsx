import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, TextButton, StickyCtaBar } from '../s_common';
import type { AiWorkoutInputs } from '@calipartner/core';

interface S17ReviewScreenProps {
  inputs: AiWorkoutInputs;
  onEditStep: (step: number) => void;
  onGenerate: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function S17ReviewScreen({
  inputs,
  onEditStep,
  onGenerate,
  onBack,
  onClose,
}: S17ReviewScreenProps) {
  const weekdayShort = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const formattedDays = inputs.training_days.map((d) => weekdayShort[d - 1]).join(', ');

  const splitNames: Record<string, string> = {
    auto: 'Auto (Recommended)',
    ppl: 'Push / Pull / Legs',
    upper_lower: 'Upper / Lower',
    full_body: 'Full Body',
    body_part: 'Body Part Split',
  };

  const experienceNames: Record<string, string> = {
    beginner: 'Beginner',
    intermediate: 'Intermediate',
    experienced: 'Experienced',
  };

  const locationNames: Record<string, string> = {
    home: 'Home / Bodyweight',
    basic_gym: 'Basic Gym / Hotel Gym',
    advanced_gym: 'Fully Equipped Gym',
  };

  return (
    <View style={styles.screenContainer} testID="s17-review-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="ai-step-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.headerBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <View style={styles.stepInfoCol}>
          <Text style={styles.stepCount}>Step 6 of 6</Text>
          <Text style={styles.headerTitle}>Review summary</Text>
        </View>
        <Pressable
          testID="ai-step-close-btn"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.headerBtn}
        >
          <Ionicons name="close" size={24} color={workoutTokens.text} />
        </Pressable>
      </View>

      {/* Progress Bar */}
      <View style={styles.progressBarRow}>
        {[1, 2, 3, 4, 5, 6].map((step) => (
          <View key={step} style={[styles.progressSegment, styles.segmentActive]} />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          Here is what we will use to generate your custom routine.
        </Text>

        {/* Schedule */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardCategory}>SCHEDULE</Text>
            <TextButton label="Edit" onPress={() => onEditStep(1)} testID="edit-schedule-btn" />
          </View>
          <Text style={styles.cardMain}>
            {inputs.days_per_week} days / week ({formattedDays})
          </Text>
          <Text style={styles.cardDetail}>{inputs.session_minutes} min per workout</Text>
        </View>

        {/* Split */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardCategory}>SPLIT</Text>
            <TextButton label="Edit" onPress={() => onEditStep(2)} testID="edit-split-btn" />
          </View>
          <Text style={styles.cardMain}>{splitNames[inputs.split] || inputs.split}</Text>
        </View>

        {/* Experience & Equipment */}
        <View style={styles.reviewCard}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardCategory}>EXPERIENCE & GEAR</Text>
            <TextButton label="Edit" onPress={() => onEditStep(3)} testID="edit-exp-btn" />
          </View>
          <Text style={styles.cardMain}>
            {experienceNames[inputs.experience] || inputs.experience}
          </Text>
          <Text style={styles.cardDetail}>{locationNames[inputs.location] || inputs.location}</Text>
        </View>

        {/* Limitations */}
        {inputs.limitations || inputs.workout_notes ? (
          <View style={styles.reviewCard}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardCategory}>NOTES & LIMITATIONS</Text>
              <TextButton label="Edit" onPress={() => onEditStep(5)} testID="edit-notes-btn" />
            </View>
            {inputs.limitations ? (
              <Text style={styles.cardDetail}>Limitations: {inputs.limitations}</Text>
            ) : null}
            {inputs.workout_notes ? (
              <Text style={styles.cardDetail}>Notes: {inputs.workout_notes}</Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Generate Button */}
      <StickyCtaBar>
        <PrimaryButton
          label="Generate weekly plan"
          onPress={onGenerate}
          testID="generate-plan-btn"
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
  headerBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepInfoCol: {
    flex: 1,
    alignItems: 'center',
  },
  stepCount: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 2,
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
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  subtitle: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginBottom: 16,
  },
  reviewCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 12,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  cardCategory: {
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  cardMain: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
  },
  cardDetail: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 3,
  },
  scrollSpacer: {
    height: 40,
  },
});
