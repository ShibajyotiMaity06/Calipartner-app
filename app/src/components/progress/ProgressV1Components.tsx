import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect } from 'react-native-svg';
import {
  getPreviousDateString,
  isCalorieDayWithinPercent,
  kgToLb,
  summarizeHabitsProgress,
  summarizeProgress,
  weightMilestone,
  type IndividualProgressData,
  type WeightLog,
  type WorkoutWithDetails,
} from '@calipartner/core';
import {
  Badge,
  Card,
  DumbbellIcon,
  ProgressBar,
  Ring,
  Text,
  borders,
  colors,
  fonts,
  macroColors,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { useCurrentLocalDate } from '@/hooks/useCurrentLocalDate';
import { useTargets } from '@/hooks/useTargets';
import { useTrackingPreferences } from '@/hooks/useTrackingPreferences';
import { getLocale, t } from '@/i18n';
import { loadAccountTable } from '@/services/accountDataService';
import { getFastingHistory } from '@/services/fastingService';
import {
  getWorkoutById,
  getWorkoutsCalendarData,
  getWorkoutsHistory,
} from '@/services/workoutService';
import { workoutEvents } from '@/services/workoutEvents';
import type { DayDetailData } from './DayDetailModal';

function formatShortMonthDay(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(parsed);
}

function formatSessionDateLabel(isoDate: string, todayDate: string): string {
  if (isoDate === todayDate) return t('homeV1.todayLabel');
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  const weekday = new Intl.DateTimeFormat('en-US', { weekday: 'short' }).format(parsed);
  const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(parsed);
  const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(parsed);
  return `${weekday} ${day} ${month}`;
}

function formatWeekdayLetter(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return '';
  const idx = parsed.getDay();
  return ['S', 'M', 'T', 'W', 'T', 'F', 'S'][idx] ?? '';
}

function addDaysIso(isoDate: string, offset: number): string {
  const base = new Date(`${isoDate}T12:00:00Z`);
  base.setUTCDate(base.getUTCDate() + offset);
  return base.toISOString().slice(0, 10);
}

function formatWeightVal(kg: number, useLb: boolean): string {
  const v = useLb ? kgToLb(kg) : kg;
  return v.toFixed(1);
}

function formatSignedDelta(kg: number, useLb: boolean, unitLabel: string): string {
  const val = useLb ? kgToLb(kg) : kg;
  const sign = val > 0.05 ? '+' : val < -0.05 ? '-' : '';
  return `${sign}${Math.abs(val).toFixed(1)} ${unitLabel}`;
}

export interface ProgressWeightTabV1Props {
  data: IndividualProgressData;
  weight: {
    logs: WeightLog[];
    startingWeightKg: number | null;
    latestLog: WeightLog | null;
    latestTrendKg: number | null;
    weeklyPaceKg: number | null;
    projectedDate: string | null;
  };
  targetWeightKg: number | null;
  useLb: boolean;
  onLogWeight: () => void;
  onOpenHistory: () => void;
}

export function ProgressWeightTabV1({
  data,
  weight,
  targetWeightKg,
  useLb,
  onLogWeight,
  onOpenHistory,
}: ProgressWeightTabV1Props): React.JSX.Element {
  const [chartWidth, setChartWidth] = useState(300);
  const unitLabel = useLb ? 'lb' : 'kg';

  const currentKg = weight.latestLog?.weight_kg ?? data.weight.current_weight_kg;
  const startKg = data.weight.start_weight_kg ?? weight.startingWeightKg;
  const effectiveTargetKg = targetWeightKg ?? data.weight.target_weight_kg;
  const summary = useMemo(() => summarizeProgress(data), [data]);
  const milestone = useMemo(
    () => weightMilestone(startKg, currentKg, effectiveTargetKg),
    [startKg, currentKg, effectiveTargetKg],
  );

  const periodCheckIns = useMemo(() => {
    const inRange = weight.logs.filter(
      (item) => item.local_date >= data.start_date && item.local_date <= data.end_date,
    );
    if (inRange.length > 0) return inRange.length;
    return data.weight.history.filter((p) => p.raw_weight_kg != null).length;
  }, [weight.logs, data.weight.history, data.start_date, data.end_date]);

  const points = useMemo(() => {
    const map = new Map<string, number>();
    for (const p of data.weight.history) {
      const val = p.raw_weight_kg ?? p.trend_weight_kg;
      if (
        val != null &&
        Number.isFinite(val) &&
        p.date >= data.start_date &&
        p.date <= data.end_date
      ) {
        map.set(p.date, val);
      }
    }
    for (const log of weight.logs) {
      if (
        Number.isFinite(log.weight_kg) &&
        log.local_date >= data.start_date &&
        log.local_date <= data.end_date &&
        !map.has(log.local_date)
      ) {
        map.set(log.local_date, log.weight_kg);
      }
    }
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, kg]) => ({ date, value: useLb ? kgToLb(kg) : kg }));
  }, [data.weight.history, data.start_date, data.end_date, weight.logs, useLb]);

  const paceKg = summary.pace ?? weight.weeklyPaceKg ?? data.weight.weekly_pace_kg;
  const periodChangeKg = summary.periodChange ?? milestone.change ?? data.weight.total_change_kg;
  const projectedDate = weight.projectedDate ?? data.weight.projected_date;

  const trendRightLabel = useMemo(() => {
    const parts: string[] = [];
    if (paceKg != null && Number.isFinite(paceKg)) {
      parts.push(t('progressV1.paceRate', { pace: formatSignedDelta(paceKg, useLb, unitLabel) }));
    }
    if (projectedDate) {
      parts.push(t('progressV1.goalByDate', { date: formatShortMonthDay(projectedDate) }));
    }
    return parts.join(' · ');
  }, [paceKg, useLb, unitLabel, projectedDate]);

  const chartH = 148;
  const padL = 8;
  const padR = 12;
  const padT = 14;
  const padB = 14;
  const innerW = Math.max(80, chartWidth - padL - padR);
  const innerH = chartH - padT - padB;

  const { minY, maxY, ticksY } = useMemo(() => {
    if (!points.length) return { minY: 60, maxY: 80, ticksY: [80, 70, 60] };
    let lo = Math.min(...points.map((p) => p.value));
    let hi = Math.max(...points.map((p) => p.value));
    const span = Math.max(1, hi - lo);
    lo = Math.floor((lo - span * 0.2) * 2) / 2;
    hi = Math.ceil((hi + span * 0.2) * 2) / 2;
    if (hi - lo < 1) hi = lo + 1;
    const mid = Math.round(((lo + hi) / 2) * 2) / 2;
    return { minY: lo, maxY: hi, ticksY: [hi, mid, lo] };
  }, [points]);

  const coords = useMemo(() => {
    if (!points.length) return [];
    return points.map((p, idx) => {
      const x =
        points.length === 1 ? padL + innerW / 2 : padL + (idx / (points.length - 1)) * innerW;
      const y = padT + innerH - ((p.value - minY) / (maxY - minY || 1)) * innerH;
      return { ...p, x, y };
    });
  }, [points, innerW, innerH, minY, maxY]);

  const linePath = useMemo(() => {
    if (!coords.length) return '';
    return coords
      .map((c, idx) => `${idx === 0 ? 'M' : 'L'} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
      .join(' ');
  }, [coords]);

  const xTicks = useMemo(() => {
    if (coords.length <= 1) return coords;
    const maxLabels = 4;
    if (coords.length <= maxLabels) return coords;
    return Array.from({ length: maxLabels }, (_, idx) => {
      const pick = Math.round((idx / (maxLabels - 1)) * (coords.length - 1));
      return coords[pick]!;
    });
  }, [coords]);

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 40 && Math.abs(w - chartWidth) > 4) setChartWidth(w);
  };

  const progressRatio = milestone.percent != null ? milestone.percent / 100 : 0;

  return (
    <View style={styles.sectionStack} testID="progress-tab-weight">
      {/* Current weight hero card */}
      <Card style={styles.cardPad} testID="weight-goal-hero">
        <View style={styles.rowBetween}>
          <Text variant="meta" color="textLo">
            {t('progressV1.currentWeight')}
          </Text>
          <Pressable
            onPress={onLogWeight}
            accessibilityRole="button"
            accessibilityLabel={t('progressV1.logWeight')}
            style={({ pressed }) => [styles.outlinePillBtn, pressed ? styles.pressedBg : null]}
            testID="btn-progress-log-weight"
          >
            <Text variant="buttonS" color="textHi">
              {t('progressV1.logWeight')}
            </Text>
          </Pressable>
        </View>

        <View style={styles.weightNumbersRow}>
          <Pressable
            onPress={onOpenHistory}
            accessibilityRole="button"
            accessibilityLabel={t('progressV1.currentWeight')}
            style={styles.baselineRow}
          >
            <Text style={styles.numLText} tabular testID="progress-current-weight">
              {currentKg != null ? formatWeightVal(currentKg, useLb) : '—'}
            </Text>
            <Text variant="label" color="textLo" style={styles.unitPad}>
              {` ${unitLabel}`}
            </Text>
          </Pressable>

          <View style={styles.goalRightCol}>
            <Text variant="meta" color="textLo">
              {t('progressV1.goalLabel')}
            </Text>
            <Text variant="rowTitle" color="textHi" tabular testID="progress-goal-weight">
              {effectiveTargetKg != null
                ? `${formatWeightVal(effectiveTargetKg, useLb)} ${unitLabel}`
                : '—'}
            </Text>
          </View>
        </View>

        <ProgressBar
          progress={progressRatio}
          height={5}
          trackColor={colors.s3}
          fillColor={colors.apricot}
          accessibilityLabel={t('progressV1.goalLabel')}
        />

        <View style={styles.rowBetween}>
          <Text variant="meta" color="textLo" tabular>
            {milestone.change != null
              ? t('progressV1.soFar', {
                  delta: formatSignedDelta(milestone.change, useLb, unitLabel),
                })
              : t('progress.weight.empty')}
          </Text>
          {milestone.remaining != null && !milestone.maintaining ? (
            <Text variant="meta" color="textLo" tabular>
              {t('progressV1.toGo', {
                amount: `${formatWeightVal(milestone.remaining, useLb)} ${unitLabel}`,
              })}
            </Text>
          ) : null}
        </View>
      </Card>

      {/* Trend line chart card */}
      <Card style={styles.cardPad} testID="weight-chart">
        <View style={styles.rowBetween}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.trendTitle')}
          </Text>
          {trendRightLabel ? (
            <Text
              variant="meta"
              color="textLo"
              numberOfLines={1}
              tabular
              style={styles.flexShrinkOne}
            >
              {trendRightLabel}
            </Text>
          ) : null}
        </View>

        {points.length === 0 ? (
          <View style={styles.emptyChartBox}>
            <Text variant="body" color="textLo" style={styles.emptyCenter}>
              {t('progress.weight.empty')}
            </Text>
          </View>
        ) : (
          <View style={styles.trendPlotRow}>
            <View style={styles.yAxisCol}>
              {ticksY.map((val, idx) => (
                <Text key={idx} variant="micro" color="textLo" tabular>
                  {val.toFixed(1)}
                </Text>
              ))}
            </View>
            <View style={styles.flexOne} onLayout={handleLayout}>
              <Svg width={chartWidth} height={chartH}>
                {[0, 0.5, 1].map((frac, idx) => (
                  <Line
                    key={idx}
                    x1={padL}
                    y1={padT + innerH * frac}
                    x2={chartWidth - padR}
                    y2={padT + innerH * frac}
                    stroke={colors.hairline}
                    strokeWidth={0.8}
                    strokeDasharray="2 3"
                  />
                ))}
                {coords.length > 1 ? (
                  <Path
                    d={linePath}
                    fill="none"
                    stroke={colors.apricot}
                    strokeWidth={2.4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ) : null}
                {coords.map((pt, idx) => {
                  const isLast = idx === coords.length - 1;
                  return isLast ? (
                    <React.Fragment key={pt.date}>
                      <Circle cx={pt.x} cy={pt.y} r={8} fill={colors.apricotHalo} />
                      <Circle cx={pt.x} cy={pt.y} r={4} fill={colors.apricot} />
                    </React.Fragment>
                  ) : (
                    <Circle key={pt.date} cx={pt.x} cy={pt.y} r={2.8} fill={colors.apricot} />
                  );
                })}
              </Svg>
              <View style={styles.xTicksRow}>
                {xTicks.map((pt) => (
                  <Text key={pt.date} variant="micro" color="textLo" tabular>
                    {formatShortMonthDay(pt.date)}
                  </Text>
                ))}
              </View>
            </View>
          </View>
        )}
      </Card>

      {/* Bottom 3 stats */}
      <View style={styles.statsThreeRow}>
        <Pressable onPress={onOpenHistory} style={styles.statTile}>
          <Text style={styles.statValText} tabular numberOfLines={1}>
            {periodChangeKg != null ? formatSignedDelta(periodChangeKg, useLb, unitLabel) : '—'}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.totalChange')}
          </Text>
        </Pressable>

        <Pressable onPress={onOpenHistory} style={styles.statTile}>
          <Text style={styles.statValText} tabular numberOfLines={1}>
            {paceKg != null ? formatSignedDelta(paceKg, useLb, unitLabel) : '—'}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.perWeek')}
          </Text>
        </Pressable>

        <Pressable onPress={onOpenHistory} style={styles.statTile} testID="weight-checkins-tile">
          <Text style={styles.statValText} tabular numberOfLines={1}>
            {String(periodCheckIns)}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.checkIns')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

export interface ProgressNutritionTabV1Props {
  data: IndividualProgressData;
  onSelectDay: (day: DayDetailData) => void;
}

export function ProgressNutritionTabV1({
  data,
  onSelectDay,
}: ProgressNutritionTabV1Props): React.JSX.Element {
  const [chartWidth, setChartWidth] = useState(300);
  const summary = useMemo(() => summarizeProgress(data), [data]);

  const daily = data.calories.daily;
  const avgCalories = Math.round(summary.calories ?? data.calories.average_calories ?? 0);
  const avgTarget = Math.round(summary.calorieTarget ?? data.calories.average_target ?? 0);
  const pctDiff =
    avgTarget > 0 && avgCalories > 0
      ? Math.round(((avgCalories - avgTarget) / avgTarget) * 100)
      : null;

  const loggedDays = useMemo(() => daily.filter((d) => d.calories > 0), [daily]);
  const onTargetDaysCount = useMemo(
    () =>
      loggedDays.filter((d) =>
        isCalorieDayWithinPercent(d.calories, d.target_calories || avgTarget, 0.1),
      ).length,
    [loggedDays, avgTarget],
  );

  const chartDays = useMemo(() => {
    if (data.range === '7d') {
      const map = new Map(daily.map((d) => [d.date, d]));
      return Array.from({ length: 7 }, (_, i) => {
        const date = getPreviousDateString(data.end_date, 6 - i);
        return (
          map.get(date) ?? {
            date,
            calories: 0,
            target_calories: avgTarget,
            is_logged_day: false,
            is_goal_day: false,
          }
        );
      });
    }
    return daily;
  }, [data.range, data.end_date, daily, avgTarget]);

  const maxY = useMemo(() => {
    const vals = chartDays.map((d) => d.calories);
    return Math.max(2500, avgTarget * 1.15, ...vals.map((v) => v * 1.15));
  }, [chartDays, avgTarget]);

  const chartH = 144;
  const barSlotW = chartDays.length > 0 ? chartWidth / chartDays.length : chartWidth;
  const barW = Math.max(4, Math.min(26, barSlotW * 0.68));
  const targetLineY =
    avgTarget > 0 ? chartH - Math.min(1, avgTarget / (maxY || 1)) * (chartH - 12) : null;

  const macros = [
    {
      key: 'protein',
      label: t('homeV1.protein'),
      avg: Math.round(data.macros.protein_avg_g),
      target: Math.round(data.macros.protein_target_g),
      color: macroColors.protein,
    },
    {
      key: 'carbs',
      label: t('homeV1.carbs'),
      avg: Math.round(data.macros.carbs_avg_g),
      target: Math.round(data.macros.carbs_target_g),
      color: macroColors.carbs,
    },
    {
      key: 'fat',
      label: t('homeV1.fat'),
      avg: Math.round(data.macros.fat_avg_g),
      target: Math.round(data.macros.fat_target_g),
      color: macroColors.fat,
    },
  ];

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 40 && Math.abs(w - chartWidth) > 4) setChartWidth(w);
  };

  return (
    <View style={styles.sectionStack} testID="progress-tab-nutrition">
      {/* Daily average + On target summary */}
      <Card style={styles.cardPad}>
        <View style={styles.nutritionSummaryRow}>
          <View style={styles.flexOne}>
            <Text variant="meta" color="textLo">
              {t('progressV1.dailyAverage')}
            </Text>
            <View style={styles.baselineRow}>
              <Text style={styles.numLText} tabular testID="nutrition-avg-kcal">
                {avgCalories.toLocaleString(getLocale())}
              </Text>
              <Text variant="label" color="textLo">
                {` ${t('homeV1.kcalUnit')}`}
              </Text>
            </View>
            {avgTarget > 0 ? (
              <Text variant="meta" color="textLo" tabular>
                {`${t('progressV1.targetLine', { target: avgTarget.toLocaleString(getLocale()) })}${
                  pctDiff != null && avgCalories > 0
                    ? ` · ${pctDiff > 0 ? `+${pctDiff}` : pctDiff}%`
                    : ''
                }`}
              </Text>
            ) : null}
          </View>

          <View style={styles.nutritionRightCol}>
            <Text variant="meta" color="textLo">
              {t('progressV1.onTarget')}
            </Text>
            <Text style={styles.numMText} tabular testID="nutrition-on-target-ratio">
              {t('progressV1.ofCount', { count: onTargetDaysCount, total: loggedDays.length })}
            </Text>
            <Text variant="meta" color="textLo">
              {t('progressV1.daysWithinPct')}
            </Text>
          </View>
        </View>
      </Card>

      {/* Calories by day bar chart */}
      <Card style={styles.cardPad} testID="calories-chart">
        <Text variant="rowTitle" color="textHi">
          {t('progressV1.caloriesByDay')}
        </Text>

        {loggedDays.length === 0 ? (
          <View style={styles.emptyChartBox}>
            <Text variant="body" color="textLo" style={styles.emptyCenter}>
              {t('progress.calories.empty')}
            </Text>
          </View>
        ) : (
          <View onLayout={handleLayout} style={styles.barsContainer}>
            {targetLineY != null && avgTarget > 0 ? (
              <View style={[styles.targetCaptionWrap, { top: Math.max(0, targetLineY - 14) }]}>
                <Text variant="micro" color="textLo" tabular>
                  {t('progressV1.targetLine', { target: avgTarget.toLocaleString(getLocale()) })}
                </Text>
              </View>
            ) : null}

            <Svg width={chartWidth} height={chartH}>
              {targetLineY != null ? (
                <Line
                  x1={0}
                  y1={targetLineY}
                  x2={chartWidth}
                  y2={targetLineY}
                  stroke={colors.hairlineLit}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}

              {chartDays.map((day, idx) => {
                const effTarget = day.target_calories || avgTarget;
                const onTarget = isCalorieDayWithinPercent(day.calories, effTarget, 0.1);
                const h =
                  day.calories > 0 ? Math.max(6, (day.calories / (maxY || 1)) * (chartH - 12)) : 4;
                const x = idx * barSlotW + (barSlotW - barW) / 2;
                const y = chartH - h;
                const barFill =
                  day.calories === 0 ? colors.s3 : onTarget ? colors.apricot : colors.hairlineLit;
                return (
                  <Rect
                    key={day.date}
                    x={x}
                    y={y}
                    width={barW}
                    height={h}
                    rx={Math.min(6, barW / 2)}
                    fill={barFill}
                    onPress={() =>
                      onSelectDay({
                        date: day.date,
                        calories: day.calories,
                        targetCalories: day.target_calories,
                        isLoggedDay: day.is_logged_day,
                        isGoalDay: day.is_goal_day,
                      })
                    }
                  />
                );
              })}
            </Svg>

            <View style={styles.barLabelsRow}>
              {chartDays.length <= 10
                ? chartDays.map((day) => (
                    <Text
                      key={day.date}
                      variant="micro"
                      color="textLo"
                      style={styles.barLabelCenter}
                    >
                      {formatWeekdayLetter(day.date)}
                    </Text>
                  ))
                : [chartDays[0], chartDays[Math.floor(chartDays.length / 2)], chartDays.at(-1)]
                    .filter(Boolean)
                    .map((day) => (
                      <Text key={day!.date} variant="micro" color="textLo" tabular>
                        {formatShortMonthDay(day!.date)}
                      </Text>
                    ))}
            </View>
          </View>
        )}
      </Card>

      {/* Macros daily average */}
      <Card style={styles.cardPad} testID="macros-chart">
        <Text variant="rowTitle" color="textHi">
          {t('progressV1.macrosDailyAverage')}
        </Text>

        <View style={styles.macrosStack}>
          {macros.map((macro) => {
            const pct =
              macro.target > 0 ? Math.round(((macro.avg - macro.target) / macro.target) * 100) : 0;
            const ratio = macro.target > 0 ? Math.min(1, macro.avg / macro.target) : 0;
            return (
              <View key={macro.key} style={styles.macroRow}>
                <View style={styles.rowBetween}>
                  <Text variant="label" color="textHi">
                    {macro.label}
                  </Text>
                  <Text variant="meta" color="textLo" tabular>
                    {pct > 0
                      ? t('progressV1.overMacroGrams', {
                          avg: macro.avg,
                          target: macro.target,
                          pct,
                        })
                      : t('progressV1.ofMacroGrams', { avg: macro.avg, target: macro.target })}
                  </Text>
                </View>
                <ProgressBar
                  progress={ratio}
                  height={6}
                  trackColor={colors.s3}
                  fillColor={macro.color}
                />
              </View>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

interface RecentSessionSummary {
  id: string;
  name: string;
  localDate: string;
  durationMinutes: number;
  exerciseCount: number;
  hasPR: boolean;
}

export interface ProgressWorkoutsTabV1Props {
  data: IndividualProgressData;
  onOpenCalendar: () => void;
}

export function ProgressWorkoutsTabV1({
  data,
  onOpenCalendar,
}: ProgressWorkoutsTabV1Props): React.JSX.Element {
  const { user } = useAuth();
  const { localDate: today } = useCurrentLocalDate();
  const ownerId = user?.id ?? 'guest-user';

  const [heatmapCounts, setHeatmapCounts] = useState<Record<string, number>>({});
  const [recentSessions, setRecentSessions] = useState<RecentSessionSummary[]>([]);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    return workoutEvents.subscribe(() => setRevision((v) => v + 1));
  }, []);

  const gridEnd = useMemo(() => {
    const d = new Date(`${today}T12:00:00Z`);
    const day = d.getUTCDay(); // 0=Sun..6=Sat
    const daysUntilSun = day === 0 ? 0 : 7 - day;
    return addDaysIso(today, daysUntilSun);
  }, [today]);

  const gridDates = useMemo(
    () => Array.from({ length: 35 }, (_, idx) => addDaysIso(gridEnd, idx - 34)),
    [gridEnd],
  );

  const gridStart = gridDates[0] ?? today;

  useEffect(() => {
    let active = true;
    async function loadWorkoutExtras() {
      try {
        const db = await getDb();
        if (user?.id) {
          await loadAccountTable(db, 'workouts', user.id);
          await loadAccountTable(db, 'workout_exercises', user.id);
          await loadAccountTable(db, 'workout_sets', user.id);
        }
        const [cal, history] = await Promise.all([
          getWorkoutsCalendarData(db, ownerId, gridStart, gridEnd),
          getWorkoutsHistory(db, ownerId, 25, 0),
        ]);
        if (!active) return;

        const mergedCounts: Record<string, number> = { ...cal };
        for (const item of data.workouts.daily_sessions ?? []) {
          if (item.sessions > 0) {
            mergedCounts[item.date] = Math.max(mergedCounts[item.date] ?? 0, item.sessions);
          }
        }
        setHeatmapCounts(mergedCounts);

        const bestByExercise = new Map<string, number>();
        for (const ex of data.workouts.exercise_progression ?? []) {
          const maxWt = Math.max(0, ...ex.data.map((d) => d.heaviest_weight_kg ?? 0));
          if (maxWt > 0) bestByExercise.set(ex.exercise_name, maxWt);
        }

        const inRange = history
          .filter((w) => w.local_date >= data.start_date && w.local_date <= data.end_date)
          .slice(0, 5);
        const detailed: WorkoutWithDetails[] = [];
        for (const w of inRange) {
          const full = await getWorkoutById(db, w.id);
          if (full) detailed.push(full);
        }
        if (!active) return;

        setRecentSessions(
          detailed.map((w) => {
            const hasPR = w.exercises.some((ex) => {
              const best = bestByExercise.get(ex.exercise_name) ?? 0;
              return (
                best > 0 &&
                (ex.sets ?? []).some(
                  (s) => s.completed && !s.is_warmup && (s.weight_kg ?? 0) >= best,
                )
              );
            });
            return {
              id: w.id,
              name: w.name?.trim() || t('homeV1.trackWorkout'),
              localDate: w.local_date,
              durationMinutes: Math.max(0, Math.round(w.duration_minutes ?? 0)),
              exerciseCount: w.exercises.length,
              hasPR,
            };
          }),
        );
      } catch {
        // Fallback to RPC counts if SQLite unavailable in tests
        if (!active) return;
        const rpcCounts: Record<string, number> = {};
        for (const item of data.workouts.daily_sessions ?? []) {
          if (item.sessions > 0) rpcCounts[item.date] = item.sessions;
        }
        setHeatmapCounts(rpcCounts);
        setRecentSessions([]);
      }
    }

    void loadWorkoutExtras();
    return () => {
      active = false;
    };
  }, [
    ownerId,
    user?.id,
    gridStart,
    gridEnd,
    data.start_date,
    data.end_date,
    data.workouts.daily_sessions,
    data.workouts.exercise_progression,
    revision,
  ]);

  const totalWorkoutsIn5Weeks = useMemo(
    () => gridDates.reduce((sum, date) => sum + (heatmapCounts[date] ?? 0), 0),
    [gridDates, heatmapCounts],
  );

  const trainedLabel = useMemo(() => {
    const mins = Math.round(data.workouts.total_duration_minutes ?? 0);
    if (mins >= 60) {
      const hrs = Math.round((mins / 60) * 10) / 10;
      return t('progressV1.hoursShort', { hours: hrs % 1 === 0 ? hrs.toFixed(0) : hrs.toFixed(1) });
    }
    return t('progressV1.minsShort', { mins });
  }, [data.workouts.total_duration_minutes]);

  const weekRows = useMemo(
    () => Array.from({ length: 5 }, (_, rowIdx) => gridDates.slice(rowIdx * 7, rowIdx * 7 + 7)),
    [gridDates],
  );

  return (
    <View style={styles.sectionStack} testID="progress-tab-workouts">
      {/* Top 3 stats */}
      <View style={styles.statsThreeRow}>
        <View style={styles.statTile}>
          <Text style={styles.statValLarge} tabular numberOfLines={1}>
            {String(data.workouts.total_workouts)}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.workoutsCountLabel')}
          </Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValLarge} tabular numberOfLines={1}>
            {trainedLabel}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.trainedLabel')}
          </Text>
        </View>
        <View style={styles.statTile}>
          <Text style={styles.statValLarge} tabular numberOfLines={1}>
            {data.workouts.sessions_per_week.toFixed(1)}
          </Text>
          <Text variant="meta" color="textLo" numberOfLines={1}>
            {t('progressV1.perWeek')}
          </Text>
        </View>
      </View>

      {/* Last 5 weeks heatmap */}
      <Card onPress={onOpenCalendar} style={styles.cardPad} testID="workouts-heatmap-card">
        <View style={styles.rowBetween}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.last5Weeks')}
          </Text>
          <Text variant="meta" color="textLo" tabular>
            {t('progressV1.workoutsBadgeCount', { count: totalWorkoutsIn5Weeks })}
          </Text>
        </View>

        <View style={styles.calHeaderRow}>
          {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dayLetter, idx) => (
            <Text key={idx} variant="micro" color="textLo" style={styles.calCellText}>
              {dayLetter}
            </Text>
          ))}
        </View>

        <View style={styles.calGrid}>
          {weekRows.map((row, rIdx) => (
            <View key={rIdx} style={styles.calRow}>
              {row.map((dateStr) => {
                const count = heatmapCounts[dateStr] ?? 0;
                const isToday = dateStr === today;
                const isFuture = dateStr > today;
                const dayNum = Number(dateStr.slice(8, 10));
                return (
                  <View
                    key={dateStr}
                    style={[
                      styles.calCell,
                      count > 0 ? styles.calCellFilled : styles.calCellEmpty,
                      isToday ? styles.calCellToday : null,
                    ]}
                    testID={isToday ? 'workouts-heatmap-today' : undefined}
                  >
                    <Text
                      tabular
                      style={[
                        styles.calDayNum,
                        {
                          color:
                            count > 0 ? colors.onBrand : isFuture ? colors.textOff : colors.textLo,
                          fontFamily: count > 0 || isToday ? fonts.bold : fonts.regular,
                        },
                      ]}
                    >
                      {String(dayNum)}
                    </Text>
                  </View>
                );
              })}
            </View>
          ))}
        </View>
      </Card>

      {/* Recent sessions */}
      <View style={styles.recentHeaderWrap}>
        <Text variant="eyebrow" color="textLo">
          {t('progressV1.recentSessionsEyebrow')}
        </Text>

        {recentSessions.length === 0 ? (
          <Card style={styles.cardPad}>
            <Text variant="meta" color="textLo">
              {t('progressV1.noRecentWorkouts')}
            </Text>
          </Card>
        ) : (
          <View style={styles.recentList}>
            {recentSessions.map((session) => (
              <Card
                key={session.id}
                style={styles.sessionRowCard}
                testID={`recent-session-${session.id}`}
              >
                <View style={styles.sessionIconTile}>
                  <DumbbellIcon size={18} color={colors.textMid} />
                </View>
                <View style={styles.flexOne}>
                  <Text variant="rowTitle" color="textHi" numberOfLines={1}>
                    {session.name}
                  </Text>
                  <Text variant="meta" color="textLo" numberOfLines={1} tabular>
                    {t('progressV1.sessionMeta', {
                      day: formatSessionDateLabel(session.localDate, today),
                      minutes: session.durationMinutes,
                      exercises: session.exerciseCount,
                    })}
                  </Text>
                </View>
                {session.hasPR ? (
                  <Badge variant="outlinePro" mini label={t('progressV1.prBadge')} />
                ) : null}
              </Card>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

export interface ProgressHabitsTabV1Props {
  data: IndividualProgressData;
  onSelectDay: (day: DayDetailData) => void;
}

export function ProgressHabitsTabV1({
  data,
  onSelectDay,
}: ProgressHabitsTabV1Props): React.JSX.Element {
  const { user } = useAuth();
  const tracking = useTrackingPreferences();
  const { currentGoalProfile } = useTargets();
  const [chartWidth, setChartWidth] = useState(300);
  const [fastingDates, setFastingDates] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function loadFasts() {
      if (!user?.id) return;
      try {
        const db = await getDb();
        await loadAccountTable(db, 'fasting_sessions', user.id);
        const sessions = await getFastingHistory(db, user.id, 120);
        if (!active) return;
        setFastingDates(sessions.filter((s) => s.status === 'completed').map((s) => s.local_date));
      } catch {
        // Optional SQLite enrichment; RPC data.fasting stays active
      }
    }
    void loadFasts();
    return () => {
      active = false;
    };
  }, [user?.id]);

  const goalSteps = currentGoalProfile?.step_goal ?? data.steps.goal_steps ?? 10000;
  const goalWaterMl = currentGoalProfile?.water_ml_goal ?? data.water.goal_water_ml ?? 2500;
  const targetCalories =
    currentGoalProfile?.daily_calorie_target ?? data.calories.average_target ?? 0;

  const habits = useMemo(
    () =>
      summarizeHabitsProgress(data, tracking.enabled, {
        targetCalories,
        goalSteps,
        goalWaterMl,
        fastingCompletedDates: fastingDates,
      }),
    [data, tracking.enabled, targetCalories, goalSteps, goalWaterMl, fastingDates],
  );

  const stepsDays = useMemo(() => {
    const map = new Map(data.steps.daily.map((d) => [d.date, d]));
    if (data.range === '7d') {
      return habits.last7Days.map(
        (d) => map.get(d.date) ?? { date: d.date, steps: 0, distance_km: 0 },
      );
    }
    return data.steps.daily;
  }, [data.range, data.steps.daily, habits.last7Days]);

  const maxStep = useMemo(
    () => Math.max(goalSteps * 1.15, ...stepsDays.map((d) => d.steps * 1.15), 2000),
    [stepsDays, goalSteps],
  );
  const stepChartH = 128;
  const stepSlotW = stepsDays.length > 0 ? chartWidth / stepsDays.length : chartWidth;
  const stepBarW = Math.max(4, Math.min(26, stepSlotW * 0.68));
  const stepGoalY =
    goalSteps > 0 ? stepChartH - Math.min(1, goalSteps / (maxStep || 1)) * (stepChartH - 10) : null;

  const avgSteps = Math.round(data.steps.average_steps ?? 0);
  const totalFasts =
    (data.fasting?.total_fasts ?? 0) > 0 ? data.fasting!.total_fasts : habits.last7Days.length;
  const completedFasts =
    (data.fasting?.total_fasts ?? 0) > 0
      ? data.fasting!.completed_fasts
      : habits.fastingCompletedDays;

  const handleLayout = (e: LayoutChangeEvent) => {
    const w = e.nativeEvent.layout.width;
    if (w > 40 && Math.abs(w - chartWidth) > 4) setChartWidth(w);
  };

  return (
    <View style={styles.sectionStack} testID="progress-tab-habits">
      {/* Perfect days ring card */}
      <Card style={styles.perfectDaysCard} testID="habits-perfect-days">
        <Ring
          progress={habits.totalDays > 0 ? habits.perfectDays / habits.totalDays : 0}
          size={72}
          strokeWidth={6}
          color={colors.apricot}
          trackColor={colors.s3}
          accessibilityLabel={t('progressV1.perfectDays')}
        >
          <Text style={styles.ringCenterText} tabular>
            {`${habits.perfectDays}/${habits.totalDays}`}
          </Text>
        </Ring>

        <View style={styles.flexOne}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.perfectDays')}
          </Text>
          <Text variant="meta" color="textLo">
            {t('progressV1.perfectDaysSub')}
          </Text>
        </View>
      </Card>

      {/* Steps card */}
      <Card style={styles.cardPad} testID="steps-chart">
        <View style={styles.rowBetween}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.stepsTitle')}
          </Text>
          <Text variant="meta" color="textLo" tabular>
            {t('progressV1.stepsAvgGoal', {
              avg: avgSteps.toLocaleString(getLocale()),
              goal: goalSteps.toLocaleString(getLocale()),
            })}
          </Text>
        </View>

        {data.steps.daily.every((d) => d.steps === 0) ? (
          <View style={styles.emptyChartBox}>
            <Text variant="body" color="textLo" style={styles.emptyCenter}>
              {t('progress.steps.empty')}
            </Text>
          </View>
        ) : (
          <View onLayout={handleLayout} style={styles.barsContainer}>
            <Svg width={chartWidth} height={stepChartH}>
              {stepGoalY != null ? (
                <Line
                  x1={0}
                  y1={stepGoalY}
                  x2={chartWidth}
                  y2={stepGoalY}
                  stroke={colors.hairlineLit}
                  strokeWidth={1}
                  strokeDasharray="3 3"
                />
              ) : null}

              {stepsDays.map((day, idx) => {
                const hit = goalSteps > 0 && day.steps >= goalSteps;
                const h =
                  day.steps > 0 ? Math.max(6, (day.steps / (maxStep || 1)) * (stepChartH - 10)) : 4;
                const x = idx * stepSlotW + (stepSlotW - stepBarW) / 2;
                const y = stepChartH - h;
                return (
                  <Rect
                    key={day.date}
                    x={x}
                    y={y}
                    width={stepBarW}
                    height={h}
                    rx={Math.min(6, stepBarW / 2)}
                    fill={day.steps === 0 ? colors.s3 : hit ? colors.apricot : colors.hairlineLit}
                    onPress={() =>
                      onSelectDay({
                        date: day.date,
                        calories: 0,
                        targetCalories: 0,
                        steps: day.steps,
                        isLoggedDay: day.steps > 0,
                        isGoalDay: hit,
                      })
                    }
                  />
                );
              })}
            </Svg>

            <View style={styles.barLabelsRow}>
              {stepsDays.length <= 10
                ? stepsDays.map((day) => (
                    <Text
                      key={day.date}
                      variant="micro"
                      color="textLo"
                      style={styles.barLabelCenter}
                    >
                      {formatWeekdayLetter(day.date)}
                    </Text>
                  ))
                : [stepsDays[0], stepsDays[Math.floor(stepsDays.length / 2)], stepsDays.at(-1)]
                    .filter(Boolean)
                    .map((day) => (
                      <Text key={day!.date} variant="micro" color="textLo" tabular>
                        {formatShortMonthDay(day!.date)}
                      </Text>
                    ))}
            </View>
          </View>
        )}
      </Card>

      {/* Water weekly circles */}
      <Card style={styles.cardPad} testID="water-chart">
        <View style={styles.rowBetween}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.waterTitle')}
          </Text>
          <Text variant="meta" color="textLo" tabular>
            {t('progressV1.waterGoalHit', {
              hit: habits.waterHitDays,
              total: habits.totalDays,
            })}
          </Text>
        </View>

        <View style={styles.circleDaysRow}>
          {habits.last7Days.map((day) => (
            <View
              key={day.date}
              style={[styles.dayCircle, day.waterHit ? styles.dayCircleHit : styles.dayCircleMiss]}
            >
              <Text
                style={[
                  styles.dayCircleText,
                  { color: day.waterHit ? colors.onBrand : colors.textOff },
                ]}
              >
                {formatWeekdayLetter(day.date)}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      {/* Fasting weekly circles */}
      <Card style={styles.cardPad} testID="fasting-chart">
        <View style={styles.rowBetween}>
          <Text variant="rowTitle" color="textHi">
            {t('progressV1.fastingTitle')}
          </Text>
          <Text variant="meta" color="textLo" tabular>
            {completedFasts > 0 || (data.fasting?.total_fasts ?? 0) > 0
              ? t('progressV1.fastingCompleted', {
                  done: completedFasts,
                  total: totalFasts,
                })
              : t('progressV1.fastingNone')}
          </Text>
        </View>

        <View style={styles.circleDaysRow}>
          {habits.last7Days.map((day) => (
            <View
              key={day.date}
              style={[
                styles.dayCircle,
                day.fastingCompleted ? styles.dayCircleHit : styles.dayCircleMiss,
              ]}
            >
              <Text
                style={[
                  styles.dayCircleText,
                  { color: day.fastingCompleted ? colors.onBrand : colors.textOff },
                ]}
              >
                {formatWeekdayLetter(day.date)}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  sectionStack: {
    gap: space.md,
  },
  cardPad: {
    padding: space.lg,
    gap: space.md,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
  },
  flexOne: {
    flex: 1,
  },
  flexShrinkOne: {
    flexShrink: 1,
  },
  baselineRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  outlinePillBtn: {
    borderRadius: radius.full,
    borderWidth: borders.width,
    borderColor: colors.hairlineLit,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    minHeight: 32,
    justifyContent: 'center',
  },
  pressedBg: {
    backgroundColor: colors.s2,
  },
  weightNumbersRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.md,
  },
  numLText: {
    fontFamily: fonts.display,
    fontSize: 42,
    lineHeight: 46,
    color: colors.textHi,
    letterSpacing: -1.1,
  },
  numMText: {
    fontFamily: fonts.display,
    fontSize: 30,
    lineHeight: 34,
    color: colors.textHi,
    letterSpacing: -0.8,
  },
  unitPad: {
    paddingBottom: 2,
  },
  goalRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  trendPlotRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: space.xs,
  },
  yAxisCol: {
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    paddingBottom: space.xl,
  },
  xTicksRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.xs,
    paddingTop: space.xs,
  },
  emptyChartBox: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  emptyCenter: {
    textAlign: 'center',
  },
  statsThreeRow: {
    flexDirection: 'row',
    gap: space.sm + 2,
  },
  statTile: {
    flex: 1,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.optionCard,
    paddingVertical: space.optical14,
    paddingHorizontal: space.md,
    gap: 3,
  },
  statValText: {
    fontFamily: fonts.display,
    fontSize: 22,
    lineHeight: 26,
    color: colors.textHi,
    letterSpacing: -0.5,
  },
  statValLarge: {
    fontFamily: fonts.display,
    fontSize: 28,
    lineHeight: 32,
    color: colors.textHi,
    letterSpacing: -0.7,
  },
  nutritionSummaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: space.md,
  },
  nutritionRightCol: {
    alignItems: 'flex-end',
    gap: 2,
  },
  barsContainer: {
    position: 'relative',
    paddingTop: space.xs,
  },
  targetCaptionWrap: {
    position: 'absolute',
    right: 0,
    zIndex: 2,
  },
  barLabelsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: space.sm,
  },
  barLabelCenter: {
    flex: 1,
    textAlign: 'center',
  },
  macrosStack: {
    gap: space.md,
  },
  macroRow: {
    gap: space.xs + 2,
  },
  calHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  calCellText: {
    flex: 1,
    textAlign: 'center',
  },
  calGrid: {
    gap: space.xs + 2,
  },
  calRow: {
    flexDirection: 'row',
    gap: space.xs + 2,
  },
  calCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.checkbox,
    alignItems: 'center',
    justifyContent: 'center',
  },
  calCellFilled: {
    backgroundColor: colors.apricot,
  },
  calCellEmpty: {
    backgroundColor: colors.s2,
  },
  calCellToday: {
    borderWidth: 1.5,
    borderColor: colors.textHi,
  },
  calDayNum: {
    fontSize: 13,
  },
  recentHeaderWrap: {
    gap: space.sm + 2,
    paddingTop: space.xs,
  },
  recentList: {
    gap: space.sm + 2,
  },
  sessionRowCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.optical14,
    paddingHorizontal: space.lg,
  },
  sessionIconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.iconTile,
    backgroundColor: colors.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  perfectDaysCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    padding: space.lg,
  },
  ringCenterText: {
    fontFamily: fonts.display,
    fontSize: 20,
    lineHeight: 24,
    color: colors.textHi,
    letterSpacing: -0.4,
  },
  circleDaysRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: space.xs,
  },
  dayCircle: {
    width: 38,
    height: 38,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dayCircleHit: {
    backgroundColor: colors.apricot,
  },
  dayCircleMiss: {
    backgroundColor: colors.bg0,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  dayCircleText: {
    fontFamily: fonts.bold,
    fontSize: 13,
  },
});
