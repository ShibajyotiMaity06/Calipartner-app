import React, { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { IndividualWaterProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { AccessibleChartTable, type TableColumn } from './AccessibleChartTable';
import { ChartContainer } from './ChartContainer';
import type { DayDetailData } from './DayDetailModal';

interface WaterChartProps {
  data?: IndividualWaterProgress | null;
  loading?: boolean;
  onSelectDay?: (day: DayDetailData) => void;
  testID?: string;
}

export function WaterChart({
  data,
  loading = false,
  onSelectDay,
  testID = 'water-chart',
}: WaterChartProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

  const daily = useMemo(() => data?.daily ?? [], [data?.daily]);
  const isEmpty = daily.length === 0 || daily.every((d) => d.water_ml === 0);

  // Table representation for accessibility (CMP-14)
  const tableColumns: TableColumn[] = [
    { key: 'date', header: 'Date', width: 90 },
    { key: 'intake', header: 'Intake', width: 85, align: 'right' },
    { key: 'goal', header: 'Goal', width: 85, align: 'right' },
    { key: 'status', header: 'Status', width: 95, align: 'center' },
  ];

  const tableRows = useMemo(() => {
    const targetWater = data?.goal_water_ml ?? 2500;
    return daily.map((d, i) => {
      const reached = targetWater > 0 && d.water_ml >= targetWater;
      return {
        id: d.date || String(i),
        date: d.date,
        intake: `${d.water_ml} ml`,
        goal: `${targetWater} ml`,
        status: d.water_ml === 0 ? 'Not logged' : reached ? 'Goal reached' : 'In progress',
      };
    });
  }, [daily, data?.goal_water_ml]);

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.water.empty');
    }
    return t('progress.water.accessibilitySummary', {
      avg: Math.round(data.average_water_ml),
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
      max = Math.max(max, d.water_ml);
    }
    const goal = data?.goal_water_ml ?? 2500;
    max = Math.max(max, goal);
    max = max === 0 ? 3000 : Math.ceil((max * 1.15) / 500) * 500;
    return { maxY: max, goalVal: goal };
  }, [daily, data?.goal_water_ml]);

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
      title={t('progress.water.title')}
      subtitle={
        data?.average_water_ml != null ? `${Math.round(data.average_water_ml)} ml / day` : undefined
      }
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.water.empty')}
      emptyIcon="water-outline"
      testID={testID}
      tableView={
        <AccessibleChartTable
          columns={tableColumns}
          rows={tableRows}
          caption="Daily water intake table"
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
            {maxY}
          </SvgText>
          <SvgText
            x={padLeft - 6}
            y={padTop + chartH / 2 + 4}
            fill={colors.textMuted}
            fontSize="10"
            textAnchor="end"
          >
            {Math.round(maxY / 2)}
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
            {t('progress.water.waterGoal')} {goalVal}ml
          </SvgText>

          {/* Water Bars */}
          {daily.map((day, index) => {
            const x = padLeft + index * slotW + (slotW - barW) / 2;
            const barH = (day.water_ml / (maxY || 1)) * chartH;
            const y = padTop + chartH - barH;

            const isGoalMet = day.water_ml >= goalVal;
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
                      waterMl: day.water_ml,
                      metricLabel: t('progress.water.title'),
                      metricValue: `${day.water_ml} ml`,
                    });
                  }}
                  accessibilityLabel={`Water on ${day.date}: ${day.water_ml} ml`}
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
            {t('progress.water.dailyAverage')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.average_water_ml != null ? `${Math.round(data.average_water_ml)} ml` : '--'}
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.water.waterGoal')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.goal_water_ml != null ? `${data.goal_water_ml} ml` : '--'}
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
