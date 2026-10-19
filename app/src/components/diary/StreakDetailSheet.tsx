import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet, Text, dark, space, radius } from '@calipartner/ui';

export interface StreakDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  currentStreak: number;
  longestStreak: number;
  freezesRemaining?: number;
}

export function StreakDetailSheet({
  visible,
  onClose,
  currentStreak,
  longestStreak,
  freezesRemaining = 1,
}: StreakDetailSheetProps) {
  const totalGridDots = 28;
  const dots = Array.from({ length: totalGridDots }, (_, i) => {
    const dayFromEnd = totalGridDots - 1 - i;
    const isCompleted = dayFromEnd < currentStreak;
    return { index: i, isCompleted };
  });

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="half"
      testID="sheet-streak-detail"
      accessibilityLabel={`Streak details: current streak ${currentStreak} days, longest ${longestStreak} days`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        {/* Header with Flame icon */}
        <View style={styles.header}>
          <View style={styles.flameCircle}>
            <Ionicons name="flame" size={32} color={dark.apricot} />
          </View>
          <Text variant="numeralL" color={dark.textHi}>
            {currentStreak}
          </Text>
          <Text variant="body" color={dark.textMid}>
            Day Streak
          </Text>
        </View>

        {/* Stats Row */}
        <View style={styles.statsCard}>
          <View style={styles.statColumn}>
            <Text variant="label" color={dark.textLo}>
              CURRENT
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {currentStreak}{' '}
              <Text variant="bodyS" color={dark.textMid}>
                days
              </Text>
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.statColumn}>
            <Text variant="label" color={dark.textLo}>
              LONGEST
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {longestStreak}{' '}
              <Text variant="bodyS" color={dark.textMid}>
                days
              </Text>
            </Text>
          </View>
        </View>

        {/* 28-Day Grid */}
        <View style={styles.gridSection}>
          <Text variant="label" color={dark.textLo} style={styles.gridTitle}>
            LAST 28 DAYS
          </Text>
          <View style={styles.gridContainer}>
            {dots.map((d) => (
              <View
                key={d.index}
                testID={`streak-dot-${d.index}`}
                style={[styles.dot, d.isCompleted ? styles.dotFilled : styles.dotOpen]}
              />
            ))}
          </View>
        </View>

        {/* Streak Freeze Card (STR-4, P1) */}
        <View style={styles.freezeCard} testID="card-streak-freeze">
          <View style={styles.freezeHeader}>
            <Ionicons name="shield-checkmark-outline" size={20} color={dark.teal} />
            <Text variant="body" color={dark.textHi} style={{ fontWeight: '600' }}>
              Streak Freeze Protection
            </Text>
          </View>
          <Text variant="bodyS" color={dark.textMid}>
            One freeze a week protects a day you miss. You have {freezesRemaining} freeze available.
          </Text>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    paddingBottom: space[6],
    gap: space[4],
  },
  header: {
    alignItems: 'center',
    gap: space[1],
  },
  flameCircle: {
    width: 64,
    height: 64,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    marginBottom: space[2],
  },
  statsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  statColumn: {
    alignItems: 'center',
    gap: space[1],
  },
  divider: {
    width: 1,
    height: 36,
    backgroundColor: dark.hairlineLit,
  },
  gridSection: {
    gap: space[2],
  },
  gridTitle: {
    letterSpacing: 1,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
    justifyContent: 'center',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: radius.full,
  },
  dotFilled: {
    backgroundColor: dark.apricot,
  },
  dotOpen: {
    borderWidth: 1.5,
    borderColor: dark.hairlineLit,
    backgroundColor: 'transparent',
  },
  freezeCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[1],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  freezeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
});
