import React, { useState } from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { WorkoutToggle, SecondaryButton, StickyCtaBar } from '../s_common';
import { calculateDaysRemaining } from '@calipartner/core';

interface S21LockedScreenProps {
  nextAvailableAt: string | null;
  onBack: () => void;
}

export function S21LockedScreen({ nextAvailableAt, onBack }: S21LockedScreenProps) {
  const [notifyReminder, setNotifyReminder] = useState(false);

  const unlockDate = nextAvailableAt ? new Date(nextAvailableAt) : new Date();
  const daysLeft = calculateDaysRemaining(new Date(), unlockDate);

  const formattedUnlockDate = unlockDate.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  // Calculate progress over 90 days
  const progressPercent = Math.min(100, Math.max(0, Math.round(((90 - daysLeft) / 90) * 100)));

  return (
    <View style={styles.screenContainer} testID="s21-locked-screen">
      {/* Header */}
      <View style={styles.header}>
        <Pressable
          testID="locked-back-btn"
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={onBack}
          style={styles.backBtn}
        >
          <Ionicons name="arrow-back" size={24} color={workoutTokens.text} />
        </Pressable>
        <Text style={styles.headerTitle}>AI Plan Rebuild</Text>
        <View style={styles.headerSpacer} />
      </View>

      <View style={styles.content}>
        <View style={styles.lockCircle}>
          <Ionicons name="lock-closed" size={32} color={workoutTokens.accent} />
        </View>

        <Text style={styles.daysCount}>{daysLeft} days remaining</Text>
        <Text style={styles.unlockDateText}>Unlocks on {formattedUnlockDate}</Text>

        {/* Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={[styles.progressBarFill, { width: `${progressPercent}%` }]} />
        </View>

        {/* Explainer card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Why is there a cooldown?</Text>
          <Text style={styles.cardBody}>
            Progressive overload requires consistency. Sticking with a balanced program for at least
            3 months allows your muscles and tendons to adapt before switching routines.
          </Text>

          <View style={styles.divider} />

          <View style={styles.toggleRow}>
            <View style={styles.toggleTextCol}>
              <Text style={styles.toggleTitle}>Remind me when ready</Text>
              <Text style={styles.toggleSubtitle}>Receive a push notification on unlock</Text>
            </View>
            <WorkoutToggle
              value={notifyReminder}
              onValueChange={setNotifyReminder}
              testID="remind-rebuild-toggle"
            />
          </View>
        </View>
      </View>

      <StickyCtaBar>
        <SecondaryButton label="Back to Plan" onPress={onBack} testID="locked-close-btn" />
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
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 17,
    fontWeight: '800',
  },
  headerSpacer: {
    width: 44,
  },
  content: {
    paddingHorizontal: 24,
    alignItems: 'center',
    paddingTop: 20,
  },
  lockCircle: {
    width: 64,
    height: 64,
    borderRadius: workoutRadius.circleLarge,
    backgroundColor: workoutTokens.inset,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  daysCount: {
    color: workoutTokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  unlockDateText: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 24,
  },
  progressContainer: {
    width: '100%',
    height: 6,
    backgroundColor: workoutTokens.inset,
    borderRadius: workoutRadius.bar,
    marginBottom: 28,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: workoutTokens.accent,
  },
  card: {
    width: '100%',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 18,
  },
  cardTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  cardBody: {
    color: workoutTokens.dim,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 6,
  },
  divider: {
    height: 1,
    backgroundColor: workoutTokens.border,
    marginVertical: 14,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 12,
  },
  toggleTitle: {
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: workoutTokens.dim,
    fontSize: 12,
    marginTop: 2,
  },
});
