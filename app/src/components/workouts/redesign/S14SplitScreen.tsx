import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, SelectableCard, StickyCtaBar } from '../s_common';
import type { AiWorkoutInputs } from '@calipartner/core';

interface S14SplitScreenProps {
  split: AiWorkoutInputs['split'];
  onSelectSplit: (split: AiWorkoutInputs['split']) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function S14SplitScreen({
  split,
  onSelectSplit,
  onContinue,
  onBack,
  onClose,
}: S14SplitScreenProps) {
  const splits: {
    id: AiWorkoutInputs['split'];
    title: string;
    subtitle: string;
    badge?: string;
  }[] = [
    {
      id: 'auto',
      title: 'Auto (Recommended)',
      subtitle: 'Best split selected based on your number of weekly days.',
      badge: 'Recommended',
    },
    {
      id: 'ppl',
      title: 'Push / Pull / Legs',
      subtitle: 'Chest/shoulders/triceps, then back/biceps, then legs.',
    },
    {
      id: 'upper_lower',
      title: 'Upper / Lower',
      subtitle: 'Alternating upper body and lower body sessions.',
    },
    {
      id: 'full_body',
      title: 'Full Body',
      subtitle: 'Compound lifts targeting major muscle groups each workout.',
    },
    {
      id: 'body_part',
      title: 'Body Part Split',
      subtitle: 'Dedicated focus on individual muscle groups per session.',
    },
  ];

  return (
    <View style={styles.screenContainer} testID="s14-split-screen">
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
          <Text style={styles.stepCount}>Step 2 of 6</Text>
          <Text style={styles.headerTitle}>Workout split</Text>
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
              step <= 2 ? styles.segmentActive : styles.segmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.hintText}>
          How would you like to structure your weekly muscle focus?
        </Text>

        {splits.map((s) => (
          <SelectableCard
            key={s.id}
            selected={split === s.id}
            onPress={() => onSelectSplit(s.id)}
            title={s.title}
            subtitle={s.subtitle}
            badge={s.badge}
            testID={`split-card-${s.id}`}
          />
        ))}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Continue */}
      <StickyCtaBar>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!split}
          testID="split-continue-btn"
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
