import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface S18GeneratingScreenProps {
  onGenerationComplete: () => void;
}

export function S18GeneratingScreen({ onGenerationComplete }: S18GeneratingScreenProps) {
  const [currentStep, setCurrentStep] = useState(0);

  const steps = [
    'Analyzing schedule & equipment',
    'Balancing muscle recovery volume',
    'Filtering injury contraindications',
    'Finalizing weekly plan structure',
  ];

  useEffect(() => {
    const timer1 = setTimeout(() => setCurrentStep(1), 700);
    const timer2 = setTimeout(() => setCurrentStep(2), 1400);
    const timer3 = setTimeout(() => setCurrentStep(3), 2100);
    const timerDone = setTimeout(() => onGenerationComplete(), 2800);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
      clearTimeout(timerDone);
    };
  }, [onGenerationComplete]);

  return (
    <View style={styles.screenContainer} testID="s18-generating-screen">
      <View style={styles.iconCircle}>
        <ActivityIndicator size="large" color={workoutTokens.accent} />
      </View>

      <Text style={styles.title}>Building your plan...</Text>
      <Text style={styles.subtitle}>
        Tailoring your routine to your training days, experience and equipment.
      </Text>

      {/* 4 Steps Checklist */}
      <View style={styles.stepsContainer}>
        {steps.map((st, idx) => {
          const isDone = currentStep > idx;
          const isCurrent = currentStep === idx;
          return (
            <View key={st} style={styles.stepRow}>
              <View
                style={[styles.dotCircle, isDone && styles.dotDone, isCurrent && styles.dotCurrent]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={14} color={workoutTokens.onAccent} />
                ) : null}
              </View>
              <Text
                style={[
                  styles.stepText,
                  isDone && styles.stepTextDone,
                  isCurrent && styles.stepTextCurrent,
                ]}
              >
                {st}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screenContainer: {
    flex: 1,
    backgroundColor: workoutTokens.background,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: workoutRadius.circleLarge,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  title: {
    color: workoutTokens.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  subtitle: {
    color: workoutTokens.muted,
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 20,
    marginTop: 8,
    marginBottom: 32,
  },
  stepsContainer: {
    width: '100%',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 20,
    gap: 16,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  dotCircle: {
    width: 22,
    height: 22,
    borderRadius: workoutRadius.badge,
    borderWidth: 1.5,
    borderColor: workoutTokens.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: {
    backgroundColor: workoutTokens.accent,
    borderColor: workoutTokens.accent,
  },
  dotCurrent: {
    borderColor: workoutTokens.accent,
  },
  stepText: {
    color: workoutTokens.dim,
    fontSize: 14,
    flex: 1,
  },
  stepTextDone: {
    color: workoutTokens.text,
  },
  stepTextCurrent: {
    color: workoutTokens.accent,
    fontWeight: '700',
  },
});
