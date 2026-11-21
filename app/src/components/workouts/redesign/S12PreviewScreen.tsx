import React, { useState } from 'react';
import { StyleSheet, Text, View, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { workoutTokens, workoutRadius } from '@calipartner/ui';
import { PrimaryButton, SecondaryButton, TextButton, StickyCtaBar } from '../s_common';
import type { GeneratedWorkoutPlan } from '@calipartner/core';

interface S12PreviewScreenProps {
  plan: GeneratedWorkoutPlan;
  previewIndex: number; // 1 or 2 (out of 3)
  onTryAgain: () => void;
  onUseThisPlan: () => void;
  onEditAnswers: () => void;
  onClose: () => void;
}

export function S12PreviewScreen({
  plan,
  previewIndex,
  onTryAgain,
  onUseThisPlan,
  onEditAnswers,
  onClose,
}: S12PreviewScreenProps) {
  const [expandedDay, setExpandedDay] = useState<number | null>(null);

  const weekdayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const trainingDays = plan.days.filter((d) => !d.is_rest);

  const remainingTries = 3 - previewIndex;

  return (
    <View style={styles.screenContainer} testID="s12-preview-screen">
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerTitleCol}>
          <Text style={styles.badgeText}>{`Preview ${previewIndex} of 3`}</Text>
          <Text style={styles.headerTitle}>{plan.name}</Text>
        </View>
        <Pressable
          testID="preview-close-btn"
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={onClose}
          style={styles.closeBtn}
        >
          <Ionicons name="close" size={24} color={workoutTokens.text} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.metaRow}>
          <Text style={styles.metaText}>
            {trainingDays.length} workouts · {plan.days.length - trainingDays.length} rest days
          </Text>
          <TextButton label="Edit answers" onPress={onEditAnswers} testID="edit-answers-btn" />
        </View>

        {/* Excluded limitation pills if any */}
        {plan.excluded && plan.excluded.length > 0 ? (
          <View style={styles.excludedBox}>
            <Ionicons name="shield-checkmark-outline" size={18} color={workoutTokens.success} />
            <Text style={styles.excludedText}>
              Protected injuries: excluded {plan.excluded.slice(0, 3).join(', ')}
            </Text>
          </View>
        ) : null}

        {/* 7 Days Preview List */}
        <View style={styles.daysList}>
          {plan.days.map((day) => {
            const isExpanded = expandedDay === day.weekday;
            if (day.is_rest) {
              return (
                <View key={day.weekday} style={styles.restDayCard}>
                  <Text style={styles.restWeekday}>{weekdayNames[day.weekday - 1]}</Text>
                  <Text style={styles.restLabel}>Rest day</Text>
                </View>
              );
            }

            return (
              <View key={day.weekday} style={styles.trainingDayCard}>
                <Pressable
                  testID={`preview-day-${day.weekday}`}
                  accessibilityRole="button"
                  accessibilityLabel={`${weekdayNames[day.weekday - 1]}, ${day.name}, ${day.exercises.length} exercises`}
                  onPress={() => setExpandedDay(isExpanded ? null : day.weekday)}
                  style={styles.dayCardHeader}
                >
                  <View style={styles.dayHeaderInfo}>
                    <Text style={styles.trainingWeekday}>{weekdayNames[day.weekday - 1]}</Text>
                    <Text style={styles.dayName}>{day.name}</Text>
                    <Text style={styles.dayMeta}>
                      {day.exercises.length} exercises · {day.about_minutes} min
                    </Text>
                  </View>
                  <Ionicons
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={workoutTokens.dim}
                  />
                </Pressable>

                {isExpanded ? (
                  <View style={styles.exercisesExpandedList}>
                    {day.exercises.map((ex, exIdx) => (
                      <View key={ex.id || exIdx} style={styles.exerciseRow}>
                        <Text style={styles.exIndex}>{exIdx + 1}</Text>
                        <Text style={styles.exName}>{ex.name}</Text>
                        <Text style={styles.exSetsReps}>
                          {ex.target_sets} × {ex.target_reps}
                        </Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        <View style={styles.scrollSpacer} />
      </ScrollView>

      {/* Sticky Dual CTAs */}
      <StickyCtaBar>
        <PrimaryButton label="Use this plan" onPress={onUseThisPlan} testID="use-this-plan-btn" />
        <SecondaryButton
          label={`Try again (${remainingTries} left)`}
          onPress={onTryAgain}
          style={styles.tryAgainBtn}
          testID="try-again-btn"
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
  },
  headerTitleCol: {
    flex: 1,
  },
  badgeText: {
    color: workoutTokens.accent,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  headerTitle: {
    color: workoutTokens.text,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 2,
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 150,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
  },
  metaText: {
    color: workoutTokens.muted,
    fontSize: 13,
  },
  excludedBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 12,
    gap: 8,
    marginBottom: 14,
  },
  excludedText: {
    color: workoutTokens.dim,
    fontSize: 12,
    flex: 1,
  },
  daysList: {
    gap: 10,
  },
  restDayCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: workoutTokens.borderStrong,
    borderRadius: workoutRadius.row,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  restWeekday: {
    color: workoutTokens.dim,
    fontSize: 13,
    fontWeight: '700',
  },
  restLabel: {
    color: workoutTokens.dim,
    fontSize: 13,
  },
  trainingDayCard: {
    backgroundColor: workoutTokens.card,
    borderRadius: workoutRadius.row,
    borderWidth: 1,
    borderColor: workoutTokens.border,
    padding: 16,
  },
  dayCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dayHeaderInfo: {
    flex: 1,
  },
  trainingWeekday: {
    color: workoutTokens.dim,
    fontSize: 12,
    fontWeight: '700',
  },
  dayName: {
    color: workoutTokens.text,
    fontSize: 16,
    fontWeight: '700',
    marginTop: 2,
  },
  dayMeta: {
    color: workoutTokens.muted,
    fontSize: 12,
    marginTop: 2,
  },
  exercisesExpandedList: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: workoutTokens.border,
    gap: 8,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  exIndex: {
    color: workoutTokens.dim,
    fontSize: 12,
    width: 20,
  },
  exName: {
    color: workoutTokens.text,
    fontSize: 13,
    flex: 1,
  },
  exSetsReps: {
    color: workoutTokens.muted,
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  tryAgainBtn: {
    marginTop: 10,
  },
  scrollSpacer: {
    height: 40,
  },
});
