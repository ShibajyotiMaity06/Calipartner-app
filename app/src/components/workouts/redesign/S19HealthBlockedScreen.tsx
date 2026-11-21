import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, StickyCtaBar } from '../s_common';

interface S19HealthBlockedScreenProps {
  onAcknowledge: () => void;
}

export function S19HealthBlockedScreen({ onAcknowledge }: S19HealthBlockedScreenProps) {
  return (
    <View style={styles.screenContainer} testID="s19-health-blocked-screen">
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Ionicons name="medical-outline" size={32} color={workoutTokens.danger} />
        </View>

        <Text style={styles.title}>Safety notice</Text>
        <Text style={styles.subtitle}>
          Based on your profile screening (pregnancy, nursing, or medical conditions), automated
          strength plan generation is restricted.
        </Text>

        <View style={styles.infoCard}>
          <Text style={styles.infoText}>
            Please consult your healthcare provider or a certified physical therapist before
            beginning any new training program. You can still use the Custom Plan builder to
            manually log tailored exercises.
          </Text>
        </View>
      </View>

      <StickyCtaBar>
        <PrimaryButton label="Understood" onPress={onAcknowledge} testID="health-blocked-btn" />
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
    borderColor: workoutTokens.danger,
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
