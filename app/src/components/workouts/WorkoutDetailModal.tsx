import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutWithDetails } from '@calipartner/core';
import { useWorkouts } from '@/hooks/useWorkouts';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { WorkoutLoggerModal } from './WorkoutLoggerModal';

interface WorkoutDetailModalProps {
  visible: boolean;
  workout: WorkoutWithDetails | null;
  onClose: () => void;
  onDeleted?: (workoutId: string) => void;
  onUpdated?: (workout: WorkoutWithDetails) => void;
  testID?: string;
}

export function WorkoutDetailModal({
  visible,
  workout,
  onClose,
  onDeleted,
  onUpdated,
  testID = 'workout-detail-modal',
}: WorkoutDetailModalProps) {
  const { colors } = useTheme();
  const todayDate = new Date().toISOString().split('T')[0]!;

  const { remove, copyToDate, getSummary } = useWorkouts(
    workout?.local_date ?? todayDate,
  );

  const [isEditing, setIsEditing] = useState(false);
  const [repeating, setRepeating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [repeatSuccessMessage, setRepeatSuccessMessage] = useState<string | null>(
    null,
  );

  if (!workout) return null;

  const summary = getSummary(workout);

  const handleRepeatToday = async () => {
    try {
      setRepeating(true);
      await copyToDate(workout.id, todayDate);
      setRepeatSuccessMessage(t('workouts.repeatSuccess'));
      setTimeout(() => {
        setRepeatSuccessMessage(null);
        onClose();
      }, 1200);
    } catch (e) {
      Alert.alert(t('common.errorTitle'), e instanceof Error ? e.message : String(e));
    } finally {
      setRepeating(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      t('workouts.details.confirmDeleteTitle'),
      t('workouts.details.confirmDeleteBody'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            try {
              setDeleting(true);
              await remove(workout.id);
              if (onDeleted) onDeleted(workout.id);
              onClose();
            } catch (e) {
              Alert.alert(
                t('common.errorTitle'),
                e instanceof Error ? e.message : String(e),
              );
            } finally {
              setDeleting(false);
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Modal
        testID={testID}
        visible={visible && !isEditing}
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
            <TouchableOpacity
              testID={`${testID}-btn-close`}
              onPress={onClose}
              style={styles.headerBtn}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.headerTitle, { color: colors.text }]}>
              {t('workouts.details.title')}
            </Text>

            <View style={styles.headerRightActions}>
              <TouchableOpacity
                testID={`${testID}-btn-edit`}
                onPress={() => setIsEditing(true)}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={t('workouts.editWorkout')}
              >
                <Ionicons name="pencil" size={20} color={colors.accent} />
              </TouchableOpacity>
              <TouchableOpacity
                testID={`${testID}-btn-delete`}
                onPress={handleDelete}
                disabled={deleting}
                style={styles.headerBtn}
                accessibilityRole="button"
                accessibilityLabel={t('workouts.deleteWorkout')}
              >
                {deleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Ionicons name="trash-outline" size={20} color={colors.danger} />
                )}
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Success message banner if copied to today */}
            {repeatSuccessMessage && (
              <View
                testID={`${testID}-banner-repeat-success`}
                style={[
                  styles.successBanner,
                  { backgroundColor: colors.cardHighlight, borderColor: colors.syncSynced },
                ]}
              >
                <Ionicons
                  name="checkmark-circle"
                  size={18}
                  color={colors.syncSynced}
                />
                <Text
                  style={[styles.successBannerText, { color: colors.syncSynced }]}
                >
                  {repeatSuccessMessage}
                </Text>
              </View>
            )}

            {/* Workout Overview Card */}
            <View
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <View style={styles.titleRow}>
                <View style={styles.titleInfo}>
                  <Text
                    testID={`${testID}-workout-name`}
                    style={[styles.workoutName, { color: colors.text }]}
                  >
                    {workout.name || t(`workouts.types.${workout.type}` as const)}
                  </Text>
                  <Text style={[styles.dateSub, { color: colors.textMuted }]}>
                    {workout.local_date} • {t(`workouts.types.${workout.type}` as const)}
                  </Text>
                </View>

                {workout.effort_rating && (
                  <View
                    style={[
                      styles.effortBadge,
                      { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                    ]}
                  >
                    <Text style={[styles.effortText, { color: colors.text }]}>
                      Effort {workout.effort_rating}/10
                    </Text>
                  </View>
                )}
              </View>

              {/* Stat Chips */}
              <View style={styles.statsRow}>
                <View
                  style={[
                    styles.statPill,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="time-outline" size={16} color={colors.accent} />
                  <Text
                    testID={`${testID}-stat-duration`}
                    style={[styles.statPillText, { color: colors.text }]}
                  >
                    {workout.duration_minutes} min
                  </Text>
                </View>

                <View
                  style={[
                    styles.statPill,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="barbell-outline" size={16} color={colors.macroCalories} />
                  <Text
                    testID={`${testID}-stat-volume`}
                    style={[styles.statPillText, { color: colors.text }]}
                  >
                    {summary.total_volume_kg > 0
                      ? `${summary.total_volume_kg.toLocaleString()} kg`
                      : '0 kg'}
                  </Text>
                </View>

                <View
                  style={[
                    styles.statPill,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Ionicons name="flame-outline" size={16} color={colors.macroCalories} />
                  <Text
                    testID={`${testID}-stat-calories`}
                    style={[styles.statPillText, { color: colors.text }]}
                  >
                    {summary.estimated_calories} kcal
                  </Text>
                  <View
                    style={[
                      styles.microBadge,
                      { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
                    ]}
                  >
                    <Text style={[styles.microBadgeText, { color: colors.accent }]}>
                      {t('workouts.calorieEstimateBadge')}
                    </Text>
                  </View>
                </View>
              </View>

              {workout.notes && (
                <View
                  style={[
                    styles.notesBox,
                    { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.notesText, { color: colors.text }]}>
                    {workout.notes}
                  </Text>
                </View>
              )}
            </View>

            {/* Repeat Today CTA (WRK-6) */}
            <TouchableOpacity
              testID={`${testID}-btn-repeat-today`}
              style={[
                styles.repeatBtn,
                { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
              ]}
              onPress={handleRepeatToday}
              disabled={repeating}
              accessibilityRole="button"
              accessibilityLabel={t('workouts.repeatToday')}
            >
              <Ionicons name="copy-outline" size={18} color={colors.accent} />
              {repeating ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Text style={[styles.repeatBtnText, { color: colors.accent }]}>
                  {t('workouts.repeatToday')}
                </Text>
              )}
            </TouchableOpacity>

            {/* Exercises & Sets Breakdown */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: colors.textMuted }]}>
                {t('workouts.exercises.title')} ({workout.exercises.length})
              </Text>

              {workout.exercises.map((ex, exIdx) => (
                <View
                  key={ex.id || exIdx}
                  testID={`detail-exercise-card-${exIdx}`}
                  style={[
                    styles.card,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.exTitle, { color: colors.text }]}>
                    {ex.exercise_name}
                  </Text>

                  {/* Sets List */}
                  <View style={styles.setsList}>
                    {(ex.sets || []).map((s, sIdx) => (
                      <View
                        key={s.id || sIdx}
                        style={[
                          styles.setDetailRow,
                          {
                            borderTopColor: colors.border,
                            borderTopWidth: sIdx > 0 ? 0.5 : 0,
                          },
                        ]}
                      >
                        <View style={styles.setLeftInfo}>
                          <Text style={[styles.setNumLabel, { color: colors.textMuted }]}>
                            Set {s.set_number}
                          </Text>
                          {s.is_warmup && (
                            <View
                              style={[
                                styles.warmupTag,
                                { backgroundColor: colors.syncPending },
                              ]}
                            >
                              <Text style={styles.warmupTagText}>Warmup</Text>
                            </View>
                          )}
                        </View>

                        <Text style={[styles.setDetailValues, { color: colors.text }]}>
                          {s.weight_kg ? `${s.weight_kg} kg` : '0 kg'} ×{' '}
                          {s.reps ? `${s.reps} reps` : '0 reps'}
                        </Text>

                        <Ionicons
                          name={
                            s.completed
                              ? 'checkmark-circle'
                              : 'checkmark-circle-outline'
                          }
                          size={18}
                          color={
                            s.completed ? colors.syncSynced : colors.textMuted
                          }
                        />
                      </View>
                    ))}
                  </View>
                </View>
              ))}
            </View>
          </ScrollView>
        </View>
      </Modal>

      {/* Edit Mode Modal */}
      {isEditing && (
        <WorkoutLoggerModal
          visible={isEditing}
          initialWorkout={workout}
          defaultDate={workout.local_date}
          onClose={() => setIsEditing(false)}
          onSaved={(updated) => {
            setIsEditing(false);
            if (onUpdated) onUpdated(updated);
          }}
        />
      )}
    </>
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
  headerBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  headerRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  content: {
    padding: spacing.md,
    gap: spacing.md,
    paddingBottom: 60,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  successBannerText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.md,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  titleInfo: {
    flex: 1,
    gap: 2,
  },
  workoutName: {
    fontSize: fontSize.lg,
    fontWeight: '800',
  },
  dateSub: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  effortBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  effortText: {
    fontSize: 10,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  statPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  statPillText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  microBadge: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    borderWidth: 0.5,
  },
  microBadgeText: {
    fontSize: 8,
    fontWeight: '800',
  },
  notesBox: {
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  notesText: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  repeatBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: 12,
    borderRadius: radius.md,
    borderWidth: 1.5,
  },
  repeatBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  exTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  setsList: {
    gap: 2,
  },
  setDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  setLeftInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minWidth: 80,
  },
  setNumLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  warmupTag: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  warmupTagText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  setDetailValues: {
    fontSize: fontSize.sm,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
