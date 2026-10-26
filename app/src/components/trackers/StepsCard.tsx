import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivitySource } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useSteps } from '@/hooks/useSteps';
import { t } from '@/i18n';
import { FixStepCountingModal } from './FixStepCountingModal';
import { HealthPermissionModal } from './HealthPermissionModal';
import { ManualStepsModal } from './ManualStepsModal';

export interface StepsCardProps {
  selectedDate?: string;
  testID?: string;
}

interface DayStepData {
  dayLabel: string;
  steps: number | null;
  isToday: boolean;
  dateStr: string;
}

export function StepsCard({ selectedDate, testID = 'steps-card' }: StepsCardProps) {
  const {
    steps,
    activity,
    week,
    error,
    updateStepGoal,
    distanceKm,
    walkingCalories,
    source,
    goalSteps,
    progressPercent,
    permissionStatus,
    loading,
    requestPermission,
    logManualSteps,
    syncFromPlatform,
  } = useSteps(selectedDate);

  const [manualModalVisible, setManualModalVisible] = useState(false);
  const [permissionModalVisible, setPermissionModalVisible] = useState(false);
  const [fixModalVisible, setFixModalVisible] = useState(false);
  const [tableModalVisible, setTableModalVisible] = useState(false);
  const [goalModalVisible, setGoalModalVisible] = useState(false);
  const [currentGoal, setCurrentGoal] = useState(goalSteps);
  const [goalSaveError, setGoalSaveError] = useState(false);
  useEffect(() => setCurrentGoal(goalSteps), [goalSteps]);
  const [syncing, setSyncing] = useState(false);

  const handleSync = async () => {
    try {
      setSyncing(true);
      await syncFromPlatform();
    } finally {
      setSyncing(false);
    }
  };

  const getSourceLabel = (src: ActivitySource | null) => {
    if (!src) return t('trackers.steps.noReading');
    switch (src) {
      case 'health_platform':
        return t(
          Platform.OS === 'ios' ? 'capture.appleHealthSource' : 'capture.healthConnectSource',
        );
      case 'pedometer':
        return 'From Phone Sensor';
      case 'manual':
        return 'From Manual Entry';
      default:
        return 'From Sensor';
    }
  };

  const hasSteps = steps > 0;
  const progressRatio = Math.min(1, Math.max(0, currentGoal > 0 ? steps / currentGoal : 0));
  const isGoalMet = steps >= currentGoal && currentGoal > 0;
  const sourceName = getSourceLabel(source);

  const weekDays: DayStepData[] = week.map((day, index) => ({
    dayLabel: new Date(`${day.localDate}T12:00:00`).toLocaleDateString('en', { weekday: 'short' }),
    dateStr: day.localDate,
    isToday: index === week.length - 1,
    steps: day.steps,
  }));
  const recorded = weekDays.filter((day) => day.steps != null);
  const weeklyAverage = recorded.length
    ? Math.round(recorded.reduce((total, day) => total + day.steps!, 0) / recorded.length)
    : null;
  const maxWeekSteps = Math.max(1, currentGoal, ...weekDays.map((day) => day.steps ?? 0));
  const sourceSummary = activity
    ? `${sourceName} ? ${t('trackers.steps.updatedAt', { time: new Date(activity.updated_at).toLocaleTimeString() })}`
    : sourceName;

  return (
    <View testID={testID} style={styles.card}>
      <Text style={styles.subtitle}>
        {t(Platform.OS === 'web' ? 'capture.webSteps' : 'capture.healthSteps')}
      </Text>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconWrapper}>
            <Ionicons name="footsteps" size={18} color={dark.apricot} />
          </View>
          <View>
            <Text style={styles.title}>{t('trackers.steps.title')}</Text>
            <Text style={styles.subtitle}>{t('trackers.steps.subtitle')}</Text>
          </View>
        </View>

        {/* Source Badge & Fix counting button */}
        <View style={styles.headerRight}>
          <Pressable
            testID="steps-source-badge"
            onPress={() => setFixModalVisible(true)}
            style={styles.sourceBadge}
            accessibilityRole="button"
            accessibilityLabel={`${sourceName}. Tap to troubleshoot step counting.`}
          >
            <Text style={styles.sourceBadgeText}>{sourceName}</Text>
            <Ionicons name="chevron-forward" size={12} color={dark.textLo} />
          </Pressable>

          <Pressable
            testID="btn-steps-permissions"
            onPress={() => setPermissionModalVisible(true)}
            hitSlop={8}
            style={[
              styles.permissionBadge,
              permissionStatus === 'granted' && styles.permissionBadgeActive,
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.permissions.title')}
          >
            <Ionicons
              name={permissionStatus === 'granted' ? 'shield-checkmark' : 'shield-outline'}
              size={14}
              color={permissionStatus === 'granted' ? dark.teal : dark.textMid}
            />
          </Pressable>
        </View>
      </View>

      {error && (
        <Text accessibilityRole="alert" style={styles.emptyNoticeText} testID="steps-error-state">
          {t('common.errorBody')}
        </Text>
      )}
      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer} testID="steps-loading-state">
          <ActivityIndicator size="small" color={dark.apricot} />
          <Text style={styles.loadingText}>{t('common.loading')}</Text>
        </View>
      ) : (
        <>
          {/* E03 Big Arc / Progress Ring Presentation */}
          <View
            style={styles.heroSection}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: currentGoal, now: steps }}
            accessibilityLabel={t('trackers.steps.progressA11y', {
              current: steps,
              goal: currentGoal,
              percent: progressPercent,
            })}
          >
            {/* Steps in numeral-l & "of 8,000" */}
            <View style={styles.numeralRow}>
              <Text testID="steps-progress-text" style={styles.stepsNumeral}>
                {steps.toLocaleString()}
              </Text>
              <Text style={styles.stepsGoalText}>{` of ${currentGoal.toLocaleString()}`}</Text>
            </View>

            {isGoalMet && (
              <View style={styles.goalPill}>
                <Ionicons name="checkmark-circle" size={14} color={dark.teal} />
                <Text style={styles.goalAchievedText}>{t('trackers.steps.goalMetText')}</Text>
              </View>
            )}

            {/* Progress Track */}
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.round(progressRatio * 100)}%`,
                    backgroundColor: isGoalMet ? dark.teal : dark.apricot,
                  },
                ]}
              />
            </View>
          </View>

          {/* E03 Three Stat Tiles */}
          <View style={styles.statTilesRow} testID="steps-stat-tiles">
            {/* Tile 1: Distance (km) */}
            <View style={styles.statTile}>
              <Ionicons name="navigate-outline" size={16} color={dark.teal} />
              <Text style={styles.tileLabel}>Distance</Text>
              <Text testID="steps-distance-text" style={styles.tileValue}>
                {t('trackers.steps.distance', { distance: distanceKm })}
              </Text>
            </View>

            {/* Tile 2: Active Estimate (kcal) with strict disclaimer */}
            <View style={styles.statTile}>
              <Ionicons name="flame-outline" size={16} color={dark.apricot} />
              <Text style={styles.tileLabel}>Active estimate</Text>
              <Text testID="steps-calories-text" style={styles.tileValue}>
                {t('trackers.steps.calories', { calories: walkingCalories })}
              </Text>
              <Text style={styles.tileSubNote}>estimate, not added</Text>
            </View>

            {/* Tile 3: Average this week */}
            <View style={styles.statTile}>
              <Ionicons name="stats-chart-outline" size={16} color={dark.iris} />
              <Text style={styles.tileLabel}>This week avg</Text>
              <Text style={styles.tileValue}>
                {weeklyAverage == null
                  ? t('common.noRecordedData')
                  : weeklyAverage.toLocaleString()}
              </Text>
            </View>
          </View>

          {/* E03 7-day Bar Chart (CMP-14: today outlined, View as table) */}
          <View style={styles.chartContainer} testID="steps-7day-chart">
            <View style={styles.chartHeader}>
              <Text style={styles.chartTitle}>{t('trackers.steps.pastWeek')}</Text>
              <Pressable
                testID="btn-steps-view-table"
                onPress={() => setTableModalVisible(true)}
                style={styles.viewTableBtn}
                accessibilityRole="button"
                accessibilityLabel={t('trackers.steps.viewAsTable')}
              >
                <Ionicons name="list-outline" size={14} color={dark.apricot} />
                <Text style={styles.viewTableText}>{t('trackers.steps.viewAsTable')}</Text>
              </Pressable>
            </View>

            <View
              style={styles.barsRow}
              accessible
              accessibilityLabel={weekDays
                .map((day) => `${day.dateStr}: ${day.steps ?? t('common.noRecordedData')}`)
                .join(', ')}
            >
              {weekDays.map((d, index) => {
                const heightRatio = (d.steps ?? 0) / maxWeekSteps;
                return (
                  <View key={index} style={styles.barCol}>
                    <View style={styles.barTrack}>
                      <View
                        style={[
                          styles.barFill,
                          {
                            height: `${Math.round(heightRatio * 100)}%`,
                            backgroundColor: d.isToday ? dark.teal : dark.iris,
                          },
                          d.isToday && styles.todayBarOutline,
                        ]}
                      />
                    </View>
                    <Text
                      style={[
                        styles.barAxisLabel,
                        d.isToday && { color: dark.textHi, fontWeight: '700' },
                      ]}
                    >
                      {d.dayLabel}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>

          {/* Source Line with Tap Target to E04 */}
          <Pressable
            testID="steps-source-line"
            onPress={() => setFixModalVisible(true)}
            style={styles.sourceLineRow}
            accessibilityRole="button"
            accessibilityLabel={`${sourceName} · Last synced 2:14 pm. Tap to fix step counting.`}
          >
            <Ionicons name="information-circle-outline" size={15} color={dark.textLo} />
            <Text style={styles.sourceLineText}>{`${sourceName} · Last synced 2:14 pm`}</Text>
            <Text style={styles.fixCountingLink}>{t('trackers.steps.fixStepCounting')}</Text>
          </Pressable>

          {/* Edit step goal row */}
          <Pressable
            testID="btn-edit-step-goal"
            onPress={() => setGoalModalVisible(true)}
            style={styles.editGoalRow}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.steps.editGoal')}
          >
            <Text style={styles.editGoalText}>{t('trackers.steps.editGoal')}</Text>
            <View style={styles.editGoalRight}>
              <Text
                style={styles.currentGoalDisplay}
              >{`${currentGoal.toLocaleString()} steps`}</Text>
              <Ionicons name="chevron-forward" size={14} color={dark.textLo} />
            </View>
          </Pressable>

          {/* Non-negotiable product copy note */}
          <View style={styles.copyNoteBox}>
            <Text style={styles.copyNoteText}>{t('trackers.steps.exerciseCaloriesNote')}</Text>
          </View>

          {/* Empty State Notice */}
          {!hasSteps && (
            <View testID="steps-empty-state" style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>{t('trackers.steps.emptyToday')}</Text>
            </View>
          )}

          {/* Actions Row */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-steps-sync"
              onPress={() => void handleSync()}
              disabled={syncing}
              style={styles.actionBtn}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.steps.syncButton')}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={dark.apricot} />
              ) : (
                <Ionicons name="sync-outline" size={16} color={dark.textHi} />
              )}
              <Text style={styles.actionBtnText}>
                {syncing ? t('trackers.steps.syncing') : t('trackers.steps.syncButton')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-steps-manual"
              onPress={() => setManualModalVisible(true)}
              style={[styles.actionBtn, styles.actionBtnAccent]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.steps.logManual')}
            >
              <Ionicons name="add" size={16} color={dark.onBrand} />
              <Text style={styles.actionBtnTextAccent}>{t('trackers.steps.logManual')}</Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Manual Steps Modal */}
      {manualModalVisible && (
        <ManualStepsModal
          visible={manualModalVisible}
          onClose={() => setManualModalVisible(false)}
          onSave={async (count, dist) => {
            await logManualSteps(count, dist);
          }}
        />
      )}

      {/* Health Permission Modal */}
      {permissionModalVisible && (
        <HealthPermissionModal
          visible={permissionModalVisible}
          status={permissionStatus}
          onClose={() => setPermissionModalVisible(false)}
          onRequestPermission={requestPermission}
        />
      )}

      {/* E04 Fix Step Counting Modal */}
      {fixModalVisible && (
        <FixStepCountingModal
          visible={fixModalVisible}
          currentSource={source}
          lastSyncedText={
            activity
              ? new Date(activity.updated_at).toLocaleTimeString()
              : t('trackers.steps.noReading')
          }
          onClose={() => setFixModalVisible(false)}
        />
      )}

      {/* CMP-14 "View as table" Modal */}
      {tableModalVisible && (
        <Modal
          visible={tableModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setTableModalVisible(false)}
          testID="steps-table-modal"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableTitle}>Steps 7-day data table</Text>
                <Pressable
                  onPress={() => setTableModalVisible(false)}
                  hitSlop={8}
                  style={styles.tableCloseBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Close table"
                >
                  <Ionicons name="close" size={20} color={dark.textMid} />
                </Pressable>
              </View>

              <View style={styles.tableGridHeader}>
                <Text style={[styles.colHeader, { flex: 1.2 }]}>Day</Text>
                <Text style={[styles.colHeader, { flex: 1.5 }]}>Steps</Text>
                <Text style={[styles.colHeader, { flex: 1.5 }]}>Goal</Text>
                <Text style={[styles.colHeader, { flex: 1 }]}>Status</Text>
              </View>

              {weekDays.map((row, idx) => (
                <View key={idx} style={styles.tableGridRow}>
                  <Text
                    style={[
                      styles.cellText,
                      { flex: 1.2, fontWeight: row.isToday ? '700' : '400' },
                    ]}
                  >
                    {row.dateStr}
                  </Text>
                  <Text style={[styles.cellText, { flex: 1.5, fontVariant: ['tabular-nums'] }]}>
                    {row.steps == null ? t('common.noRecordedData') : row.steps.toLocaleString()}
                  </Text>
                  <Text style={[styles.cellText, { flex: 1.5, color: dark.textLo }]}>
                    {currentGoal.toLocaleString()}
                  </Text>
                  <Text
                    style={[
                      styles.cellText,
                      {
                        flex: 1,
                        color: (row.steps ?? 0) >= currentGoal ? dark.teal : dark.textMid,
                        fontWeight: '600',
                      },
                    ]}
                  >
                    {row.steps == null
                      ? t('common.noRecordedData')
                      : (row.steps ?? 0) >= currentGoal
                        ? 'Met'
                        : 'Pending'}
                  </Text>
                </View>
              ))}

              <Pressable
                style={styles.tableDoneBtn}
                onPress={() => setTableModalVisible(false)}
                accessibilityRole="button"
                accessibilityLabel="Close"
              >
                <Text style={styles.tableDoneBtnText}>Close</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}

      {/* Edit Step Goal Modal */}
      {goalModalVisible && (
        <Modal
          visible={goalModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setGoalModalVisible(false)}
          testID="steps-goal-editor-modal"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.tableCard}>
              <Text style={styles.tableTitle}>{t('trackers.steps.editGoal')}</Text>
              <Text style={styles.sectionSub}>Adjust your daily movement target</Text>
              {goalSaveError && (
                <Text accessibilityRole="alert" style={styles.emptyNoticeText}>
                  {t('common.errorBody')}
                </Text>
              )}

              <View style={styles.goalStepperRow}>
                <Pressable
                  testID="btn-step-goal-down"
                  style={styles.stepperActionBtn}
                  onPress={() => setCurrentGoal((prev) => Math.max(1000, prev - 500))}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease goal"
                >
                  <Ionicons name="remove" size={20} color={dark.textHi} />
                </Pressable>

                <Text style={styles.goalModalNumeral} testID="step-goal-display">
                  {currentGoal.toLocaleString()}
                </Text>

                <Pressable
                  testID="btn-step-goal-up"
                  style={styles.stepperActionBtn}
                  onPress={() => setCurrentGoal((prev) => Math.min(30000, prev + 500))}
                  accessibilityRole="button"
                  accessibilityLabel="Increase goal"
                >
                  <Ionicons name="add" size={20} color={dark.textHi} />
                </Pressable>
              </View>

              <Pressable
                testID="btn-save-step-goal"
                style={styles.tableDoneBtn}
                onPress={() => {
                  setGoalSaveError(false);
                  void updateStepGoal(currentGoal)
                    .then(() => setGoalModalVisible(false))
                    .catch(() => setGoalSaveError(true));
                }}
                accessibilityRole="button"
                accessibilityLabel={t('common.save')}
              >
                <Text style={styles.tableDoneBtnText}>{t('common.save')}</Text>
              </Pressable>
            </View>
          </View>
        </Modal>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s1,
    padding: space[4],
    gap: space[3],
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  sourceBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[2],
    paddingVertical: 4,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    minHeight: 32,
  },
  sourceBadgeText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
    fontWeight: '600',
  },
  permissionBadge: {
    padding: 6,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
    minWidth: 32,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBadgeActive: {
    borderColor: dark.teal,
    backgroundColor: dark.s3,
  },
  loadingContainer: {
    paddingVertical: space[6],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  loadingText: {
    fontSize: typeTokens.label.fontSize,
    color: dark.textLo,
  },
  heroSection: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  numeralRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  stepsNumeral: {
    fontSize: typeTokens.numeralL.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '800',
  },
  stepsGoalText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textLo,
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  goalAchievedText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.teal,
    fontWeight: '700',
  },
  progressTrack: {
    height: 6,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.full,
  },
  statTilesRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  statTile: {
    flex: 1,
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: 2,
  },
  tileLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  tileValue: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '700',
  },
  tileSubNote: {
    fontSize: 9,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  chartContainer: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chartTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  viewTableBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 32,
    paddingHorizontal: space[2],
  },
  viewTableText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  barsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 72,
    paddingTop: space[1],
  },
  barCol: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  barTrack: {
    width: 14,
    height: 52,
    backgroundColor: dark.s3,
    borderRadius: 4,
    overflow: 'hidden',
    justifyContent: 'flex-end',
  },
  barFill: {
    width: '100%',
    borderRadius: 4,
  },
  todayBarOutline: {
    borderWidth: 1.5,
    borderColor: dark.teal,
  },
  barAxisLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  sourceLineRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    minHeight: 36,
  },
  sourceLineText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    flex: 1,
  },
  fixCountingLink: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.apricot,
    fontWeight: '600',
  },
  editGoalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 40,
    paddingVertical: space[1],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
  editGoalText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textMid,
  },
  editGoalRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  currentGoalDisplay: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '600',
  },
  copyNoteBox: {
    backgroundColor: dark.s2,
    borderRadius: radius.control,
    padding: space[2],
  },
  copyNoteText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
  },
  emptyNotice: {
    paddingVertical: space[2],
    alignItems: 'center',
  },
  emptyNoticeText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[2],
  },
  actionBtnAccent: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  actionBtnText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  actionBtnTextAccent: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: space[4],
  },
  tableCard: {
    width: '100%',
    backgroundColor: dark.s1,
    borderRadius: radius.sheet,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[3],
  },
  tableHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  tableTitle: {
    fontSize: typeTokens.title2.fontSize,
    fontFamily: typeTokens.title2.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  tableCloseBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tableGridHeader: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
    paddingBottom: space[2],
  },
  colHeader: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    textTransform: 'uppercase',
    fontWeight: '700',
  },
  tableGridRow: {
    flexDirection: 'row',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  cellText: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
  },
  tableDoneBtn: {
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: space[2],
  },
  tableDoneBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
    color: dark.onBrand, // #1C1109
    fontWeight: '700',
  },
  goalStepperRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[3],
  },
  stepperActionBtn: {
    width: 48,
    height: 48,
    borderRadius: radius.button,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalModalNumeral: {
    fontSize: typeTokens.numeralL.fontSize,
    fontFamily: typeTokens.numeralL.fontFamily,
    color: dark.textHi,
    fontWeight: '800',
  },
  sectionSub: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
  },
});
