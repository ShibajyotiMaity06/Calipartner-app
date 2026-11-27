import React from 'react';
import { StyleSheet, Text, View, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';

interface InProgressMiniBarProps {
  elapsedSeconds: number;
  completedSets: number;
  totalSets: number;
  workoutName: string;
  onResume: () => void;
  testID?: string;
}

export function InProgressMiniBar({
  elapsedSeconds,
  completedSets,
  totalSets,
  workoutName,
  onResume,
  testID = 'in-progress-mini-bar',
}: InProgressMiniBarProps) {
  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const s = secs % 60;
    return `${mins}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`Session in progress: ${workoutName}, elapsed ${formatTime(elapsedSeconds)}, ${completedSets} of ${totalSets} sets. Tap to resume.`}
      onPress={onResume}
      style={styles.container}
    >
      <View style={styles.leftCol}>
        <View style={styles.titleRow}>
          <View style={styles.liveDot} />
          <Text style={styles.workoutName}>{workoutName}</Text>
        </View>
        <Text style={styles.statsText}>
          {formatTime(elapsedSeconds)} · {completedSets} of {totalSets} sets
        </Text>
      </View>
      <View style={styles.resumeBtn}>
        <Text style={styles.resumeText}>Resume</Text>
        <Ionicons name="chevron-forward" size={16} color={workoutTokens.onAccent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 24,
    height: 64,
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.card,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  leftCol: {
    flex: 1,
    marginRight: 12,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: workoutRadius.indicator,
    backgroundColor: workoutTokens.accent,
  },
  workoutName: {
    color: workoutTokens.text,
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  statsText: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  resumeBtn: {
    backgroundColor: workoutTokens.accent,
    paddingHorizontal: 14,
    height: 36,
    borderRadius: workoutRadius.chip,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resumeText: {
    color: workoutTokens.onAccent,
    fontSize: 13,
    fontWeight: '800',
  },
});
