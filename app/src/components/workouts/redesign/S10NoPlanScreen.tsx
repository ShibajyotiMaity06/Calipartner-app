import React from 'react';
import { StyleSheet, Text, View, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, SecondaryButton, TextButton } from '../s_common';

interface S10NoPlanScreenProps {
  onBuildWithAi: () => void;
  onBuildMyOwn: () => void;
  onLogOneOff: () => void;
}

export function S10NoPlanScreen({
  onBuildWithAi,
  onBuildMyOwn,
  onLogOneOff,
}: S10NoPlanScreenProps) {
  return (
    <ScrollView
      contentContainerStyle={styles.container}
      showsVerticalScrollIndicator={false}
      testID="s10-no-plan-screen"
    >
      <Text style={styles.heading}>Let's set up your week</Text>

      {/* Card 1: Build with AI */}
      <View style={styles.aiCard}>
        <View style={styles.cardTopRow}>
          <View style={styles.iconCircle}>
            <Ionicons name="sparkles" size={22} color={workoutTokens.accent} />
          </View>
          <View style={styles.recBadge}>
            <Text style={styles.recBadgeText}>Pro</Text>
          </View>
        </View>

        <Text style={styles.cardTitle}>Build with AI</Text>
        <Text style={styles.cardBody}>
          Get a balanced weekly routine based on your schedule, equipment and goals. Takes about a
          minute.
        </Text>

        <PrimaryButton
          label="Start"
          onPress={onBuildWithAi}
          style={styles.cardButton}
          testID="no-plan-ai-start-btn"
        />
      </View>

      {/* Card 2: Build my own */}
      <View style={styles.customCard}>
        <View style={styles.iconCircle}>
          <Ionicons name="create-outline" size={22} color={workoutTokens.dim} />
        </View>

        <Text style={styles.cardTitle}>Build my own</Text>
        <Text style={styles.cardBody}>
          Pick your training days and select exercises from scratch.
        </Text>

        <SecondaryButton
          label="Start"
          onPress={onBuildMyOwn}
          style={styles.cardButton}
          testID="no-plan-custom-start-btn"
        />
      </View>

      {/* One-off activity */}
      <View style={styles.oneOffSection}>
        <TextButton
          label="Or log a one-off workout"
          onPress={onLogOneOff}
          testID="no-plan-one-off-btn"
        />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
  },
  heading: {
    color: workoutTokens.text,
    fontSize: 24,
    fontWeight: '800',
    marginBottom: 20,
  },
  aiCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1.5,
    borderColor: workoutTokens.accent,
    padding: 22,
    marginBottom: 16,
  },
  customCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.cardLg,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 22,
    marginBottom: 20,
  },
  cardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: workoutRadius.circleMedium,
    backgroundColor: workoutTokens.inset,
    alignItems: 'center',
    justifyContent: 'center',
  },
  recBadge: {
    backgroundColor: workoutTokens.selected,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: workoutRadius.chip,
    borderWidth: 1,
    borderColor: workoutTokens.borderStrong,
  },
  recBadgeText: {
    color: workoutTokens.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  cardTitle: {
    color: workoutTokens.text,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 8,
  },
  cardBody: {
    color: workoutTokens.muted,
    fontSize: 14,
    lineHeight: 20,
    marginTop: 6,
    marginBottom: 18,
  },
  cardButton: {
    height: 48,
  },
  oneOffSection: {
    alignItems: 'center',
    marginTop: 8,
  },
});
