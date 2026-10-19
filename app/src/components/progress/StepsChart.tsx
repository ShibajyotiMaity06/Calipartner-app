import React, { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { IndividualStepsProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AccessibleChartTable, type TableColumn } from './AccessibleChartTable';
import { ChartContainer } from './ChartContainer';
import type { DayDetailData } from './DayDetailModal';

interface StepsChartProps {
  data?: IndividualStepsProgress | null;
  loading?: boolean;
  onSelectDay?: (day: DayDetailData) => void;
  testID?: string;
}

export function StepsChart({
  data,
  loading = false,
  onSelectDay,
  testID = 'steps-chart',
}: StepsChartProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

  const daily = useMemo(() => data?.daily ?? [], [data?.daily]);
  const isEmpty = daily.length === 0 || daily.every((d) => d.steps === 0);

  // Table representation for accessibility (CMP-14)
  const tableColumns: TableColumn[] = [
    { key: 'date', header: 'Date', width: 90 },
    { key: 'steps', header: 'Steps', width: 85, align: 'right' },
    { key: 'goal', header: 'Goal', width: 85, align: 'right' },
    { key: 'dist', header: 'Distance', width: 85, align: 'right' },
    { key: 'status', header: 'Status', width: 95, align: 'center' },
  ];

  const tableRows = useMemo(() => {
    const targetSteps = data?.goal_steps ?? 10000;
    return daily.map((d, i) => {
      const reached = targetSteps > 0 && d.steps >= targetSteps;
      return {
        id: d.date || String(i),
        date: d.date,
        steps: d.steps.toLocaleString(),
        goal: targetSteps.toLocaleString(),
        dist: `${d.distance_km.toFixed(1)} km`,
        status: d.steps === 0 ? 'Not tracked' : reached ? 'Goal reached' : 'In progress',
      };
    });
  }, [daily, data?.goal_steps]);

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.steps.empty');
    }
    return t('progress.steps.accessibilitySummary', {
      avg: Math.round(data.average_steps).toLocaleString(),
      dist: data.total_distance_km.toFixed(1),
    });
  }, [isEmpty, data]);

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

  const { maxY, goalVal } = useMemo(() => {
    let max = 0;
    for (const d of daily) {
      max = Math.max(max, d.steps);
    }
    const goal = data?.goal_steps ?? 10000;
    max = Math.max(max, goal);
    max = max === 0 ? 10000 : Math.ceil((max * 1.15) / 1000) * 1000;
    return { maxY: max, goalVal: goal };
  }, [daily, data?.goal_steps]);

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / (maxY || 1)));
    return padTop + chartH - ratio * chartH;
  };

  const goalLineY = getY(goalVal);
  const barCount = Math.max(daily.length, 1);
  const slotW = chartW / barCount;
  const barW = Math.max(Math.min(slotW * 0.7, 18), 3);

  return (
    <ChartContainer
      title={t('progress.steps.title')}
      subtitle={
        data?.average_steps != null
          ? `${Math.round(data.average_steps).toLocaleString()} steps / day`
          : undefined
      }
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.steps.empty')}
      emptyIcon="footsteps-outline"
      testID={testID}
      tableView={
        <AccessibleChartTable
          columns={tableColumns}
          rows={tableRows}
          caption="Daily steps and walking distance table"
          testID={`${testID}-table`}
        />
      }
    >
      <View onLayout={onLayout} style={styles.chartWrapper}>
        <Svg width={containerWidth} height={height}>
          {/* Y Axis Grid lines */}
          <Line
            x1={padLeft}
            y1={padTop}
            x2={containerWidth - padRight}
            y2={padTop}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
          <Line
            x1={padLeft}
            y1={padTop + chartH / 2}
            x2={containerWidth - padRight}
            y2={padTop + chartH / 2}
            stroke={colors.border}
            strokeWidth={0.5}
            strokeDasharray="2 2"
          />
          <Line
            x1={padLeft}
            y1={padTop + chartH}
            x2={containerWidth - padRight}
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
            {maxY >= 1000 ? `${(maxY / 1000).toFixed(0)}k` : maxY}
          </SvgText>
          <SvgText
            x={padLeft - 6}
            y={padTop + chartH / 2 + 4}
            fill={colors.textMuted}
            fontSize="10"
            textAnchor="end"
          >
            {maxY >= 2000 ? `${(maxY / 2000).toFixed(0)}k` : Math.round(maxY / 2)}
          </SvgText>
          <SvgText
            x={padLeft - 6}
            y={padTop + chartH + 4}
            fill={colors.textMuted}
            fontSize="10"
            textAnchor="end"
          >
            0
          </SvgText>

          {/* Goal Line */}
          <Line
            x1={padLeft}
            y1={goalLineY}
            x2={containerWidth - padRight}
            y2={goalLineY}
            stroke={colors.accent}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <SvgText
            x={containerWidth - padRight - 2}
            y={goalLineY - 4}
            fill={colors.accent}
            fontSize="9"
            textAnchor="end"
          >
            {t('progress.steps.goalSteps')} {goalVal.toLocaleString()}
          </SvgText>

          {/* Step Bars */}
          {daily.map((day, index) => {
            const x = padLeft + index * slotW + (slotW - barW) / 2;
            const barH = (day.steps / (maxY || 1)) * chartH;
            const y = padTop + chartH - barH;

            const isGoalMet = day.steps >= goalVal;
            const barFill = isGoalMet ? colors.accent : colors.surfaceAlt;
            const barBorder = isGoalMet ? colors.accent : colors.border;

            return (
              <React.Fragment key={day.date}>
                <Rect
                  x={x}
                  y={y}
                  width={barW}
                  height={Math.max(barH, 1)}
                  rx={2}
                  fill={barFill}
                  stroke={barBorder}
                  strokeWidth={1}
                />
                {/* Touch Area */}
                <Rect
                  x={padLeft + index * slotW}
                  y={padTop}
                  width={slotW}
                  height={chartH}
                  fill="transparent"
                  onPress={() => {
                    onSelectDay?.({
                      date: day.date,
                      steps: day.steps,
                      metricLabel: t('progress.steps.title'),
                      metricValue: `${day.steps.toLocaleString()} steps (${day.distance_km.toFixed(1)} km)`,
                    });
                  }}
                  accessibilityLabel={`Steps on ${day.date}: ${day.steps.toLocaleString()}`}
                />
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* Summary Row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.steps.averageSteps')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.average_steps != null ? Math.round(data.average_steps).toLocaleString() : '--'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.steps.totalDistance')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.total_distance_km != null ? `${data.total_distance_km.toFixed(1)} km` : '-- km'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.steps.goalSteps')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.goal_steps != null ? data.goal_steps.toLocaleString() : '--'}
          </Text>
        </View>
      </View>
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  statBox: {
    flex: 1,
  },
  statLabel: {
    fontSize: fontSize.xs,
    marginBottom: 2,
  },
  statValue: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
