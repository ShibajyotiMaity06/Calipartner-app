import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, StickyCtaBar } from '../s_common';

interface S16InjuriesNotesScreenProps {
  limitations: string;
  workoutNotes: string;
  onUpdateLimitations: (text: string) => void;
  onUpdateWorkoutNotes: (text: string) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function S16InjuriesNotesScreen({
  limitations,
  workoutNotes,
  onUpdateLimitations,
  onUpdateWorkoutNotes,
  onContinue,
  onBack,
  onClose,
}: S16InjuriesNotesScreenProps) {
  return (
    <View style={styles.screenContainer} testID="s16-injuries-notes-screen">
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
          <Text style={styles.stepCount}>Step 5 of 6</Text>
          <Text style={styles.headerTitle}>Injuries & preferences</Text>
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
              step <= 5 ? styles.segmentActive : styles.segmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Limitations Input */}
        <Text style={styles.fieldLabel}>INJURIES OR PHYSICAL LIMITATIONS (OPTIONAL)</Text>
        <Text style={styles.fieldHint}>
          e.g. "Lower back pain, avoid deadlifts", "Left shoulder impingement". We will filter out
          contra-indicated lifts.
        </Text>
        <TextInput
          value={limitations}
          onChangeText={(txt) => onUpdateLimitations(txt.slice(0, 300))}
          placeholder="Describe any injuries or joints to protect..."
          placeholderTextColor={workoutTokens.dim}
          maxLength={300}
          multiline
          style={[styles.textInput, styles.textArea]}
          testID="limitations-input"
        />
        <Text style={styles.charCount}>{limitations.length}/300</Text>

        {/* Workout Notes Input */}
        <Text style={[styles.fieldLabel, { marginTop: 20 }]}>
          WORKOUT NOTES & PREFERENCES (OPTIONAL)
        </Text>
        <Text style={styles.fieldHint}>
          e.g. "Prefer dumbbells over barbells", "No heavy leg days".
        </Text>
        <TextInput
          value={workoutNotes}
          onChangeText={(txt) => onUpdateWorkoutNotes(txt.slice(0, 200))}
          placeholder="Any extra style or exercise preferences..."
          placeholderTextColor={workoutTokens.dim}
          maxLength={200}
          multiline
          style={[styles.textInput, styles.textArea]}
          testID="workout-notes-input"
        />
        <Text style={styles.charCount}>{workoutNotes.length}/200</Text>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Continue */}
      <StickyCtaBar>
        <PrimaryButton label="Review answers" onPress={onContinue} testID="injuries-continue-btn" />
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
  fieldLabel: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  fieldHint: {
    color: workoutTokens.muted,
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  textInput: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.control,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    paddingHorizontal: 14,
    color: workoutTokens.text,
    fontSize: 15,
  },
  textArea: {
    height: 90,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  charCount: {
    color: workoutTokens.dim,
    fontSize: 11,
    textAlign: 'right',
    marginTop: 4,
  },
  scrollSpacer: {
    height: 40,
  },
});
