import React from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { Card, ScreenTitle, Text, colors, fonts, space } from '@calipartner/ui/v1';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';
import { computeOnboardingRevealSummary, formatWeightForUnits } from './onboardingProjection';

const CHART_WIDTH = 302;
const CHART_HEIGHT = 136;
const PAD_X = 14;
const TOP_Y = 38;
const BOTTOM_Y = 114;

function buildSmoothCurvePaths(weightsKg: number[]): {
  linePath: string;
  areaPath: string;
  startPoint: { x: number; y: number };
  endPoint: { x: number; y: number };
} {
  const safe = weightsKg.length >= 2 ? weightsKg : [70, 65];
  const minW = Math.min(...safe);
  const maxW = Math.max(...safe);
  const spanW = Math.max(0.5, maxW - minW);
  const usableW = CHART_WIDTH - PAD_X * 2;
  const usableH = BOTTOM_Y - TOP_Y;

  const coords = safe.map((w, idx) => {
    const x = PAD_X + (idx / (safe.length - 1)) * usableW;
    const norm = (maxW - w) / spanW;
    const y = TOP_Y + norm * usableH;
    return {
      x: Math.round(x * 10) / 10,
      y: Math.round(y * 10) / 10,
    };
  });

  const first = coords[0]!;
  const last = coords[coords.length - 1]!;
  let line = `M ${first.x} ${first.y}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[Math.max(0, i - 1)]!;
    const p1 = coords[i]!;
    const p2 = coords[i + 1]!;
    const p3 = coords[Math.min(coords.length - 1, i + 2)]!;
    const cp1x = Math.round((p1.x + (p2.x - p0.x) / 6) * 10) / 10;
    const cp1y = Math.round((p1.y + (p2.y - p0.y) / 6) * 10) / 10;
    const cp2x = Math.round((p2.x - (p3.x - p1.x) / 6) * 10) / 10;
    const cp2y = Math.round((p2.y - (p3.y - p1.y) / 6) * 10) / 10;
    line += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }
  const area = `${line} L ${last.x} ${CHART_HEIGHT} L ${first.x} ${CHART_HEIGHT} Z`;
  return { linePath: line, areaPath: area, startPoint: first, endPoint: last };
}

export function RevealStepView({ state }: { state: OnboardingState }) {
  const summary = computeOnboardingRevealSummary(state);
  const unit = t(state.units === 'metric' ? 'onboardingV1.unitKg' : 'onboardingV1.unitLb');
  const startLabel = formatWeightForUnits(summary.startKg, state.units);
  const targetLabel = formatWeightForUnits(summary.endKg, state.units);
  const deltaValue =
    state.units === 'metric'
      ? summary.deltaKg
      : Math.round(
          (Number(formatWeightForUnits(summary.endKg, state.units)) -
            Number(formatWeightForUnits(summary.startKg, state.units))) *
            10,
        ) / 10;
  const deltaFormatted = `${deltaValue > 0 ? '+' : ''}${deltaValue.toFixed(1)}`;
  const rateFormatted = `${state.goal === 'cut' ? '-' : state.goal === 'bulk' ? '+' : ''}${formatWeightForUnits(summary.rateKg, state.units)} ${unit}`;
  const trimmedName = state.nickname.trim();
  const targetBadge = `${targetLabel} ${unit}`;
  const titleText = trimmedName
    ? t('onboardingV1.revealTitleNamed', {
        name: trimmedName,
        weeks: summary.weeks,
        target: targetBadge,
      })
    : t('onboardingV1.revealTitleFallback', {
        weeks: summary.weeks,
        target: targetBadge,
      });

  const { linePath, areaPath, startPoint, endPoint } = buildSmoothCurvePaths(
    summary.curveWeightsKg,
  );

  return (
    <View style={styles.root} testID="onboarding-reveal-v1">
      <ScreenTitle
        eyebrow={t('onboardingV1.revealEyebrow')}
        title={titleText}
        accentWord={targetBadge}
        subtitle={t('onboardingV1.revealSubtitle', { pace: rateFormatted })}
        spacingBottom={space.xl}
        testID="onboarding-title"
      />

      <Card variant="hero" style={styles.heroCard} testID="onboarding-peak-reveal">
        <View style={styles.chartWrap}>
          <View style={styles.chartHeaderRow}>
            <Text variant="meta" color="textMid" tabular>
              {t('onboardingV1.revealTodayPoint', { weight: `${startLabel} ${unit}` })}
            </Text>
            <Text variant="meta" color="textHi" tabular style={styles.endLabel}>
              {t('onboardingV1.revealEndPoint', {
                date: summary.etaLabel,
                weight: `${targetLabel} ${unit}`,
              })}
            </Text>
          </View>

          <Svg width="100%" height={CHART_HEIGHT} viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}>
            <Defs>
              <LinearGradient id="revealCurveFill" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={colors.apricot} stopOpacity="0.22" />
                <Stop offset="1" stopColor={colors.apricot} stopOpacity="0" />
              </LinearGradient>
            </Defs>
            <Path d={areaPath} fill="url(#revealCurveFill)" />
            <Path
              d={linePath}
              stroke={colors.apricot}
              strokeWidth={2.5}
              strokeLinecap="round"
              fill="none"
            />
            <Circle cx={startPoint.x} cy={startPoint.y} r={4.5} fill={colors.textHi} />
            <Circle cx={endPoint.x} cy={endPoint.y} r={10} fill={colors.apricotGlowHigh} />
            <Circle cx={endPoint.x} cy={endPoint.y} r={4.5} fill={colors.apricot} />
          </Svg>
        </View>

        <View style={styles.divider} />

        <View style={styles.metricsRow} testID="reveal-metrics-row">
          <View style={styles.metricCol}>
            <Text maxFontSizeMultiplier={1.2} tabular style={styles.metricNum}>
              {String(summary.weeks)}
            </Text>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.revealWeeks')}
            </Text>
          </View>
          <View style={styles.metricCol}>
            <Text maxFontSizeMultiplier={1.2} tabular style={styles.metricNum}>
              {deltaFormatted}
            </Text>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.revealTotalUnit', { unit })}
            </Text>
          </View>
          <View style={styles.metricColEnd}>
            <Text maxFontSizeMultiplier={1.2} tabular style={styles.metricNum}>
              {summary.targetKcal.toLocaleString('en-US')}
            </Text>
            <Text variant="meta" color="textLo">
              {t('onboardingV1.revealKcalDay')}
            </Text>
          </View>
        </View>
      </Card>

      <Text variant="meta" color="textLo" style={styles.disclaimer}>
        {t('onboardingV1.revealDisclaimer')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  heroCard: {
    padding: space.xl,
  },
  chartWrap: {
    position: 'relative',
  },
  chartHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: -space.md,
    zIndex: 1,
  },
  endLabel: {
    fontFamily: fonts.semibold,
  },
  divider: {
    height: 1,
    backgroundColor: colors.hairline,
    marginTop: space.xs,
    marginBottom: space.lg,
  },
  metricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  metricCol: {
    flex: 1,
    gap: 2,
  },
  metricColEnd: {
    flex: 1,
    alignItems: 'flex-end',
    gap: 2,
  },
  metricNum: {
    fontFamily: fonts.display,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.7,
    color: colors.textHi,
  },
  disclaimer: {
    marginTop: space.md,
  },
});
