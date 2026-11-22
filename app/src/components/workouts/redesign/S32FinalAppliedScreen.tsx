import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, StickyCtaBar } from '../s_common';
import type { GeneratedWorkoutPlan } from '@calipartner/core';

interface S32FinalAppliedScreenProps {
  plan: GeneratedWorkoutPlan;
  onDone: () => void;
}

export function S32FinalAppliedScreen({ plan, onDone }: S32FinalAppliedScreenProps) {
  const trainingCount = plan.days.filter((d) => !d.is_rest).length;

  return (
    <View style={styles.screenContainer} testID="s32-final-applied-screen">
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="checkmark" size={32} color={workoutTokens.onAccent} />
        </View>

        <Text style={styles.title}>Plan applied!</Text>
        <Text style={styles.subtitle}>Your plan is saved and active for this week.</Text>

        <View style={styles.planCard}>
          <Text style={styles.planName}>{plan.name}</Text>
          <Text style={styles.planMeta}>{trainingCount} workouts per week · Repeats weekly</Text>
        </View>
      </View>

      <StickyCtaBar>
        <PrimaryButton label="Go to Today" onPress={onDone} testID="final-applied-done-btn" />
      </StickyCtaBar>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: workoutRadius.circleLarge,
    backgroundColor: workoutTokens.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: workoutTokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  subtitle: {
    color: workoutTokens.muted,
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 8,
    marginBottom: 28,
  },
  planCard: {
    width: '100%',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 20,
    alignItems: 'center',
  },
  planName: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '700',
  },
  planMeta: {
    color: workoutTokens.muted,
    fontSize: 13,
    marginTop: 4,
  },
});
