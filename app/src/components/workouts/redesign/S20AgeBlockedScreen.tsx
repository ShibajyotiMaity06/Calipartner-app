import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, StickyCtaBar } from '../s_common';

interface S20AgeBlockedScreenProps {
  onAcknowledge: () => void;
}

export function S20AgeBlockedScreen({ onAcknowledge }: S20AgeBlockedScreenProps) {
  return (
    <View style={styles.screenContainer} testID="s20-age-blocked-screen">
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="shield-outline" size={32} color={workoutTokens.accent} />
        </View>

        <Text style={styles.title}>Age requirement</Text>
        <Text style={styles.subtitle}>
          The AI Workout Plan builder is only available for athletes 18 years of age and older.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            You can still track custom workouts and build your own manual weekly routines anytime
            using the Custom Plan builder.
          </Text>
        </View>
      </View>

      <StickyCtaBar>
        <PrimaryButton label="Understood" onPress={onAcknowledge} testID="age-blocked-btn" />
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
    backgroundColor: workoutTokens.card,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
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
    marginBottom: 24,
  },
  infoCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 18,
  },
  infoText: {
    color: workoutTokens.dim,
    fontSize: 14,
    lineHeight: 20,
  },
});
