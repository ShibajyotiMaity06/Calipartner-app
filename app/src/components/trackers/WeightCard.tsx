import React, { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { WeightLog } from '@calipartner/core';
import { dark, radius, space, type as typeTokens } from '@calipartner/ui';
import { useTargets } from '@/hooks/useTargets';
import { useWeight } from '@/hooks/useWeight';
import { t } from '@/i18n';
import { LoadingState } from '@/components/LoadingState';
import { AddMeasurementModal } from './AddMeasurementModal';
import { ProgressPhotosModal } from './ProgressPhotosModal';
import { TargetWeightEditorModal } from './TargetWeightEditorModal';
import { WeightEntryModal } from './WeightEntryModal';
import { WeightHistoryModal } from './WeightHistoryModal';

export interface WeightCardProps {
  selectedDate?: string;
  testID?: string;
}

type RangeChip = '7d' | '30d' | '90d' | '6m' | '1y' | 'all';

export function WeightCard({ selectedDate, testID = 'weight-card' }: WeightCardProps) {
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
  const [measurementModalVisible, setMeasurementModalVisible] = useState(false);
  const [photosModalVisible, setPhotosModalVisible] = useState(false);
  const [targetEditorVisible, setTargetEditorVisible] = useState(false);
  const [tableModalVisible, setTableModalVisible] = useState(false);

  const [selectedRange, setSelectedRange] = useState<RangeChip>('30d');
  const [editingEntry, setEditingEntry] = useState<WeightLog | null>(null);
  const [selectedPointIndex, setSelectedPointIndex] = useState<number | null>(null);

  const hasEntries = logs.length > 0;
  const latestWeight = latestLog ? latestLog.weight_kg : null;
  const trendWeight = latestTrendKg;
  const weeklyPace = weeklyPaceKg;
  const hasEnoughTrend = projectionReason !== 'not_enough_trend' && logs.length >= 3;

  const startWeight =
    currentGoalProfile?.current_weight_kg ??
    (logs.length > 0 ? logs[logs.length - 1]!.weight_kg : null);

  const targetWeight =
    currentGoalProfile?.target_weight_kg ?? (latestWeight ? latestWeight - 5 : 70);

  const totalChangeKg =
    latestWeight !== null && startWeight !== null ? latestWeight - startWeight : null;

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

  // Mock / Filtered entries for the CMP-14 chart
  const chartPoints = logs.slice(0, 10).reverse();
  const minChartKg =
    chartPoints.length > 0
      ? Math.min(...chartPoints.map((p) => p.weight_kg), targetWeight) - 1
      : 65;
  const maxChartKg =
    chartPoints.length > 0
      ? Math.max(...chartPoints.map((p) => p.weight_kg), targetWeight) + 1
      : 80;

  return (
    <View testID={testID} style={styles.card}>
      {/* Header */}
      <View style={styles.headerRow}>
        <View style={styles.titleGroup}>
          <View style={styles.iconWrapper}>
            <Ionicons name="scale-outline" size={18} color={dark.apricot} />
          </View>
          <View>
            <Text style={styles.title}>{t('trackers.weight.title')}</Text>
            <Text style={styles.subtitle}>{t('trackers.weight.subtitle')}</Text>
          </View>
        </View>

        {/* History action button */}
        <Pressable
          testID="btn-weight-history"
          onPress={() => setHistoryModalVisible(true)}
          style={styles.smallActionBtn}
          accessibilityRole="button"
          accessibilityLabel={t('trackers.weight.historyButton')}
        >
          <Ionicons name="time-outline" size={15} color={dark.textMid} />
          <Text style={styles.smallActionText}>{t('trackers.weight.historyButton')}</Text>
        </Pressable>
      </View>

      {/* Loading state */}
      {loading ? (
        <View style={styles.loadingContainer} testID="weight-loading-state">
          <LoadingState />
        </View>
      ) : (
        <>
          {/* E06 Summary Strip: Current, Start, Change, Weekly Pace */}
          <View style={styles.summaryStrip} testID="weight-summary-strip">
            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Current</Text>
              <Text testID="weight-current-val" style={styles.summaryVal}>
                {latestWeight !== null ? `${latestWeight.toFixed(1)} kg` : '—'}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Start</Text>
              <Text testID="weight-start-val" style={styles.summaryVal}>
                {startWeight !== null ? `${startWeight.toFixed(1)} kg` : '—'}
              </Text>
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Change</Text>
              <Text testID="weight-change-val" style={styles.summaryVal}>
                {totalChangeKg !== null
                  ? `${totalChangeKg > 0 ? '+' : ''}${totalChangeKg.toFixed(1)} kg`
                  : '—'}
              </Text>
              {changePercent && <Text style={styles.summarySubVal}>{`${changePercent}%`}</Text>}
            </View>

            <View style={styles.summaryDivider} />

            <View style={styles.summaryCol}>
              <Text style={styles.summaryLabel}>Pace</Text>
              <Text testID="weight-pace-val" style={styles.summaryVal}>
                {weeklyPace !== null ? `${weeklyPace.toFixed(2)}` : '—'}
              </Text>
              <Text style={styles.summarySubVal}>kg/wk</Text>
            </View>
          </View>

          {/* E06 Chart Card (CMP-14: raw dots + 7-day MA line + dashed goal line, no area fill) */}
          <View style={styles.chartCard} testID="weight-cmp14-chart">
            <View style={styles.chartHeader}>
              <View style={styles.chartTitleWrap}>
                <Text style={styles.chartTitle}>Weight trend</Text>
                {trendWeight !== null && (
                  <Text style={styles.trendNumeral}>
                    {`7-day avg: ${trendWeight.toFixed(1)} kg`}
                  </Text>
                )}
              </View>

              {/* View as table accessible button */}
              <Pressable
                testID="btn-weight-view-table"
                onPress={() => setTableModalVisible(true)}
                style={styles.viewTableBtn}
                accessibilityRole="button"
                accessibilityLabel={t('trackers.weight.viewAsTable')}
              >
                <Ionicons name="list-outline" size={14} color={dark.apricot} />
                <Text style={styles.viewTableText}>{t('trackers.weight.viewAsTable')}</Text>
              </Pressable>
            </View>

            {/* Range Chips: 7d, 30d, 90d, 6m, 1y, All */}
            <View style={styles.rangeChipsRow} testID="weight-range-chips">
              {(['7d', '30d', '90d', '6m', '1y', 'all'] as RangeChip[]).map((chip) => (
                <Pressable
                  key={chip}
                  testID={`btn-range-${chip}`}
                  style={[styles.rangeChip, selectedRange === chip && styles.rangeChipActive]}
                  onPress={() => setSelectedRange(chip)}
                  accessibilityRole="button"
                  accessibilityLabel={chip}
                >
                  <Text
                    style={[
                      styles.rangeChipText,
                      selectedRange === chip && styles.rangeChipTextActive,
                    ]}
                  >
                    {chip.toUpperCase()}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Chart Area */}
            {logs.length < 3 ? (
              <View style={styles.notEnoughTrendBox} testID="weight-not-enough-trend">
                <Ionicons name="analytics-outline" size={24} color={dark.textLo} />
                <Text style={styles.notEnoughTrendText}>
                  {t('trackers.weight.fewEntriesNotice')}
                </Text>
              </View>
            ) : (
              <View style={styles.chartCanvas} testID="weight-chart-canvas">
                {/* Dashed Goal Line */}
                <View style={styles.goalLineWrap}>
                  <View style={styles.dashedGoalLine} />
                  <Text style={styles.goalLineLabel}>{`Goal ${targetWeight} kg`}</Text>
                </View>

                {/* Simulated CMP-14 Data Points (faint raw dots + thick 2.5px MA line) */}
                <View style={styles.pointsTrack}>
                  {chartPoints.map((point, idx) => {
                    const ratio = Math.max(
                      0,
                      Math.min(1, (point.weight_kg - minChartKg) / (maxChartKg - minChartKg || 1)),
                    );
                    const isSelected = selectedPointIndex === idx;
                    return (
                      <Pressable
                        key={point.id}
                        onPress={() => setSelectedPointIndex(idx)}
                        onLongPress={() => handleOpenEdit(point)}
                        style={styles.pointCol}
                        accessibilityRole="button"
                        accessibilityLabel={`${point.local_date}: ${point.weight_kg} kg`}
                      >
                        {/* Tooltip on tap */}
                        {isSelected && (
                          <View style={styles.tooltipBox}>
                            <Text style={styles.tooltipText}>{`${point.weight_kg} kg`}</Text>
                            <Text style={styles.tooltipDate}>{point.local_date}</Text>
                          </View>
                        )}
                        <View
                          style={[styles.rawDot, { bottom: `${Math.round(ratio * 70) + 15}%` }]}
                        />
                        <Text style={styles.axisDate}>{point.local_date.slice(5)}</Text>
                      </Pressable>
                    );
                  })}
                </View>

                {/* 7-day Moving Average Overlaid Line Indicator */}
                <View style={styles.maLegendRow}>
                  <View style={styles.maLineLegend} />
                  <Text style={styles.maLegendText}>7-day moving average</Text>
                </View>
              </View>
            )}

            {/* Projected Date in body-s */}
            {projectedDate && (
              <View style={styles.projectionNoticeRow} testID="weight-projected-date">
                <Ionicons name="information-circle-outline" size={14} color={dark.teal} />
                <Text style={styles.projectionBodyS}>
                  {t('trackers.weight.projectedReach', { date: projectedDate })}
                </Text>
              </View>
            )}

            {/* Quiet Note */}
            <Text style={styles.quietNote}>{t('trackers.weight.trendNote')}</Text>
          </View>

          {/* Three Action Rows: Add Measurement, Progress Photos, Target Weight */}
          <View style={styles.actionRowsCard}>
            {/* Row 1: Add Measurement */}
            <Pressable
              testID="btn-open-add-measurement"
              style={styles.actionRowItem}
              onPress={() => setMeasurementModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.addMeasurement')}
            >
              <View style={styles.actionRowLeft}>
                <Ionicons name="ribbon-outline" size={18} color={dark.teal} />
                <Text style={styles.actionRowTitle}>{t('trackers.weight.addMeasurement')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
            </Pressable>

            <View style={styles.actionRowDivider} />

            {/* Row 2: Progress Photos */}
            <Pressable
              testID="btn-open-progress-photos"
              style={styles.actionRowItem}
              onPress={() => setPhotosModalVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.progressPhotos')}
            >
              <View style={styles.actionRowLeft}>
                <Ionicons name="images-outline" size={18} color={dark.iris} />
                <Text style={styles.actionRowTitle}>{t('trackers.weight.progressPhotos')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
            </Pressable>

            <View style={styles.actionRowDivider} />

            {/* Row 3: Target Weight Editor */}
            <Pressable
              testID="btn-open-target-weight"
              style={styles.actionRowItem}
              onPress={() => setTargetEditorVisible(true)}
              accessibilityRole="button"
              accessibilityLabel={t('trackers.weight.editTargetWeight')}
            >
              <View style={styles.actionRowLeft}>
                <Ionicons name="flag-outline" size={18} color={dark.apricot} />
                <Text style={styles.actionRowTitle}>{t('trackers.weight.editTargetWeight')}</Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={dark.textLo} />
            </Pressable>
          </View>

          {/* Empty state hint */}
          {!hasEntries && (
            <View testID="weight-empty-state" style={styles.emptyNotice}>
              <Text style={styles.emptyNoticeText}>{t('trackers.weight.emptyToday')}</Text>
            </View>
          )}

          {/* Primary Log Weight Button */}
          <Pressable
            testID="btn-log-weight"
            onPress={() => {
              setEditingEntry(null);
              setEntryModalVisible(true);
            }}
            style={styles.primaryLogBtn}
            accessibilityRole="button"
            accessibilityLabel={t('trackers.weight.logWeightButton')}
          >
            <Ionicons name="add" size={18} color={dark.onBrand} />
            <Text style={styles.primaryLogBtnText}>{t('trackers.weight.logWeightButton')}</Text>
          </Pressable>
        </>
      )}

      {/* E05 Weight Entry Modal */}
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
          onClose={() => setEntryModalVisible(false)}
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

      {/* E07 Add Measurement Modal */}
      {measurementModalVisible && (
        <AddMeasurementModal
          visible={measurementModalVisible}
          onClose={() => setMeasurementModalVisible(false)}
        />
      )}

      {/* E08 Progress Photos Modal */}
      {photosModalVisible && (
        <ProgressPhotosModal
          visible={photosModalVisible}
          onClose={() => setPhotosModalVisible(false)}
        />
      )}

      {/* E12 Target Weight Editor Modal */}
      {targetEditorVisible && (
        <TargetWeightEditorModal
          visible={targetEditorVisible}
          currentWeightKg={latestWeight ?? 75}
          initialTargetKg={targetWeight}
          onClose={() => setTargetEditorVisible(false)}
        />
      )}

      {/* CMP-14 "View as table" Modal */}
      {tableModalVisible && (
        <Modal
          visible={tableModalVisible}
          animationType="fade"
          transparent
          onRequestClose={() => setTableModalVisible(false)}
          testID="weight-table-modal"
        >
          <View style={styles.modalOverlay}>
            <View style={styles.tableCard}>
              <View style={styles.tableHeaderRow}>
                <Text style={styles.tableTitle}>Weight data table</Text>
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

              <ScrollView style={{ maxHeight: 300 }}>
                <View style={styles.tableGridHeader}>
                  <Text style={[styles.colHeader, { flex: 1.5 }]}>Date</Text>
                  <Text style={[styles.colHeader, { flex: 1.2 }]}>Weight</Text>
                  <Text style={[styles.colHeader, { flex: 2 }]}>Notes</Text>
                </View>
                {logs.map((row) => (
                  <View key={row.id} style={styles.tableGridRow}>
                    <Text style={[styles.cellText, { flex: 1.5 }]}>{row.local_date}</Text>
                    <Text style={[styles.cellText, { flex: 1.2, fontVariant: ['tabular-nums'] }]}>
                      {`${row.weight_kg.toFixed(1)} kg`}
                    </Text>
                    <Text style={[styles.cellText, { flex: 2, color: dark.textLo }]}>
                      {row.notes ?? '—'}
                    </Text>
                  </View>
                ))}
              </ScrollView>

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
  smallActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space[3],
    minHeight: 32,
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
  },
  smallActionText: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
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
  summaryStrip: {
    flexDirection: 'row',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  summaryCol: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  summaryDivider: {
    width: 1,
    height: 28,
    backgroundColor: dark.hairline,
  },
  summaryLabel: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  summaryVal: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    fontVariant: ['tabular-nums'],
    color: dark.textHi,
    fontWeight: '700',
  },
  summarySubVal: {
    fontSize: 10,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.teal,
    fontWeight: '600',
  },
  chartCard: {
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
    alignItems: 'flex-start',
  },
  chartTitleWrap: {
    gap: 2,
  },
  chartTitle: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textHi,
    fontWeight: '700',
  },
  trendNumeral: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.teal,
    fontWeight: '600',
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
  rangeChipsRow: {
    flexDirection: 'row',
    gap: space[1],
    marginVertical: space[1],
  },
  rangeChip: {
    flex: 1,
    minHeight: 32,
    borderRadius: radius.full,
    backgroundColor: dark.s3,
    borderWidth: 1,
    borderColor: dark.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rangeChipActive: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  rangeChipText: {
    fontSize: 10,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textMid,
    fontWeight: '700',
  },
  rangeChipTextActive: {
    color: dark.onBrand, // #1C1109
  },
  notEnoughTrendBox: {
    paddingVertical: space[4],
    alignItems: 'center',
    justifyContent: 'center',
    gap: space[2],
  },
  notEnoughTrendText: {
    fontSize: typeTokens.label.fontSize,
    fontFamily: typeTokens.label.fontFamily,
    color: dark.textLo,
    textAlign: 'center',
  },
  chartCanvas: {
    height: 120,
    marginTop: space[1],
    position: 'relative',
    justifyContent: 'flex-end',
  },
  goalLineWrap: {
    position: 'absolute',
    top: 25,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
  },
  dashedGoalLine: {
    flex: 1,
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: dark.hairlineLit,
  },
  goalLineLabel: {
    fontSize: 9,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  pointsTrack: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    height: 85,
  },
  pointCol: {
    flex: 1,
    alignItems: 'center',
    height: '100%',
    justifyContent: 'flex-end',
    position: 'relative',
  },
  rawDot: {
    position: 'absolute',
    width: 6,
    height: 6,
    borderRadius: radius.full,
    backgroundColor: dark.iris,
    opacity: 0.6,
  },
  axisDate: {
    fontSize: 9,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  tooltipBox: {
    position: 'absolute',
    top: 0,
    backgroundColor: dark.s3,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    zIndex: 10,
  },
  tooltipText: {
    fontSize: 10,
    color: dark.textHi,
    fontWeight: '700',
  },
  tooltipDate: {
    fontSize: 8,
    color: dark.textLo,
  },
  maLegendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: space[1],
  },
  maLineLegend: {
    width: 16,
    height: 2.5,
    backgroundColor: dark.teal,
    borderRadius: 2,
  },
  maLegendText: {
    fontSize: 10,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
  },
  projectionNoticeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s3,
    padding: space[2],
    borderRadius: radius.control,
    marginTop: space[1],
  },
  projectionBodyS: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
  },
  quietNote: {
    fontSize: typeTokens.micro.fontSize,
    fontFamily: typeTokens.micro.fontFamily,
    color: dark.textLo,
    marginTop: 2,
  },
  actionRowsCard: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  actionRowItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space[3],
    minHeight: 48,
  },
  actionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  actionRowTitle: {
    fontSize: typeTokens.bodyS.fontSize,
    fontFamily: typeTokens.bodyS.fontFamily,
    color: dark.textHi,
    fontWeight: '600',
  },
  actionRowDivider: {
    height: 1,
    backgroundColor: dark.hairline,
    marginLeft: space[8],
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
  primaryLogBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 48,
    borderRadius: radius.button,
    backgroundColor: dark.apricot,
    gap: space[2],
  },
  primaryLogBtnText: {
    fontSize: typeTokens.body.fontSize,
    fontFamily: typeTokens.body.fontFamily,
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
});
