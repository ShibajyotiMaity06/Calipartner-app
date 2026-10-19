import React, { useState } from 'react';
import {
  Modal,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WorkoutSummary, WorkoutWithDetails } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { t } from '@/i18n';

interface WorkoutFinishSummaryModalProps {
  visible: boolean;
  workout: WorkoutWithDetails | null;
  summary: WorkoutSummary | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  testID?: string;
}

export function WorkoutFinishSummaryModal({
  visible,
  workout,
  summary,
  onClose,
  onEdit,
  onDelete,
  testID = 'workout-finish-summary-modal',
}: WorkoutFinishSummaryModalProps) {
  const [shareToRoom, setShareToRoom] = useState(true);
  const [routineSaved, setRoutineSaved] = useState(false);

  if (!workout || !summary) return null;

  const handleSaveAsRoutine = () => {
    setRoutineSaved(true);
  };

  return (
    <Modal
      testID={testID}
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <View style={styles.screen}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('workouts.summary.completeTitle')}</Text>
          <TouchableOpacity
            testID={`${testID}-btn-close`}
            onPress={onClose}
            style={styles.closeBtn}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
          >
            <Ionicons name="close" size={24} color={dark.textHi} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          {/* Hero Celebration Card */}
          <View style={styles.heroCard}>
            <View style={styles.iconWrap}>
              <Ionicons name="barbell" size={32} color={dark.apricot} />
            </View>
            <Text style={styles.heroTitle}>
              {workout.name || t(`workouts.types.${workout.type}` as const)}
            </Text>
            <Text style={styles.heroSubtitle}>
              {t('workouts.summary.summarySubtitle')}
            </Text>

            {/* PR Badges (plain text neutral chips) */}
            <View style={styles.prChipsRow}>
              <View style={styles.prChip}>
                <Ionicons name="trending-up-outline" size={13} color={dark.teal} />
                <Text style={styles.prChipText}>Personal volume high</Text>
              </View>
              <View style={styles.prChip}>
                <Ionicons name="checkmark-done-outline" size={13} color={dark.iris} />
                <Text style={styles.prChipText}>All planned sets complete</Text>
              </View>
            </View>
          </View>

          {/* Key Metrics Grid */}
          <View style={styles.metricsGrid}>
            {/* Duration */}
            <View style={styles.metricCard}>
              <Ionicons name="time-outline" size={20} color={dark.apricot} />
              <Text style={styles.metricLabel}>{t('workouts.summary.duration')}</Text>
              <Text testID={`${testID}-stat-duration`} style={styles.metricValue}>
                {`${workout.duration_minutes} min`}
              </Text>
            </View>

            {/* Total Volume */}
            <View style={styles.metricCard}>
              <Ionicons name="barbell-outline" size={20} color={dark.iris} />
              <Text style={styles.metricLabel}>{t('workouts.summary.volume')}</Text>
              <Text testID={`${testID}-stat-volume`} style={styles.metricValue}>
                {summary.total_volume_kg > 0 ? `${summary.total_volume_kg.toLocaleString()} kg` : '0 kg'}
              </Text>
            </View>

            {/* Sets Completed */}
            <View style={styles.metricCard}>
              <Ionicons name="layers-outline" size={20} color={dark.teal} />
              <Text style={styles.metricLabel}>{t('workouts.summary.setsCompleted')}</Text>
              <Text testID={`${testID}-stat-sets`} style={styles.metricValue}>
                {summary.total_sets}
              </Text>
            </View>

            {/* Calorie Burn (MET-based estimate) */}
            <View style={styles.metricCard}>
              <View style={styles.calHeaderRow}>
                <Ionicons name="flame-outline" size={20} color={dark.apricot} />
                <View style={styles.estPill}>
                  <Text style={styles.estPillText}>ESTIMATE</Text>
                </View>
              </View>
              <Text style={styles.metricLabel}>Active estimate</Text>
              <Text testID={`${testID}-stat-calories`} style={styles.metricValue}>
                {`${summary.estimated_calories} kcal`}
              </Text>
            </View>
          </View>

          {/* Calorie Disclaimer */}
          <View style={styles.disclaimerCard}>
            <Ionicons name="information-circle-outline" size={16} color={dark.textLo} />
            <Text style={styles.disclaimerText}>
              {t('workouts.calorieEstimateDisclaimer')}
            </Text>
          </View>

          {/* Room Share Toggle */}
          <View style={styles.shareRow} testID="workout-share-room-row">
            <View style={styles.shareTextWrap}>
              <Text style={styles.shareTitle}>Share to room</Text>
              <Text style={styles.shareSubtitle}>
                Partners see workout type and duration only (volume stays private)
              </Text>
            </View>
            <Switch
              value={shareToRoom}
              onValueChange={setShareToRoom}
              trackColor={{ false: dark.s3, true: dark.apricot }}
              thumbColor={dark.bg0}
            />
          </View>

          {/* Save as Routine Action */}
          <TouchableOpacity
            testID="btn-save-as-routine"
            style={[styles.routineBtn, routineSaved && styles.routineBtnSaved]}
            onPress={handleSaveAsRoutine}
            disabled={routineSaved}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.saveAsRoutine')}
          >
            <Ionicons
              name={routineSaved ? 'checkmark-circle' : 'folder-outline'}
              size={18}
              color={routineSaved ? dark.teal : dark.apricot}
            />
            <Text style={[styles.routineBtnText, routineSaved && { color: dark.teal }]}>
              {routineSaved ? t('workouts.routineSaved') : t('workouts.saveAsRoutine')}
            </Text>
          </TouchableOpacity>

          {/* Exercise Breakdown List */}
          {summary.exercise_summaries && summary.exercise_summaries.length > 0 && (
            <View style={styles.breakdownCard}>
              <Text style={styles.sectionTitle}>{t('workouts.exercises.title')}</Text>
              {summary.exercise_summaries.map((ex, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.exerciseRow,
                    { borderTopColor: dark.hairline, borderTopWidth: idx > 0 ? 0.5 : 0 },
                  ]}
                >
                  <View style={styles.exerciseInfo}>
                    <Text style={styles.exerciseRowName}>{ex.exercise_name}</Text>
                    <Text style={styles.exerciseRowSub}>
                      {`${ex.set_count} sets${ex.heaviest_weight_kg ? ` • max ${ex.heaviest_weight_kg} kg` : ''}`}
                    </Text>
                  </View>
                  {ex.total_volume_kg > 0 && (
                    <Text style={styles.exerciseRowVolume}>{`${ex.total_volume_kg} kg`}</Text>
                  )}
                </View>
              ))}
            </View>
          )}

          {/* Edit & Delete Actions (optional triggers) */}
          <View style={styles.manageRow}>
            {onEdit && (
              <TouchableOpacity
                testID="btn-workout-summary-edit"
                style={styles.manageBtn}
                onPress={onEdit}
                accessibilityRole="button"
                accessibilityLabel="Edit workout"
              >
                <Ionicons name="create-outline" size={16} color={dark.textMid} />
                <Text style={styles.manageBtnText}>Edit workout</Text>
              </TouchableOpacity>
            )}
            {onDelete && (
              <TouchableOpacity
                testID="btn-workout-summary-delete"
                style={styles.manageBtn}
                onPress={onDelete}
                accessibilityRole="button"
                accessibilityLabel="Delete workout"
              >
                <Ionicons name="trash-outline" size={16} color={dark.danger} />
                <Text style={[styles.manageBtnText, { color: dark.danger }]}>Delete</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Done Button */}
          <TouchableOpacity
            testID={`${testID}-btn-done`}
            style={styles.doneBtn}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('workouts.summary.doneBtn')}
          >
            <Text style={styles.doneBtnText}>{t('workouts.summary.doneBtn')}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: dark.bg0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[4],
    paddingTop: 54,
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    backgroundColor: dark.s1,
  },
  headerTitle: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  closeBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    padding: space[4],
    gap: space[3],
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  iconWrap: {
    width: 56,
    height: 56,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroTitle: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    fontWeight: '800',
    textAlign: 'center',
  },
  heroSubtitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
  },
  prChipsRow: {
    flexDirection: 'row',
    gap: space[2],
    marginTop: space[1],
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
  prChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: dark.s2,
    paddingHorizontal: space[3],
    paddingVertical: 4,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  prChipText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  metricCard: {
    width: '48.5%',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 4,
  },
  calHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  estPill: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  estPillText: {
    fontSize: 8,
    color: dark.apricot,
    fontWeight: '800',
  },
  metricLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  metricValue: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
  },
  disclaimerCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space[2],
    backgroundColor: dark.s1,
    padding: space[3],
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  disclaimerText: {
    flex: 1,
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    lineHeight: 16,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    padding: space[3],
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  shareTextWrap: {
    flex: 1,
    paddingRight: space[2],
  },
  shareTitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  shareSubtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    marginTop: 2,
  },
  routineBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s1,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  routineBtnSaved: {
    borderColor: dark.teal,
  },
  routineBtnText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.apricot,
    fontWeight: '700',
  },
  breakdownCard: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  sectionTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  exerciseRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: space[2],
  },
  exerciseInfo: {
    gap: 2,
  },
  exerciseRowName: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  exerciseRowSub: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  exerciseRowVolume: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '700',
  },
  manageRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: space[1],
  },
  manageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 40,
    paddingHorizontal: space[3],
  },
  manageBtnText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  doneBtn: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
  },
  doneBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
});
