import React, { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { ProgressDateRange } from '@calipartner/core';
import { ChartContainer } from '@/components/progress/ChartContainer';
import { usePersonalFocusStats } from '@/hooks/useFocusStats';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { formatMinutesDisplay } from './focusUIUtils';

export interface FocusProgressChartProps {
  range?: ProgressDateRange;
  userId?: string;
  testID?: string;
}

const NEUTRAL_LABEL_COLORS = ['#3b82f6', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#64748b'];

export function FocusProgressChart({
  range = '30d',
  userId,
  testID = 'progress-chart-focus',
}: FocusProgressChartProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

  // Determine start date based on range
  const { startDate, endDate } = useMemo(() => {
    const end = new Date();
    const start = new Date();
    const days =
      range === '7d'
        ? 7
        : range === '30d'
          ? 30
          : range === '90d'
            ? 90
            : range === '6m'
              ? 180
              : range === '1y'
                ? 365
                : 30;
    start.setDate(start.getDate() - days + 1);
    return {
      startDate: start.toISOString().slice(0, 10),
      endDate: end.toISOString().slice(0, 10),
    };
  }, [range]);

  const { stats, loading, error } = usePersonalFocusStats(startDate, endDate, userId);

  const days = useMemo(() => stats?.daily_breakdown ?? [], [stats?.daily_breakdown]);
  const isEmpty = days.length === 0 || days.every((d) => d.focus_minutes === 0);

  const totalMinutes = stats?.total_focus_minutes ?? 0;
  const longestSessionMinutes = stats?.longest_session_minutes ?? 0;
  const avgMinutesPerDay = days.length > 0 ? Math.round(totalMinutes / days.length) : 0;
  const weeklyGoalHours = stats?.weekly_goal_minutes
    ? Math.round(stats.weekly_goal_minutes / 60)
    : 0;
  const dailyGoalMinutes =
    stats?.weekly_goal_minutes && stats.weekly_goal_minutes > 0
      ? Math.round(stats.weekly_goal_minutes / 7)
      : null;

  const accessibilitySummary = useMemo(() => {
    if (isEmpty) {
      return t('focus.stats.emptyState');
    }
    return `Focus time chart showing ${days.length} days. Total focus time is ${formatMinutesDisplay(
      totalMinutes,
    )}, averaging ${avgMinutesPerDay} minutes per day. Longest session was ${formatMinutesDisplay(
      longestSessionMinutes,
    )}.`;
  }, [isEmpty, days.length, totalMinutes, avgMinutesPerDay, longestSessionMinutes]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 5) {
      setContainerWidth(width);
    }
  };

  const height = 180;
  const padTop = 15;
  const padBottom = 25;
  const padLeft = 40;
  const padRight = 16;
  const chartW = Math.max(containerWidth - padLeft - padRight, 100);
  const chartH = height - padTop - padBottom;

  const maxY = useMemo(() => {
    let max = 0;
    for (const d of days) {
      max = Math.max(max, d.focus_minutes);
    }
    const goal = dailyGoalMinutes ?? 60;
    max = Math.max(max, goal);
    max = max === 0 ? 60 : Math.ceil((max * 1.2) / 30) * 30;
    return max;
  }, [days, dailyGoalMinutes]);

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / (maxY || 1)));
    return padTop + chartH - ratio * chartH;
  };

  const barCount = Math.max(days.length, 1);
  const slotW = chartW / barCount;
  const barW = Math.max(Math.min(slotW * 0.7, 18), 3);

  return (
    <ChartContainer
      title={t('focus.stats.title')}
      subtitle={
        !isEmpty
          ? `Total: ${formatMinutesDisplay(totalMinutes)} • Avg: ${avgMinutesPerDay}m / day`
          : undefined
      }
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('focus.stats.emptyState')}
      emptyIcon="timer-outline"
      testID={testID}
    >
      {error ? (
        <View style={styles.errorContainer} testID="focus-chart-error">
          <Ionicons name="alert-circle-outline" size={20} color={colors.textMuted} />
          <Text style={[styles.errorText, { color: colors.textMuted }]}>{error.message}</Text>
        </View>
      ) : null}
      <View onLayout={onLayout} style={styles.chartWrapper}>
        {/* Metric Highlights Row */}
        <View style={styles.highlightPillsRow} testID="focus-chart-summary">
          <View
            testID="focus-longest-session"
            style={[
              styles.statPill,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Text style={[styles.statPillLabel, { color: colors.textMuted }]}>
              {t('focus.stats.longestSession')}
            </Text>
            <Text style={[styles.statPillValue, { color: colors.text }]}>
              {formatMinutesDisplay(longestSessionMinutes)}
            </Text>
          </View>

          {weeklyGoalHours > 0 ? (
            <View
              style={[
                styles.statPill,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.statPillLabel, { color: colors.textMuted }]}>Weekly Goal</Text>
              <Text style={[styles.statPillValue, { color: colors.text }]}>
                {weeklyGoalHours}h / week
              </Text>
            </View>
          ) : null}
        </View>

        {/* SVG Daily Bars */}
        <Svg width={containerWidth} height={height}>
          {/* Y Axis Grid lines */}
          <Line
            x1={padLeft}
            y1={padTop}
            x2={containerWidth - padRight}
            y2={padTop}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <Line
            x1={padLeft}
            y1={padTop + chartH / 2}
            x2={containerWidth - padRight}
            y2={padTop + chartH / 2}
            stroke={colors.border}
            strokeWidth={1}
            strokeDasharray="4,4"
          />
          <Line
            x1={padLeft}
            y1={padTop + chartH}
            x2={containerWidth - padRight}
            y2={padTop + chartH}
            stroke={colors.border}
            strokeWidth={1}
          />

          {/* Goal Line if configured */}
          {dailyGoalMinutes && (
            <Line
              x1={padLeft}
              y1={getY(dailyGoalMinutes)}
              x2={containerWidth - padRight}
              y2={getY(dailyGoalMinutes)}
              stroke={colors.accent}
              strokeWidth={1.5}
              strokeDasharray="3,3"
            />
          )}

          {/* Y-axis Labels */}
          <SvgText
            x={padLeft - 6}
            y={padTop + 4}
            fontSize="10"
            fill={colors.textMuted}
            textAnchor="end"
          >
            {maxY}m
          </SvgText>
          <SvgText
            x={padLeft - 6}
            y={padTop + chartH / 2 + 3}
            fontSize="10"
            fill={colors.textMuted}
            textAnchor="end"
          >
            {Math.round(maxY / 2)}m
          </SvgText>

          {/* Daily Bars */}
          {days.map((day, idx) => {
            const barH = (day.focus_minutes / (maxY || 1)) * chartH;
            const x = padLeft + idx * slotW + (slotW - barW) / 2;
            const y = padTop + chartH - barH;
            const isGoalMet = dailyGoalMinutes && day.focus_minutes >= dailyGoalMinutes;

            return (
              <Rect
                key={day.local_date}
                x={x}
                y={y}
                width={barW}
                height={Math.max(barH, 0)}
                fill={isGoalMet ? colors.accent : colors.macroCalories}
                rx={2}
              />
            );
          })}
        </Svg>

        {/* Labels Breakdown Section (PRG-14, FOC-10) */}
        {Boolean(stats?.label_breakdown && stats.label_breakdown.length > 0) && (
          <View
            testID="focus-labels-breakdown"
            style={[styles.labelsBreakdownBox, { borderTopColor: colors.border }]}
          >
            <Text style={[styles.breakdownTitle, { color: colors.text }]}>
              {t('focus.stats.labelsBreakdown')}
            </Text>
            <View style={styles.labelsList}>
              {stats!.label_breakdown.map((item, idx) => {
                const color =
                  NEUTRAL_LABEL_COLORS[idx % NEUTRAL_LABEL_COLORS.length] ?? colors.accent;
                const pct = totalMinutes > 0 ? Math.round((item.minutes / totalMinutes) * 100) : 0;

                return (
                  <View key={item.label} style={styles.labelRow}>
                    <View style={styles.labelLeft}>
                      <View style={[styles.colorSquare, { backgroundColor: color }]} />
                      <Text style={[styles.labelName, { color: colors.text }]}>{item.label}</Text>
                    </View>
                    <View style={styles.labelRight}>
                      <Text style={[styles.labelMins, { color: colors.textMuted }]}>
                        {formatMinutesDisplay(item.minutes)} ({pct}%)
                      </Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </View>
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    paddingVertical: spacing.xs,
  },
  highlightPillsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  statPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 2,
  },
  statPillLabel: {
    fontSize: 10,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  statPillValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  labelsBreakdownBox: {
    borderTopWidth: 1,
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.xs,
    gap: spacing.xs,
  },
  breakdownTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  labelsList: {
    gap: 6,
    marginTop: 2,
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  colorSquare: {
    width: 10,
    height: 10,
    borderRadius: 2,
  },
  labelName: {
    fontSize: fontSize.xs,
    fontWeight: '500',
  },
  labelRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  labelMins: {
    fontSize: fontSize.xs,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: spacing.md,
  },
  errorText: {
    fontSize: fontSize.sm,
  },
});
