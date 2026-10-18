import React, { useCallback, useMemo, useState } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path, Text as SvgText } from 'react-native-svg';
import type { IndividualWeightProgress } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { ChartContainer } from './ChartContainer';
import type { DayDetailData } from './DayDetailModal';

interface WeightChartProps {
  data?: IndividualWeightProgress | null;
  loading?: boolean;
  onSelectDay?: (day: DayDetailData) => void;
  testID?: string;
}

export function WeightChart({
  data,
  loading = false,
  onSelectDay,
  testID = 'weight-chart',
}: WeightChartProps) {
  const { colors } = useTheme();
  const [containerWidth, setContainerWidth] = useState(320);

  const history = useMemo(() => data?.history ?? [], [data?.history]);

  // Points with actual weight data
  const validPoints = useMemo(() => {
    return history.filter((h) => h.raw_weight_kg != null || h.trend_weight_kg != null);
  }, [history]);

  const isEmpty = validPoints.length === 0;

  // Accessibility summary text
  const accessibilitySummary = useMemo(() => {
    if (isEmpty || !data) {
      return t('progress.weight.empty');
    }
    return t('progress.weight.accessibilitySummary', {
      start: (data.start_weight_kg ?? data.current_weight_kg ?? 0).toFixed(1),
      current: (data.current_weight_kg ?? 0).toFixed(1),
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
  const { minY, maxY, pointsCount } = useMemo(() => {
    let min = 9999;
    let max = -9999;
    for (const p of validPoints) {
      if (p.raw_weight_kg != null) {
        min = Math.min(min, p.raw_weight_kg);
        max = Math.max(max, p.raw_weight_kg);
      }
      if (p.trend_weight_kg != null) {
        min = Math.min(min, p.trend_weight_kg);
        max = Math.max(max, p.trend_weight_kg);
      }
    }
    if (data?.target_weight_kg != null) {
      min = Math.min(min, data.target_weight_kg);
      max = Math.max(max, data.target_weight_kg);
    }

    if (min === 9999 || max === -9999) {
      min = 60;
      max = 80;
    } else {
      // Add padding
      const span = Math.max(max - min, 2);
      min = Math.floor(min - span * 0.1);
      max = Math.ceil(max + span * 0.1);
    }

    return { minY: min, maxY: max, pointsCount: Math.max(validPoints.length, 1) };
  }, [validPoints, data?.target_weight_kg]);

  const getY = useCallback(
    (val: number) => {
      const ratio = (val - minY) / (maxY - minY || 1);
      return padTop + chartH - ratio * chartH;
    },
    [minY, maxY, chartH],
  );

  const getX = useCallback(
    (index: number) => {
      if (pointsCount <= 1) return padLeft + chartW / 2;
      return padLeft + (index / (pointsCount - 1)) * chartW;
    },
    [pointsCount, chartW],
  );

  // Target line Y
  const targetY = data?.target_weight_kg != null ? getY(data.target_weight_kg) : null;

  // Trend line SVG path
  const trendPath = useMemo(() => {
    let path = '';
    validPoints.forEach((p, i) => {
      if (p.trend_weight_kg != null) {
        const x = getX(i);
        const y = getY(p.trend_weight_kg);
        if (!path) {
          path = `M ${x} ${y}`;
        } else {
          path += ` L ${x} ${y}`;
        }
      }
    });
    return path;
  }, [validPoints, getX, getY]);

  return (
    <ChartContainer
      title={t('progress.weight.title')}
      subtitle={
        data?.current_weight_kg != null ? `${data.current_weight_kg.toFixed(1)} kg` : undefined
      }
      accessibilitySummary={accessibilitySummary}
      loading={loading}
      empty={isEmpty}
      emptyMessage={t('progress.weight.empty')}
      emptyIcon="speedometer-outline"
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

          {/* Target Weight Dashed Goal Line */}
          {targetY != null && (
            <>
              <Line
                x1={padLeft}
                y1={targetY}
                x2={containerWidth - padRight}
                y2={targetY}
                stroke={colors.accent}
                strokeWidth={1.5}
                strokeDasharray="4 4"
              />
              <SvgText
                x={containerWidth - padRight - 2}
                y={targetY - 4}
                fill={colors.accent}
                fontSize="9"
                textAnchor="end"
              >
                {t('progress.weight.goal')} {data?.target_weight_kg?.toFixed(1)}kg
              </SvgText>
            </>
          )}

          {/* 7-day Trend Line */}
          {trendPath ? (
            <Path
              d={trendPath}
              stroke={colors.accent}
              strokeWidth={2.5}
              fill="none"
              strokeLinecap="round"
            />
          ) : null}

          {/* Raw Points */}
          {validPoints.map((point, index) => {
            if (point.raw_weight_kg == null) return null;
            const cx = getX(index);
            const cy = getY(point.raw_weight_kg);

            return (
              <React.Fragment key={point.date}>
                <Circle
                  cx={cx}
                  cy={cy}
                  r={3.5}
                  fill={colors.surface}
                  stroke={colors.accent}
                  strokeWidth={2}
                />
                {/* Touch Area */}
                <Circle
                  cx={cx}
                  cy={cy}
                  r={16}
                  fill="transparent"
                  onPress={() => {
                    onSelectDay?.({
                      date: point.date,
                      weightKg: point.raw_weight_kg,
                      metricLabel: t('progress.weight.title'),
                      metricValue: `${point.raw_weight_kg?.toFixed(1)} kg`,
                    });
                  }}
                  accessibilityLabel={`Weight on ${point.date}: ${point.raw_weight_kg?.toFixed(1)} kg`}
                />
              </React.Fragment>
            );
          })}
        </Svg>
      </View>

      {/* Summary Numbers Section */}
      <View style={styles.statsGrid}>
        {data?.start_weight_kg != null && (
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('progress.weight.start')}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data.start_weight_kg.toFixed(1)} kg
            </Text>
          </View>
        )}

        {data?.current_trend_kg != null && (
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('progress.weight.trend')}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data.current_trend_kg.toFixed(1)} kg
            </Text>
          </View>
        )}

        {data?.total_change_kg != null && (
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('progress.weight.totalChange')}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data.total_change_kg > 0
                ? `+${data.total_change_kg.toFixed(1)}`
                : data.total_change_kg.toFixed(1)}{' '}
              kg
              {data.total_change_pct != null ? ` (${data.total_change_pct.toFixed(1)}%)` : ''}
            </Text>
          </View>
        )}

        {data?.weekly_pace_kg != null && (
          <View style={styles.statBox}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('progress.weight.weeklyPace')}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>
              {data.weekly_pace_kg.toFixed(2)} kg/wk
            </Text>
          </View>
        )}

        {data?.projected_date != null && (
          <View style={[styles.statBox, styles.statBoxWide]}>
            <Text style={[styles.statLabel, { color: colors.textMuted }]}>
              {t('progress.weight.projectedDate')}
            </Text>
            <Text style={[styles.statValue, { color: colors.text }]}>{data.projected_date}</Text>
          </View>
        )}
      </View>
    </ChartContainer>
  );
}

const styles = StyleSheet.create({
  chartWrapper: {
    alignItems: 'center',
    marginVertical: spacing.xs,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(150, 150, 150, 0.2)',
  },
  statBox: {
    flex: 1,
    minWidth: '45%',
  },
  statBoxWide: {
    minWidth: '100%',
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
