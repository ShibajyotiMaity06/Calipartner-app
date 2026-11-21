import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, TextButton, WorkoutToggle, WorkoutChip, StickyCtaBar } from '../s_common';
import type { ActiveWorkoutSession } from '@/services/workoutRedesignService';

interface S06WorkoutSummaryScreenProps {
  session: ActiveWorkoutSession;
  weightUnit: 'kg' | 'lbs';
  personalBestsCount: number;
  onSave: (effort: number, useWeightsNextTime: boolean) => void;
  onDiscard: () => void;
}

export function S06WorkoutSummaryScreen({
  session,
  weightUnit,
  personalBestsCount,
  onSave,
  onDiscard,
}: S06WorkoutSummaryScreenProps) {
  const [effort, setEffort] = useState<number>(3); // 1 to 4: Easy, Good, Tough, Max effort
  const [useWeightsNextTime, setUseWeightsNextTime] = useState(true);

  const durationMin = session.started_at
    ? Math.max(1, Math.round((Date.now() - new Date(session.started_at).getTime()) / 60000))
    : 45;

  const totalCompletedSets = session.exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0,
  );
  const totalSets = session.exercises.reduce((acc, ex) => acc + ex.sets.length, 0);

  const totalVolumeKg = session.exercises.reduce((acc, ex) => {
    return (
      acc +
      ex.sets.reduce((sAcc, s) => {
        if (s.completed && s.weight_kg) {
          return sAcc + s.weight_kg * (s.reps || 1);
        }
        return sAcc;
      }, 0)
    );
  }, 0);

  const handleDiscard = () => {
    Alert.alert(
      'Discard workout?',
      'This will delete today’s logged session.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Discard', style: 'destructive', onPress: onDiscard },
      ],
      { cancelable: true },
    );
  };

  const effortOptions = [
    { value: 1, label: 'Easy' },
    { value: 2, label: 'Good' },
    { value: 3, label: 'Tough' },
    { value: 4, label: 'Max effort' },
  ];

  return (
    <View style={styles.screenContainer} testID="s06-workout-summary-screen">
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Summary</Text>
        <TextButton label="Discard" onPress={handleDiscard} testID="summary-discard-btn" />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={styles.workoutName}>{session.name}</Text>
        <Text style={styles.durationSubtitle}>{durationMin} min session</Text>

        {/* Stats Card */}
        <View style={styles.statsCard}>
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>
              {totalCompletedSets}/{totalSets}
            </Text>
            <Text style={styles.statLabel}>Sets Done</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statCol}>
            <Text style={styles.statNumber}>
              {totalVolumeKg > 0 ? `${Math.round(totalVolumeKg)}` : '0'}
            </Text>
            <Text style={styles.statLabel}>Volume ({weightUnit})</Text>
          </View>
          {personalBestsCount > 0 ? (
            <>
              <View style={styles.statDivider} />
              <View style={styles.statCol}>
                <Text style={[styles.statNumber, { color: workoutTokens.success }]}>
                  +{personalBestsCount}
                </Text>
                <Text style={styles.statLabel}>Personal Bests</Text>
              </View>
            </>
          ) : null}
        </View>

        {/* Feeling Chips */}
        <View style={styles.sectionBox}>
          <Text style={styles.sectionTitle}>How did it feel?</Text>
          <View style={styles.chipsRow}>
            {effortOptions.map((opt) => (
              <WorkoutChip
                key={opt.value}
                label={opt.label}
                selected={effort === opt.value}
                onPress={() => setEffort(opt.value)}
                testID={`effort-chip-${opt.value}`}
              />
            ))}
          </View>
        </View>

        {/* Toggle */}
        <View style={styles.toggleRow}>
          <View style={styles.toggleTextCol}>
            <Text style={styles.toggleTitle}>Use these weights next time</Text>
            <Text style={styles.toggleSubtitle}>
              Update target weights on your plan for these exercises
            </Text>
          </View>
          <WorkoutToggle
            value={useWeightsNextTime}
            onValueChange={setUseWeightsNextTime}
            testID="use-weights-next-time-toggle"
          />
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Save CTA */}
      <StickyCtaBar>
        <PrimaryButton
          label="Save workout"
          onPress={() => onSave(effort, useWeightsNextTime)}
          testID="summary-save-btn"
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
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: workoutTokens.border,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 110,
  },
  workoutName: {
    color: workoutTokens.text,
    fontSize: 24,
    fontWeight: '800',
  },
  durationSubtitle: {
    color: workoutTokens.muted,
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
  },
  statsCard: {
    flexDirection: 'row',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statCol: {
    alignItems: 'center',
  },
  statNumber: {
    color: workoutTokens.text,
    fontSize: 22,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    color: workoutTokens.dim,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: workoutTokens.border,
  },
  sectionBox: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  chipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
    marginBottom: 20,
  },
  toggleTextCol: {
    flex: 1,
    marginRight: 16,
  },
  toggleTitle: {
    color: workoutTokens.text,
    fontSize: 15,
    fontWeight: '700',
  },
  toggleSubtitle: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  scrollSpacer: {
    height: 40,
  },
});
