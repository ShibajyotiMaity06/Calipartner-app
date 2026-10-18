import React, { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import Svg, { Line, Path, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import type {
  ProgressMetric,
  RoomProgressDateRange,
  RoomProgressMemberSeries,
} from '@calipartner/core';
import { RangeSelector } from '@/components/progress/RangeSelector';
import { RoomProgressFocusView } from '@/components/focus';
import { useRoomProgress } from '@/hooks/useRoomProgress';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface RoomProgressViewProps {
  roomId: string;
  testID?: string;
}

const NEUTRAL_PALETTE = [
  '#3b82f6', // blue
  '#8b5cf6', // purple
  '#06b6d4', // cyan
  '#f59e0b', // amber
  '#ec4899', // pink
  '#10b981', // emerald
  '#64748b', // slate
];

const METRICS: ProgressMetric[] = [
  'consistency',
  'weight_change',
  'calories_vs_target',
  'steps',
  'water',
  'workouts',
];

export function RoomProgressView({ roomId, testID = 'room-progress-view' }: RoomProgressViewProps) {
  const { colors } = useTheme();

  const {
    range,
    setRange,
    selectedMemberIds,
    toggleMemberSelection,
    data,
    loading,
    error,
    refresh,
    searchMembers,
  } = useRoomProgress(roomId);

  const [selectedMetric, setSelectedMetric] = useState<ProgressMetric>('consistency');
  const [hiddenMemberIds, setHiddenMemberIds] = useState<string[]>([]);
  const [sortByConsistency, setSortByConsistency] = useState(false);

  // Large room member picker modal state
  const [showMemberPicker, setShowMemberPicker] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<
    Array<{
      user_id: string;
      nickname: string;
      username: string;
      status: string;
      is_locked: boolean;
    }>
  >([]);
  const [searching, setSearching] = useState(false);

  // Metric series
  const memberSeriesList: RoomProgressMemberSeries[] = useMemo(() => {
    return data?.members_series?.[selectedMetric] ?? [];
  }, [data?.members_series, selectedMetric]);

  const roomAvgSeries = useMemo(() => {
    return data?.room_average_series?.[selectedMetric] ?? [];
  }, [data?.room_average_series, selectedMetric]);

  // Color mapping per member
  const memberColorMap = useMemo(() => {
    const map = new Map<string, string>();
    memberSeriesList.forEach((m, i) => {
      map.set(m.user_id, NEUTRAL_PALETTE[i % NEUTRAL_PALETTE.length] ?? '#3b82f6');
    });
    return map;
  }, [memberSeriesList]);

  // Filter visible series
  const visibleSeries = useMemo(() => {
    return memberSeriesList.filter((m) => !hiddenMemberIds.includes(m.user_id));
  }, [memberSeriesList, hiddenMemberIds]);

  const toggleHideMember = (id: string) => {
    setHiddenMemberIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  // Summary Table ordering: Me first, then alphabetical (or consistency DESC if toggled)
  const sortedSummaryRows = useMemo(() => {
    const rows = [...(data?.summary_table ?? [])];
    if (sortByConsistency) {
      return rows.sort((a, b) => {
        const scoreA = typeof a.consistency_score === 'number' ? a.consistency_score : -1;
        const scoreB = typeof b.consistency_score === 'number' ? b.consistency_score : -1;
        return scoreB - scoreA;
      });
    }

    // Me first, then alphabetical
    return rows.sort((a, b) => {
      if (a.is_self) return -1;
      if (b.is_self) return 1;
      return (a.nickname ?? '').localeCompare(b.nickname ?? '');
    });
  }, [data?.summary_table, sortByConsistency]);

  // Chart coordinate calculations
  const width = 340;
  const height = 180;
  const padTop = 15;
  const padBottom = 25;
  const padLeft = 36;
  const padRight = 16;
  const chartW = width - padLeft - padRight;
  const chartH = height - padTop - padBottom;

  const { minY, maxY, dates } = useMemo(() => {
    let min = 999999;
    let max = -999999;
    const dateSet = new Set<string>();

    roomAvgSeries.forEach((pt) => {
      min = Math.min(min, pt.value);
      max = Math.max(max, pt.value);
      dateSet.add(pt.date);
    });

    visibleSeries.forEach((m) => {
      m.data.forEach((pt) => {
        if (pt.value != null) {
          min = Math.min(min, pt.value);
          max = Math.max(max, pt.value);
        }
        dateSet.add(pt.date);
      });
    });

    if (min === 999999 || max === -999999) {
      min = 0;
      max = 100;
    } else {
      const span = Math.max(max - min, 5);
      min = Math.floor(min - span * 0.1);
      max = Math.ceil(max + span * 0.1);
    }

    const sortedDates = Array.from(dateSet).sort();
    return { minY: min, maxY: max, dates: sortedDates };
  }, [visibleSeries, roomAvgSeries]);

  const getY = useCallback(
    (val: number) => {
      const ratio = (val - minY) / (maxY - minY || 1);
      return padTop + chartH - ratio * chartH;
    },
    [minY, maxY, chartH],
  );

  const getX = useCallback(
    (dateStr: string) => {
      const idx = dates.indexOf(dateStr);
      if (idx === -1 || dates.length <= 1) return padLeft + chartW / 2;
      return padLeft + (idx / (dates.length - 1)) * chartW;
    },
    [dates, chartW],
  );

  const getPathForData = useCallback(
    (dataPoints: Array<{ date: string; value: number | null }>) => {
      let path = '';
      dataPoints.forEach((pt) => {
        if (pt.value != null) {
          const x = getX(pt.date);
          const y = getY(pt.value);
          if (!path) {
            path = `M ${x} ${y}`;
          } else {
            path += ` L ${x} ${y}`;
          }
        }
      });
      return path;
    },
    [getX, getY],
  );

  const roomAvgPath = useMemo(() => {
    return getPathForData(roomAvgSeries);
  }, [roomAvgSeries, getPathForData]);

  const accessibilitySummary = t('progress.room.accessibilitySummary', {
    metric: selectedMetric,
  });

  // Handle Search in modal
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (!text.trim()) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const results = await searchMembers(text);
      setSearchResults(results);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const rangeOptions: RoomProgressDateRange[] = [
    '7d',
    '30d',
    '90d',
    '6m',
    '1y',
    'all',
    'since_start',
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      testID={testID}
    >
      {/* Date Range Selector */}
      <RangeSelector
        options={rangeOptions}
        selected={range}
        onSelect={(newRange) => setRange(newRange)}
        testID={`${testID}-range-selector`}
      />

      {/* Error Banner if any */}
      {error && (
        <View
          style={[
            styles.errorBanner,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="alert-circle-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.errorBannerText, { color: colors.text }]}>{error.message}</Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
            onPress={refresh}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {/* Metric Selector Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.metricsBar}
      >
        {METRICS.map((metric) => {
          const isSelected = metric === selectedMetric;
          const label =
            metric === 'consistency'
              ? t('progress.room.metrics.consistency')
              : metric === 'weight_change'
                ? t('progress.room.metrics.weightChange')
                : metric === 'calories_vs_target'
                  ? t('progress.room.metrics.caloriesVsTarget')
                  : metric === 'steps'
                    ? t('progress.room.metrics.steps')
                    : metric === 'water'
                      ? t('progress.room.metrics.water')
                      : t('progress.room.metrics.workouts');

          return (
            <Pressable
              key={metric}
              style={[
                styles.metricChip,
                { backgroundColor: isSelected ? colors.accent : colors.surfaceAlt },
              ]}
              onPress={() => setSelectedMetric(metric)}
              accessibilityRole="button"
              accessibilityLabel={`Select metric ${label}`}
              accessibilityState={{ selected: isSelected }}
              testID={`${testID}-metric-${metric}`}
            >
              <Text
                style={[styles.metricChipText, { color: isSelected ? '#ffffff' : colors.text }]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Member Chips & Filter */}
      <View style={styles.memberChipsContainer}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.memberChipsList}
        >
          {memberSeriesList.map((m) => {
            const isHidden = hiddenMemberIds.includes(m.user_id);
            const color = memberColorMap.get(m.user_id) ?? colors.accent;

            return (
              <Pressable
                key={m.user_id}
                style={[
                  styles.memberChip,
                  {
                    backgroundColor: isHidden ? colors.surfaceAlt : colors.surface,
                    borderColor: isHidden ? colors.border : color,
                    opacity: isHidden ? 0.6 : 1,
                  },
                ]}
                onPress={() => toggleHideMember(m.user_id)}
                accessibilityRole="button"
                accessibilityLabel={`${m.nickname} on chart. Tap to ${isHidden ? 'show' : 'hide'}`}
                testID={`${testID}-member-chip-${m.user_id}`}
              >
                <View style={[styles.colorDot, { backgroundColor: color }]} />
                <Text style={[styles.memberChipText, { color: colors.text }]}>
                  {m.nickname} {m.is_self ? '(You)' : ''}
                </Text>
                {m.is_locked_member && (
                  <Ionicons name="lock-closed" size={12} color={colors.textMuted} />
                )}
              </Pressable>
            );
          })}

          {data?.is_large_room && (
            <Pressable
              style={[
                styles.memberChip,
                styles.searchMemberChip,
                { backgroundColor: colors.surfaceAlt },
              ]}
              onPress={() => setShowMemberPicker(true)}
              testID={`${testID}-open-member-picker`}
            >
              <Ionicons name="person-add-outline" size={14} color={colors.text} />
              <Text style={[styles.memberChipText, { color: colors.text }]}>+ Select Members</Text>
            </Pressable>
          )}
        </ScrollView>
      </View>

      {/* Chart Section */}
      <View
        style={[styles.chartCard, { backgroundColor: colors.surface }]}
        accessibilityRole="summary"
        accessibilityLabel={accessibilitySummary}
      >
        <View style={styles.chartHeader}>
          <Text style={[styles.chartTitle, { color: colors.text }]}>
            {selectedMetric.replace('_', ' ').toUpperCase()}
          </Text>
          <View style={styles.avgLegend}>
            <View style={[styles.dashedLineLegend, { borderColor: '#64748b' }]} />
            <Text style={[styles.avgLegendText, { color: colors.textMuted }]}>
              {t('progress.room.roomAverage')}
            </Text>
          </View>
        </View>

        {loading ? (
          <View style={styles.skeletonContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
          </View>
        ) : memberSeriesList.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="stats-chart-outline" size={32} color={colors.textMuted} />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              {t('progress.room.empty')}
            </Text>
          </View>
        ) : (
          <View style={styles.svgWrapper}>
            <Svg width={width} height={height}>
              {/* Y Axis Grid lines */}
              <Line
                x1={padLeft}
                y1={padTop}
                x2={width - padRight}
                y2={padTop}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="2 2"
              />
              <Line
                x1={padLeft}
                y1={padTop + chartH / 2}
                x2={width - padRight}
                y2={padTop + chartH / 2}
                stroke={colors.border}
                strokeWidth={0.5}
                strokeDasharray="2 2"
              />
              <Line
                x1={padLeft}
                y1={padTop + chartH}
                x2={width - padRight}
                y2={padTop + chartH}
                stroke={colors.border}
                strokeWidth={1}
              />

              {/* Y Labels */}
              <SvgText
                x={padLeft - 6}
                y={padTop + 4}
                fill={colors.textMuted}
                fontSize="10"
                textAnchor="end"
              >
                {maxY.toFixed(0)}
              </SvgText>
              <SvgText
                x={padLeft - 6}
                y={padTop + chartH / 2 + 4}
                fill={colors.textMuted}
                fontSize="10"
                textAnchor="end"
              >
                {((maxY + minY) / 2).toFixed(0)}
              </SvgText>
              <SvgText
                x={padLeft - 6}
                y={padTop + chartH + 4}
                fill={colors.textMuted}
                fontSize="10"
                textAnchor="end"
              >
                {minY.toFixed(0)}
              </SvgText>

              {/* Room Average Line */}
              {roomAvgPath ? (
                <Path
                  d={roomAvgPath}
                  stroke="#64748b"
                  strokeWidth={2}
                  strokeDasharray="4 4"
                  fill="none"
                />
              ) : null}

              {/* Member Lines */}
              {visibleSeries.map((m) => {
                const path = getPathForData(m.data);
                const color = memberColorMap.get(m.user_id) ?? colors.accent;
                if (!path) return null;

                return (
                  <Path
                    key={m.user_id}
                    d={path}
                    stroke={color}
                    strokeWidth={2}
                    fill="none"
                    strokeLinecap="round"
                  />
                );
              })}
            </Svg>
          </View>
        )}
      </View>

      {/* Period Summary Table */}
      <View style={[styles.tableCard, { backgroundColor: colors.surface }]}>
        <View style={styles.tableHeader}>
          <Text style={[styles.tableTitle, { color: colors.text }]}>
            {t('progress.room.summaryTableTitle')}
          </Text>

          {/* Sort only by Consistency (PRD RPG-6) */}
          <Pressable
            style={[
              styles.sortBtn,
              {
                backgroundColor: sortByConsistency ? colors.accent : colors.surfaceAlt,
              },
            ]}
            onPress={() => setSortByConsistency(!sortByConsistency)}
            accessibilityRole="button"
            accessibilityLabel={t('progress.room.sortConsistency')}
            testID={`${testID}-sort-consistency`}
          >
            <Ionicons
              name="swap-vertical"
              size={12}
              color={sortByConsistency ? '#ffffff' : colors.text}
            />
            <Text
              style={[styles.sortBtnText, { color: sortByConsistency ? '#ffffff' : colors.text }]}
            >
              {t('progress.room.sortConsistency')}
            </Text>
          </Pressable>
        </View>

        {sortedSummaryRows.map((row) => {
          return (
            <View
              key={row.user_id}
              style={[
                styles.rowCard,
                { borderBottomColor: colors.border },
                row.is_self && [styles.meRowCard, { backgroundColor: colors.surfaceAlt }],
              ]}
              testID={`${testID}-row-${row.user_id}`}
            >
              <View style={styles.rowMain}>
                <View style={styles.nameRow}>
                  <Text style={[styles.nameText, { color: colors.text }]}>
                    {row.nickname} {row.is_self ? t('progress.room.meLabel') : ''}
                  </Text>
                  {row.is_locked_member && (
                    <View style={styles.lockBadge}>
                      <Ionicons name="lock-closed" size={10} color={colors.textMuted} />
                      <Text style={[styles.lockText, { color: colors.textMuted }]}>
                        {t('progress.room.lockedMember')}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Consistency Score Badge */}
                <View style={styles.consistencyPill}>
                  <Text style={[styles.consistencyLabel, { color: colors.textMuted }]}>Score:</Text>
                  <Text style={[styles.consistencyValue, { color: colors.accent }]}>
                    {typeof row.consistency_score === 'number'
                      ? row.consistency_score.toFixed(1)
                      : 'Locked'}
                  </Text>
                </View>
              </View>

              {/* Metric Values Grid */}
              <View style={styles.rowDetails}>
                <View style={styles.detailItem}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Weight</Text>
                  <Text style={[styles.detailVal, { color: colors.text }]}>
                    {typeof row.weight_change_kg === 'number'
                      ? `${row.weight_change_kg > 0 ? '+' : ''}${row.weight_change_kg.toFixed(1)} kg`
                      : row.weight_change_kg === 'locked'
                        ? '🔒 Private'
                        : '--'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Cal vs Target</Text>
                  <Text style={[styles.detailVal, { color: colors.text }]}>
                    {typeof row.average_calories_vs_target_pct === 'number'
                      ? `${Math.round(row.average_calories_vs_target_pct)}%`
                      : row.average_calories_vs_target_pct === 'locked'
                        ? '🔒 Private'
                        : '--'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Steps Avg</Text>
                  <Text style={[styles.detailVal, { color: colors.text }]}>
                    {typeof row.average_steps === 'number'
                      ? Math.round(row.average_steps).toLocaleString()
                      : row.average_steps === 'locked'
                        ? '🔒 Private'
                        : '--'}
                  </Text>
                </View>

                <View style={styles.detailItem}>
                  <Text style={[styles.detailKey, { color: colors.textMuted }]}>Workouts</Text>
                  <Text style={[styles.detailVal, { color: colors.text }]}>
                    {typeof row.total_workouts === 'number'
                      ? row.total_workouts
                      : row.total_workouts === 'locked'
                        ? '🔒 Private'
                        : '--'}
                  </Text>
                </View>
              </View>
            </View>
          );
        })}
      </View>

      {/* Room Weekly Focus Totals (PRD RPG-8) */}
      <RoomProgressFocusView roomId={roomId} testID={`${testID}-focus`} />

      {/* Searchable Member Picker Modal for Large Rooms (PRD RPG-7) */}
      <Modal
        visible={showMemberPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowMemberPicker(false)}
      >
        <View style={styles.modalBackdrop}>
          <View style={[styles.modalCard, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                {t('progress.room.showHideMembers')}
              </Text>
              <Pressable onPress={() => setShowMemberPicker(false)} style={styles.modalCloseBtn}>
                <Ionicons name="close" size={20} color={colors.text} />
              </Pressable>
            </View>

            <TextInput
              style={[
                styles.searchInput,
                { backgroundColor: colors.surfaceAlt, color: colors.text },
              ]}
              placeholder={t('progress.room.searchMembers')}
              placeholderTextColor={colors.textMuted}
              value={searchQuery}
              onChangeText={handleSearch}
              testID={`${testID}-search-input`}
            />

            {searching && (
              <ActivityIndicator
                size="small"
                color={colors.accent}
                style={{ marginVertical: spacing.md }}
              />
            )}

            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.user_id}
              style={{ maxHeight: 280 }}
              renderItem={({ item }) => {
                const isSelected = selectedMemberIds.includes(item.user_id);
                return (
                  <Pressable
                    style={[styles.searchResultRow, { borderBottomColor: colors.border }]}
                    onPress={() => toggleMemberSelection(item.user_id)}
                  >
                    <View>
                      <Text style={[styles.resultNickname, { color: colors.text }]}>
                        {item.nickname}
                      </Text>
                      <Text style={[styles.resultUsername, { color: colors.textMuted }]}>
                        @{item.username}
                      </Text>
                    </View>
                    <Ionicons
                      name={isSelected ? 'checkbox' : 'square-outline'}
                      size={20}
                      color={colors.accent}
                    />
                  </Pressable>
                );
              }}
            />

            <Pressable
              style={[styles.modalDoneBtn, { backgroundColor: colors.accent }]}
              onPress={() => setShowMemberPicker(false)}
            >
              <Text style={styles.modalDoneText}>Done</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: spacing.xl,
  },
  metricsBar: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
    marginVertical: spacing.xs,
  },
  metricChip: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.pill,
  },
  metricChipText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  memberChipsContainer: {
    marginVertical: spacing.xs,
  },
  memberChipsList: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs,
  },
  memberChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.pill,
    borderWidth: 1,
    gap: 6,
  },
  searchMemberChip: {
    borderStyle: 'dashed',
  },
  colorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  memberChipText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  chartCard: {
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    elevation: 2,
  },
  chartHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  chartTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  avgLegend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  dashedLineLegend: {
    width: 14,
    height: 0,
    borderTopWidth: 2,
    borderStyle: 'dashed',
  },
  avgLegendText: {
    fontSize: 10,
  },
  svgWrapper: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  skeletonContainer: {
    height: 180,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    height: 140,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  emptyText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
  },
  tableCard: {
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  tableHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  tableTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  sortBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
  sortBtnText: {
    fontSize: 10,
    fontWeight: '600',
  },
  rowCard: {
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.xs,
  },
  meRowCard: {
    borderRadius: radius.sm,
    paddingHorizontal: spacing.xs,
  },
  rowMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  nameText: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  lockBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  lockText: {
    fontSize: 10,
  },
  consistencyPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  consistencyLabel: {
    fontSize: fontSize.xs,
  },
  consistencyValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  rowDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  detailItem: {
    alignItems: 'flex-start',
  },
  detailKey: {
    fontSize: 10,
  },
  detailVal: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 400,
    borderRadius: radius.lg,
    padding: spacing.md,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  modalTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  modalCloseBtn: {
    padding: 4,
  },
  searchInput: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    borderRadius: radius.sm,
    fontSize: fontSize.sm,
    marginBottom: spacing.sm,
  },
  searchResultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  resultNickname: {
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  resultUsername: {
    fontSize: fontSize.xs,
  },
  modalDoneBtn: {
    marginTop: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  modalDoneText: {
    color: '#ffffff',
    fontSize: fontSize.sm,
    fontWeight: '600',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginVertical: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  errorBannerText: {
    flex: 1,
    fontSize: fontSize.xs,
  },
  retryBtn: {
    paddingHorizontal: spacing.sm + 4,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  retryBtnText: {
    color: '#ffffff',
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
