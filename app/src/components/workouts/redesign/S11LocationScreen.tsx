import React from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, SelectableCard, StickyCtaBar } from '../s_common';
import type { AiWorkoutInputs } from '@calipartner/core';

interface S11LocationScreenProps {
  location: AiWorkoutInputs['location'];
  onSelectLocation: (loc: AiWorkoutInputs['location']) => void;
  onContinue: () => void;
  onBack: () => void;
  onClose: () => void;
}

export function S11LocationScreen({
  location,
  onSelectLocation,
  onContinue,
  onBack,
  onClose,
}: S11LocationScreenProps) {
  const locations: { id: AiWorkoutInputs['location']; title: string; subtitle: string }[] = [
    {
      id: 'home',
      title: 'Home / Bodyweight',
      subtitle: 'Bodyweight, resistance bands, and pull-up bar.',
    },
    {
      id: 'basic_gym',
      title: 'Basic Gym / Hotel Gym',
      subtitle: 'Dumbbells, flat bench, and simple cable station.',
    },
    {
      id: 'advanced_gym',
      title: 'Fully Equipped Gym',
      subtitle: 'Barbells, power racks, specialized machines, cables and free weights.',
    },
  ];

  return (
    <View style={styles.screenContainer} testID="s11-location-screen">
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
          <Text style={styles.stepCount}>Step 4 of 6</Text>
          <Text style={styles.headerTitle}>Equipment & location</Text>
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
              step <= 4 ? styles.segmentActive : styles.segmentInactive,
            ]}
          />
        ))}
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.hintText}>
          Where will you be training? We will tailor all exercises to available gear.
        </Text>

        {locations.map((loc) => (
          <SelectableCard
            key={loc.id}
            selected={location === loc.id}
            onPress={() => onSelectLocation(loc.id)}
            title={loc.title}
            subtitle={loc.subtitle}
            testID={`location-card-${loc.id}`}
          />
        ))}

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Continue */}
      <StickyCtaBar>
        <PrimaryButton
          label="Continue"
          onPress={onContinue}
          disabled={!location}
          testID="location-continue-btn"
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
