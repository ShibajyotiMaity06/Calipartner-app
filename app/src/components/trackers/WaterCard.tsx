import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useWater } from '@/hooks/useWater';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { CustomWaterModal } from './CustomWaterModal';
import { WaterHistoryModal } from './WaterHistoryModal';

export interface WaterCardProps {
  selectedDate?: string;
  testID?: string;
}

export function WaterCard({ selectedDate, testID = 'water-card' }: WaterCardProps) {
  const { colors } = useTheme();
  const {
    logs,
    totalMl,
    goalMl,
    progressPercent,
    remainingMl,
    loading,
    addWater,
    undoLast,
    deleteLog,
    editLog,
  } = useWater(selectedDate);

  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  const handleQuickAdd = async (amount: 250 | 500 | 1000) => {
    try {
      setActionBusy(true);
      await addWater(amount);
    } catch {
      // Handled gracefully
    } finally {
      setActionBusy(false);
    }
  };

  const handleUndo = async () => {
    try {
      setActionBusy(true);
      await undoLast();
    } catch {
      // Handled gracefully
    } finally {
      setActionBusy(false);
    }
  };

  const hasLogs = logs.length > 0;
  const progressRatio = Math.min(1, Math.max(0, goalMl > 0 ? totalMl / goalMl : 0));
  const isGoalMet = totalMl >= goalMl && goalMl > 0;

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
            <Ionicons name="water" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('trackers.water.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('trackers.water.subtitle')}
            </Text>
          </View>
        </View>

        <View style={styles.headerActions}>
          {hasLogs && (
            <Pressable
              testID="btn-water-undo"
              onPress={() => void handleUndo()}
              disabled={actionBusy}
              style={[styles.smallActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.undo')}
            >
              <Ionicons name="arrow-undo-outline" size={15} color={colors.text} />
              <Text style={[styles.smallActionText, { color: colors.text }]}>
                {t('trackers.water.undo')}
              </Text>
            </Pressable>
          )}

          <Pressable
            testID="btn-water-history"
            onPress={() => setHistoryModalVisible(true)}
            style={[styles.smallActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.water.history')}
          >
            <Ionicons name="time-outline" size={15} color={colors.textMuted} />
            <Text style={[styles.smallActionText, { color: colors.textMuted }]}>
              {t('trackers.water.history')}
            </Text>
          </Pressable>
        </View>
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer} testID="water-loading-state">
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
            accessibilityValue={{ min: 0, max: goalMl, now: totalMl }}
            accessibilityLabel={t('trackers.water.progressA11y', {
              current: totalMl,
              goal: goalMl,
              percent: progressPercent,
            })}
          >
            <View style={styles.progressTextRow}>
              <Text
                testID="water-progress-text"
                style={[styles.progressNumber, { color: colors.text }]}
              >
                {t('trackers.water.progress', {
                  current: totalMl,
                  goal: goalMl,
                  percent: progressPercent,
                })}
              </Text>

              <Text
                style={[
                  styles.statusBadgeText,
                  { color: isGoalMet ? colors.syncSynced : colors.textMuted },
                ]}
              >
                {isGoalMet
                  ? t('trackers.water.goalMetText')
                  : t('trackers.water.remainingText', { remaining: Math.max(0, remainingMl) })}
              </Text>
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

          {/* Empty state hint */}
          {!hasLogs && (
            <View testID="water-empty-state" style={styles.emptyNotice}>
              <Text style={[styles.emptyNoticeText, { color: colors.textMuted }]}>
                {t('trackers.water.emptyToday')}
              </Text>
            </View>
          )}

          {/* Quick-Add Buttons Grid */}
          <View style={styles.buttonGrid}>
            <Pressable
              testID="btn-water-quick-250"
              onPress={() => void handleQuickAdd(250)}
              disabled={actionBusy}
              style={[
                styles.quickBtn,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.glass')}
            >
              <Ionicons name="pint-outline" size={16} color={colors.accent} />
              <Text style={[styles.quickBtnLabel, { color: colors.text }]}>
                {t('trackers.water.quickAdd250')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-water-quick-500"
              onPress={() => void handleQuickAdd(500)}
              disabled={actionBusy}
              style={[
                styles.quickBtn,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.bottle')}
            >
              <Ionicons name="water-outline" size={16} color={colors.accent} />
              <Text style={[styles.quickBtnLabel, { color: colors.text }]}>
                {t('trackers.water.quickAdd500')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-water-quick-1000"
              onPress={() => void handleQuickAdd(1000)}
              disabled={actionBusy}
              style={[
                styles.quickBtn,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.large')}
            >
              <Ionicons name="flask-outline" size={16} color={colors.accent} />
              <Text style={[styles.quickBtnLabel, { color: colors.text }]}>
                {t('trackers.water.quickAdd1000')}
              </Text>
            </Pressable>

            <Pressable
              testID="btn-water-custom"
              onPress={() => setCustomModalVisible(true)}
              disabled={actionBusy}
              style={[
                styles.quickBtn,
                styles.customBtn,
                { backgroundColor: colors.cardHighlight, borderColor: colors.accent },
              ]}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.water.customAdd')}
            >
              <Ionicons name="add" size={16} color={colors.accent} />
              <Text style={[styles.quickBtnLabel, { color: colors.accent, fontWeight: '700' }]}>
                {t('trackers.water.customAdd')}
              </Text>
            </Pressable>
          </View>
        </>
      )}

      {/* Custom Water Modal */}
      {customModalVisible && (
        <CustomWaterModal
          visible={customModalVisible}
          onClose={() => setCustomModalVisible(false)}
          onSave={async (amount) => {
            await addWater(amount);
          }}
        />
      )}

      {/* Water History Modal */}
      {historyModalVisible && (
        <WaterHistoryModal
          visible={historyModalVisible}
          logs={logs}
          onClose={() => setHistoryModalVisible(false)}
          onUpdate={editLog}
          onDelete={deleteLog}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  smallActionText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
  statusBadgeText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
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
  emptyNotice: {
    paddingVertical: 2,
  },
  emptyNoticeText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  buttonGrid: {
    flexDirection: 'row',
    gap: 8,
  },
  quickBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  customBtn: {
    borderWidth: 1.5,
  },
  quickBtnLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
