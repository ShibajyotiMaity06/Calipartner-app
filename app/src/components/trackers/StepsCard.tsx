import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { ActivitySource } from '@calipartner/core';
import { useSteps } from '@/hooks/useSteps';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { HealthPermissionModal } from './HealthPermissionModal';
import { ManualStepsModal } from './ManualStepsModal';

export interface StepsCardProps {
  selectedDate?: string;
  testID?: string;
}

export function StepsCard({ selectedDate, testID = 'steps-card' }: StepsCardProps) {
  const { colors } = useTheme();
  const {
    steps,
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
    if (!src) return null;
    switch (src) {
      case 'health_platform':
        return t('trackers.steps.source.healthPlatform');
      case 'pedometer':
        return t('trackers.steps.source.pedometer');
      case 'manual':
        return t('trackers.steps.source.manual');
      default:
        return t('trackers.steps.source.unknown');
    }
  };

  const hasSteps = steps > 0;
  const progressRatio = Math.min(1, Math.max(0, goalSteps > 0 ? steps / goalSteps : 0));
  const isGoalMet = steps >= goalSteps && goalSteps > 0;
  const sourceName = getSourceLabel(source);

  return (
    <View
      testID={testID}
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
        },
      ]}
    >
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={[styles.iconWrapper, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="footsteps" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('trackers.steps.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('trackers.steps.subtitle')}
            </Text>
          </View>
        </View>

        {/* Source Badge & Permission Config */}
        <View style={styles.headerRight}>
          {sourceName && (
            <View
              testID="steps-source-badge"
              style={[
                styles.sourceBadge,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.sourceBadgeText, { color: colors.textMuted }]}>
                {sourceName}
              </Text>
            </View>
          )}

          <Pressable
            testID="btn-steps-permissions"
            onPress={() => setPermissionModalVisible(true)}
            hitSlop={8}
            style={[
              styles.permissionBadge,
              {
                backgroundColor:
                  permissionStatus === 'granted'
                    ? colors.cardHighlight
                    : colors.surfaceAlt,
                borderColor:
                  permissionStatus === 'granted' ? colors.syncSynced : colors.border,
              },
            ]}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.permissions.title')}
          >
            <Ionicons
              name={permissionStatus === 'granted' ? 'shield-checkmark' : 'shield-outline'}
              size={14}
              color={permissionStatus === 'granted' ? colors.syncSynced : colors.textMuted}
            />
          </Pressable>
        </View>
      </View>

      {/* Loading State */}
      {loading ? (
        <View style={styles.loadingContainer} testID="steps-loading-state">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {t('common.loading')}
          </Text>
        </View>
      ) : (
        <>
          {/* Progress Section */}
          <View
            style={styles.progressSection}
            accessible
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: goalSteps, now: steps }}
            accessibilityLabel={t('trackers.steps.progressA11y', {
              current: steps,
              goal: goalSteps,
              percent: progressPercent,
            })}
          >
            <View style={styles.progressTextRow}>
              <Text
                testID="steps-progress-text"
                style={[styles.progressNumber, { color: colors.text }]}
              >
                {t('trackers.steps.progress', {
                  current: steps.toLocaleString(),
                  goal: goalSteps.toLocaleString(),
                  percent: progressPercent,
                })}
              </Text>

              {isGoalMet && (
                <Text style={[styles.goalAchievedText, { color: colors.syncSynced }]}>
                  {t('trackers.steps.goalMetText')}
                </Text>
              )}
            </View>

            {/* Progress Track */}
            <View style={[styles.progressTrack, { backgroundColor: colors.surfaceAlt }]}>
              <View
                style={[
                  styles.progressBar,
                  {
                    width: `${Math.round(progressRatio * 100)}%`,
                    backgroundColor: isGoalMet ? colors.syncSynced : colors.accent,
                  },
                ]}
              />
            </View>
          </View>

          {/* Metrics Strip: Distance & Walking Calories */}
          <View
            style={[
              styles.metricsRow,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <View style={styles.metricItem}>
              <Ionicons name="navigate-outline" size={16} color={colors.accent} />
              <View>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Distance</Text>
                <Text
                  testID="steps-distance-text"
                  style={[styles.metricValue, { color: colors.text }]}
                >
                  {t('trackers.steps.distance', { distance: distanceKm })}
                </Text>
              </View>
            </View>

            <View style={[styles.metricDivider, { backgroundColor: colors.border }]} />

            <View style={styles.metricItem}>
              <Ionicons name="flame-outline" size={16} color={colors.macroCalories} />
              <View>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>
                  Walking Burn
                </Text>
                <Text
                  testID="steps-calories-text"
                  style={[styles.metricValue, { color: colors.text }]}
                >
                  {t('trackers.steps.calories', { calories: walkingCalories })}
                </Text>
              </View>
            </View>
          </View>

          {/* Empty State Notice */}
          {!hasSteps && (
            <View testID="steps-empty-state" style={styles.emptyNotice}>
              <Text style={[styles.emptyNoticeText, { color: colors.textMuted }]}>
                {t('trackers.steps.emptyToday')}
              </Text>
            </View>
          )}

          {/* Action Buttons Row */}
          <View style={styles.actionsRow}>
            <Pressable
              testID="btn-steps-sync"
              onPress={() => void handleSync()}
              disabled={syncing}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.steps.syncButton')}
            >
              {syncing ? (
                <ActivityIndicator size="small" color={colors.accent} />
              ) : (
                <Ionicons name="sync-outline" size={16} color={colors.text} />
              )}
              <Text style={[styles.actionBtnText, { color: colors.text }]}>
                {syncing ? t('trackers.steps.syncing') : t('trackers.steps.syncButton')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-steps-manual"
              onPress={() => setManualModalVisible(true)}
              style={[
                styles.actionBtn,
                { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.steps.logManual')}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={[styles.actionBtnText, { color: colors.accent, fontWeight: '700' }]}>
                {t('trackers.steps.logManual')}
              </Text>
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

      {/* Health Permission Explanation Modal */}
      {permissionModalVisible && (
        <HealthPermissionModal
          visible={permissionModalVisible}
          status={permissionStatus}
          onClose={() => setPermissionModalVisible(false)}
          onRequestPermission={requestPermission}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  sourceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  sourceBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  permissionBadge: {
    padding: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  loadingText: {
    fontSize: fontSize.xs,
  },
  progressSection: {
    gap: 8,
  },
  progressTextRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  progressNumber: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  goalAchievedText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  progressTrack: {
    height: 10,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: radius.pill,
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  metricItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  metricDivider: {
    width: 1,
    height: 28,
    marginHorizontal: 8,
  },
  metricLabel: {
    fontSize: fontSize.xs,
  },
  metricValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  emptyNotice: {
    paddingVertical: 2,
  },
  emptyNoticeText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  actionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
