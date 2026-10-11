import React from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSummary, WorkoutWithDetails } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface WorkoutFinishSummaryModalProps {
  visible: boolean;
  workout: WorkoutWithDetails | null;
  summary: WorkoutSummary | null;
  onClose: () => void;
  testID?: string;
}

export function WorkoutFinishSummaryModal({
  visible,
  workout,
  summary,
  onClose,
  testID = 'workout-finish-summary-modal',
}: WorkoutFinishSummaryModalProps) {
  const { colors } = useTheme();

  if (!workout || !summary) return null;

  return (
    <Modal
      testID={testID}
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        {/* Header */}
        <View
          style={[
            styles.header,
            { backgroundColor: colors.surface, borderBottomColor: colors.border },
          ]}
        >
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {t('workouts.summary.completeTitle')}
          </Text>
          <TouchableOpacity
            testID={`${testID}-btn-close`}
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={24} color={colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {/* Hero Celebration Card */}
          <View
            style={[
              styles.heroCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <View
              style={[
                styles.iconWrap,
                { backgroundColor: colors.cardHighlight },
              ]}
            >
              <Ionicons name="trophy" size={36} color={colors.accent} />
            </View>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              {workout.name || t(`workouts.types.${workout.type}` as const)}
            </Text>
            <Text style={[styles.heroSubtitle, { color: colors.textMuted }]}>
              {t('workouts.summary.summarySubtitle')}
            </Text>
          </View>

          {/* Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Duration */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="time-outline" size={22} color={colors.accent} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {t('workouts.summary.duration')}
              </Text>
              <Text
                testID={`${testID}-stat-duration`}
                style={[styles.metricValue, { color: colors.text }]}
              >
                {workout.duration_minutes} min
              </Text>
            </View>

            {/* Total Volume */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="barbell-outline" size={22} color={colors.macroCalories} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {t('workouts.summary.volume')}
              </Text>
              <Text
                testID={`${testID}-stat-volume`}
                style={[styles.metricValue, { color: colors.text }]}
              >
                {summary.total_volume_kg > 0
                  ? `${summary.total_volume_kg.toLocaleString()} kg`
                  : '—'}
              </Text>
            </View>

            {/* Sets Completed */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Ionicons name="checkmark-done-circle-outline" size={22} color={colors.syncSynced} />
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {t('workouts.summary.setsCompleted')}
              </Text>
              <Text
                testID={`${testID}-stat-sets`}
                style={[styles.metricValue, { color: colors.text }]}
              >
                {summary.total_sets}
              </Text>
            </View>

            {/* Estimated Calories */}
            <View
              style={[
                styles.metricCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.calorieHeaderRow}>
                <Ionicons name="flame-outline" size={20} color={colors.macroCalories} />
                <View
                  style={[
                    styles.estimateBadge,
                    { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
                  ]}
                >
                  <Text style={[styles.estimateBadgeText, { color: colors.accent }]}>
                    {t('workouts.calorieEstimateBadge')}
                  </Text>
                </View>
              </View>
              <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                {t('workouts.estimatedCalories')}
              </Text>
              <Text
                testID={`${testID}-stat-calories`}
                style={[styles.metricValue, { color: colors.text }]}
              >
                {summary.estimated_calories} kcal
              </Text>
            </View>
          </View>

          {/* PRD Informational Calorie Disclaimer Banner */}
          <View
            style={[
              styles.disclaimerCard,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="information-circle-outline" size={20} color={colors.textMuted} />
            <Text style={[styles.disclaimerText, { color: colors.textMuted }]}>
              {t('workouts.calorieEstimateDisclaimer')}
            </Text>
          </View>

          {/* Exercise Breakdown List */}
          {summary.exercise_summaries && summary.exercise_summaries.length > 0 && (
            <View
              style={[
                styles.breakdownCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sectionTitle, { color: colors.text }]}>
                {t('workouts.exercises.title')}
              </Text>
              {summary.exercise_summaries.map((ex, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.exerciseRow,
                    {
                      borderTopColor: colors.border,
                      borderTopWidth: idx > 0 ? 0.5 : 0,
                    },
                  ]}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={[styles.exerciseRowName, { color: colors.text }]}>
                      {ex.exercise_name}
                    </Text>
                    <Text style={[styles.exerciseRowSub, { color: colors.textMuted }]}>
                      {ex.set_count} sets{ex.heaviest_weight_kg ? ` • max ${ex.heaviest_weight_kg} kg` : ''}
                    </Text>
                  </View>
                  {ex.total_volume_kg > 0 && (
                    <Text style={[styles.exerciseRowVolume, { color: colors.text }]}>
                      {ex.total_volume_kg} kg
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Done Button */}
          <TouchableOpacity
            testID={`${testID}-btn-done`}
            style={[styles.doneBtn, { backgroundColor: colors.accent }]}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.summary.doneBtn')}
          >
            <Text style={[styles.doneBtnText, { color: colors.onAccent }]}>
              {t('workouts.summary.doneBtn')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingTop: 54,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  closeBtn: {
    padding: 6,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 40,
  },
  heroCard: {
    alignItems: 'center',
    padding: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 6,
  },
  iconWrap: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  heroTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: fontSize.sm,
    textAlign: 'center',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  metricLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  metricValue: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    fontVariant: ['tabular-nums'],
  },
  calorieHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estimateBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderWidth: 0.5,
  },
  estimateBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  disclaimerText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 16,
  },
  breakdownCard: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  sectionTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    marginBottom: 4,
  },
  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
  },
  exerciseInfo: {
    gap: 2,
  },
  exerciseRowName: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  exerciseRowSub: {
    fontSize: fontSize.xs,
  },
  exerciseRowVolume: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  doneBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  doneBtnText: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
});
