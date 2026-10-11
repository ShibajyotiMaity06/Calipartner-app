import React, { useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import {
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Line, Rect, Text as SvgText } from 'react-native-svg';
import type { IndividualCaloriesProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { ChartContainer } from './ChartContainer';
import type { DayDetailData } from './DayDetailModal';

interface CaloriesChartProps {
  data?: IndividualCaloriesProgress | null;
  loading?: boolean;
  onSelectDay?: (day: DayDetailData) => void;
  testID?: string;
}

export function CaloriesChart({
  data,
  loading = false,
  onSelectDay,
  testID = 'calories-chart',
}: CaloriesChartProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

  const daily = useMemo(() => data?.daily ?? [], [data?.daily]);
  const isEmpty = daily.length === 0 || daily.every((d) => d.calories === 0);

  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.calories.empty');
    }
    return t('progress.calories.accessibilitySummary', {
      average: Math.round(data.average_calories),
      target: Math.round(data.average_target),
    });
  }, [isEmpty, data]);

  const onLayout = (e: LayoutChangeEvent) => {
    const width = e.nativeEvent.layout.width;
    if (width > 0 && Math.abs(width - containerWidth) > 5) {
      setContainerWidth(width);
    }
  };

  // Dimensions
  const height = 180;
  const padTop = 15;
  const padBottom = 25;
  const padLeft = 36;
  const padRight = 16;
  const chartW = Math.max(containerWidth - padLeft - padRight, 100);
  const chartH = height - padTop - padBottom;

  // Scales
  const { maxY, targetYVal } = useMemo(() => {
    let max = 0;
    for (const d of daily) {
      max = Math.max(max, d.calories, d.target_calories);
    }
    if (max === 0) {
      max = 2500;
    } else {
      max = Math.ceil(max * 1.15 / 100) * 100;
    }
    const target = data?.average_target ?? 2000;
    return { maxY: max, targetYVal: target };
  }, [daily, data?.average_target]);

  const getY = (val: number) => {
    const ratio = Math.min(1, Math.max(0, val / (maxY || 1)));
    return padTop + chartH - ratio * chartH;
  };

  const targetLineY = getY(targetYVal);

  const barCount = Math.max(daily.length, 1);
  const slotW = chartW / barCount;
  const barW = Math.max(Math.min(slotW * 0.7, 18), 3);

  return (
    <ChartContainer
      title={t('progress.calories.title')}
      subtitle={
        data?.average_calories != null
          ? `${Math.round(data.average_calories)} kcal / day`
          : undefined
      }
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.calories.empty')}
      emptyIcon="flame-outline"
      testID={testID}
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

          {/* Y Axis Labels */}
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

          {/* Target Dashed Line */}
          <Line
            x1={padLeft}
            y1={targetLineY}
            x2={containerWidth - padRight}
            y2={targetLineY}
            stroke={colors.accent}
            strokeWidth={1.5}
            strokeDasharray="4 4"
          />
          <SvgText
            x={containerWidth - padRight - 2}
            y={targetLineY - 4}
            fill={colors.accent}
            fontSize="9"
            textAnchor="end"
          >
            {t('progress.calories.target')} {Math.round(targetYVal)}
          </SvgText>

          {/* Bars */}
          {daily.map((day, index) => {
            const x = padLeft + index * slotW + (slotW - barW) / 2;
            const barH = (day.calories / (maxY || 1)) * chartH;
            const y = padTop + chartH - barH;

            // Neutral styling: Goal days use primary accent, other logged days use slightly softer tone
            const barFill = day.is_goal_day ? colors.accent : colors.surfaceAlt;
            const barBorder = day.is_logged_day ? colors.accent : colors.border;

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
                      calories: day.calories,
                      targetCalories: day.target_calories,
                      isLoggedDay: day.is_logged_day,
                      isGoalDay: day.is_goal_day,
                    });
                  }}
                  accessibilityLabel={`Calories on ${day.date}: ${Math.round(day.calories)} of ${Math.round(day.target_calories)} kcal`}
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
            {t('progress.calories.average')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.average_calories != null ? Math.round(data.average_calories) : '--'} kcal
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.calories.target')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.average_target != null ? Math.round(data.average_target) : '--'} kcal
          </Text>
        </View>

        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: colors.textMuted }]}>
            {t('progress.calories.adherence')}
          </Text>
          <Text style={[styles.statValue, { color: colors.text }]}>
            {data?.adherence_pct != null ? `${Math.round(data.adherence_pct)}%` : '--%'}
          </Text>
          {data?.logged_days_count != null && (
            <Text style={[styles.subStatText, { color: colors.textMuted }]}>
              {t('progress.calories.adherenceSubtitle', {
                goalDays: data.goal_days_count,
                loggedDays: data.logged_days_count,
              })}
            </Text>
          )}
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
  subStatText: {
    fontSize: 10,
    marginTop: 2,
  },
});
