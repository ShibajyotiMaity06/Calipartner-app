import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, SelectableCard, StickyCtaBar } from '../s_common';
import type { AiWorkoutInputs } from '@calipartner/core';

interface S15ExperienceScreenProps {
  experience: AiWorkoutInputs['experience'];
  onSelectExperience: (exp: AiWorkoutInputs['experience']) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function S15ExperienceScreen({
  experience,
  onSelectExperience,
  onContinue,
  onBack,
  onClose,
}: S15ExperienceScreenProps) {
  const experiences: { id: AiWorkoutInputs['experience']; title: string; subtitle: string }[] = [
    {
      id: 'beginner',
      title: 'Beginner',
      subtitle:
        'Under 1 year of consistent lifting. Safe exercise selections and standard set ranges.',
    },
    {
      id: 'intermediate',
      title: 'Intermediate',
      subtitle:
        '1 to 3 years. Comfortable with barbell compounds, varied rep schemes and higher volume.',
    },
    {
      id: 'experienced',
      title: 'Experienced',
      subtitle: '3+ years. High-intensity sets, advanced movements, and heavy compound focus.',
    },
  ];

  return (
    <View style={styles.screenContainer} testID="s15-experience-screen">
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
          <Text style={styles.stepCount}>Step 3 of 6</Text>
          <Text style={styles.headerTitle}>Lifting experience</Text>
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
          <View
            key={step}
            style={[
              styles.progressSegment,
              step <= 3 ? styles.segmentActive : styles.segmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.hintText}>
          How familiar are you with strength training and gym movements?
        </Text>

        {experiences.map((exp) => (
          <SelectableCard
            key={exp.id}
            selected={experience === exp.id}
            onPress={() => onSelectExperience(exp.id)}
            title={exp.title}
            subtitle={exp.subtitle}
            testID={`experience-card-${exp.id}`}
          />
        ))}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Continue */}
      <StickyCtaBar>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!experience}
          testID="experience-continue-btn"
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
  segmentInactive: {
    backgroundColor: workoutTokens.border,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 110,
  },
  hintText: {
    color: workoutTokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 16,
  },
  scrollSpacer: {
    height: 40,
  },
});
