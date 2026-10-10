import { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeightLog } from '@calipartner/core';
import { useTargets } from '@/hooks/useTargets';
import { useWeight } from '@/hooks/useWeight';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { WeightEntryModal } from './WeightEntryModal';
import { WeightHistoryModal } from './WeightHistoryModal';

export interface WeightCardProps {
  selectedDate?: string;
  testID?: string;
}

export function WeightCard({ selectedDate, testID = 'weight-card' }: WeightCardProps) {
  const { colors } = useTheme();
  const { currentGoalProfile } = useTargets();
  const {
    logs,
    latestLog,
    latestTrendKg,
    weeklyPaceKg,
    projectedDate,
    projectionReason,
    loading,
    logWeight,
    editWeight,
    deleteWeight,
  } = useWeight();

  const [entryModalVisible, setEntryModalVisible] = useState(false);
  const [historyModalVisible, setHistoryModalVisible] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightLog | null>(null);

  const hasEntries = logs.length > 0;
  const latestWeight = latestLog ? latestLog.weight_kg : null;
  const trendWeight = latestTrendKg;
  const weeklyPace = weeklyPaceKg;
  const hasEnoughTrend = projectionReason !== 'not_enough_trend';

  const startWeight =
    currentGoalProfile?.current_weight_kg ??
    (logs.length > 0 ? logs[logs.length - 1]!.weight_kg : null);

  const totalChangeKg =
    latestWeight !== null && startWeight !== null
      ? latestWeight - startWeight
      : null;

  const changePercent =
    startWeight && startWeight > 0 && totalChangeKg !== null
      ? ((totalChangeKg / startWeight) * 100).toFixed(1)
      : null;

  const handleOpenEdit = (entry: WeightLog) => {
    setEditingEntry(entry);
    setHistoryModalVisible(false);
    setEntryModalVisible(true);
  };

  const handleSaveWeight = async (weight: number, notes?: string, date?: string) => {
    if (editingEntry) {
      await editWeight(editingEntry.id, weight, notes);
      setEditingEntry(null);
    } else {
      await logWeight(weight, date, notes);
    }
  };

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
            <Ionicons name="scale-outline" size={18} color={colors.accent} />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>{t('trackers.weight.title')}</Text>
            <Text style={[styles.subtitle, { color: colors.textMuted }]}>
              {t('trackers.weight.subtitle')}
            </Text>
          </View>
        </View>

        {/* History action button */}
        <Pressable
          testID="btn-weight-history"
          onPress={() => setHistoryModalVisible(true)}
          style={[styles.smallActionBtn, { borderColor: colors.border, backgroundColor: colors.surfaceAlt }]}
          accessibilityRole="button"
          accessibilityLabel={t('trackers.weight.historyButton')}
        >
          <Ionicons name="time-outline" size={15} color={colors.textMuted} />
          <Text style={[styles.smallActionText, { color: colors.textMuted }]}>
            {t('trackers.weight.historyButton')}
          </Text>
        </Pressable>
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer} testID="weight-loading-state">
          <ActivityIndicator size="small" color={colors.accent} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>
            {t('common.loading')}
          </Text>
        </View>
      ) : hasEntries ? (
        <>
          {/* Main Weight & 7-Day Trend Display */}
          <View style={styles.heroWeightsRow}>
            <View style={styles.weightColumn}>
              <Text style={[styles.weightLabel, { color: colors.textMuted }]}>Current</Text>
              <Text
                testID="weight-current-val"
                style={[styles.weightHeroNum, { color: colors.text }]}
              >
                {latestWeight !== null ? `${latestWeight.toFixed(1)}` : '—'}
                <Text style={[styles.unitSmall, { color: colors.textMuted }]}> kg</Text>
              </Text>
            </View>

            <View style={[styles.verticalDivider, { backgroundColor: colors.border }]} />

            <View style={styles.weightColumn}>
              <Text style={[styles.weightLabel, { color: colors.textMuted }]}>7-Day Trend</Text>
              <Text
                testID="weight-trend-val"
                style={[styles.weightHeroNum, { color: colors.accent }]}
              >
                {trendWeight !== null ? `${trendWeight.toFixed(1)}` : '—'}
                <Text style={[styles.unitSmall, { color: colors.textMuted }]}> kg</Text>
              </Text>
            </View>
          </View>

          {/* Simple Trend Summary Metrics Strip */}
          <View
            style={[
              styles.metricsCard,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <View style={styles.metricsRow}>
              {/* Start */}
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Start</Text>
                <Text style={[styles.metricValue, { color: colors.text }]}>
                  {startWeight !== null ? `${startWeight.toFixed(1)} kg` : '—'}
                </Text>
              </View>

              {/* Change */}
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Change</Text>
                <Text
                  testID="weight-change-val"
                  style={[styles.metricValue, { color: colors.text }]}
                >
                  {totalChangeKg !== null
                    ? `${totalChangeKg > 0 ? '+' : ''}${totalChangeKg.toFixed(1)} kg (${changePercent}%)`
                    : '—'}
                </Text>
              </View>

              {/* Weekly Pace */}
              <View style={styles.metricItem}>
                <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Pace</Text>
                <Text
                  testID="weight-pace-val"
                  style={[styles.metricValue, { color: colors.accent }]}
                >
                  {hasEnoughTrend && weeklyPace !== null
                    ? `${weeklyPace > 0 ? '+' : ''}${weeklyPace.toFixed(2)} kg/wk`
                    : '—'}
                </Text>
              </View>
            </View>

            {/* Projected Date or "Not enough trend yet" */}
            <View style={[styles.paceFooter, { borderTopColor: colors.border }]}>
              {hasEnoughTrend ? (
                projectedDate ? (
                  <View style={styles.projectedRow}>
                    <Ionicons name="flag-outline" size={14} color={colors.syncSynced} />
                    <Text
                      testID="weight-projected-date"
                      style={[styles.projectedText, { color: colors.syncSynced }]}
                    >
                      {t('trackers.weight.projectedDate', { date: projectedDate })}
                    </Text>
                  </View>
                ) : (
                  <Text style={[styles.trendPendingText, { color: colors.textMuted }]}>
                    Maintaining pace towards target
                  </Text>
                )
              ) : (
                <View style={styles.notEnoughTrendRow}>
                  <Ionicons name="information-circle-outline" size={14} color={colors.textMuted} />
                  <Text
                    testID="weight-projected-date"
                    style={[styles.trendPendingText, { color: colors.textMuted }]}
                  >
                    {t('trackers.weight.notEnoughTrend')}
                  </Text>
                </View>
              )}
            </View>
          </View>
        </>
      ) : (
        /* Empty State */
        <View testID="weight-empty-state" style={styles.emptyContainer}>
          <Ionicons name="scale-outline" size={32} color={colors.textMuted} />
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            {t('trackers.weight.emptyToday')}
          </Text>
        </View>
      )}

      {/* Primary Action Button */}
      <Pressable
        testID="btn-log-weight"
        onPress={() => {
          setEditingEntry(null);
          setEntryModalVisible(true);
        }}
        style={[styles.logButton, { backgroundColor: colors.cardHighlight, borderColor: colors.accent }]}
        accessibilityRole="button"
        accessibilityLabel={t('trackers.weight.logWeightButton')}
      >
        <Ionicons name="add" size={16} color={colors.accent} />
        <Text style={[styles.logButtonText, { color: colors.accent }]}>
          {t('trackers.weight.logWeightButton')}
        </Text>
      </Pressable>

      {/* Weight Entry Modal / Sheet */}
      {entryModalVisible && (
        <WeightEntryModal
          visible={entryModalVisible}
          initialEntry={editingEntry}
          defaultDate={selectedDate}
          startWeight={startWeight}
          currentWeight={latestWeight}
          totalChangeKg={totalChangeKg}
          weeklyPace={weeklyPace}
          projectedDate={projectedDate}
          hasEnoughTrend={hasEnoughTrend}
          onClose={() => {
            setEntryModalVisible(false);
            setEditingEntry(null);
          }}
          onSave={handleSaveWeight}
        />
      )}

      {/* Weight History Modal */}
      {historyModalVisible && (
        <WeightHistoryModal
          visible={historyModalVisible}
          entries={logs}
          onClose={() => setHistoryModalVisible(false)}
          onEditEntry={handleOpenEdit}
          onDeleteEntry={deleteWeight}
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
  heroWeightsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: spacing.xs,
  },
  weightColumn: {
    alignItems: 'center',
    gap: 2,
  },
  weightLabel: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  weightHeroNum: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  unitSmall: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  verticalDivider: {
    width: 1,
    height: 38,
  },
  metricsCard: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricItem: {
    alignItems: 'center',
    gap: 2,
  },
  metricLabel: {
    fontSize: fontSize.xs,
  },
  metricValue: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  paceFooter: {
    borderTopWidth: 1,
    paddingTop: 6,
    alignItems: 'center',
  },
  projectedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  projectedText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  notEnoughTrendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendPendingText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  logButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 42,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  logButtonText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
