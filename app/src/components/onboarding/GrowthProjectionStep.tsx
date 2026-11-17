import React, { useEffect, useId, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, {
  Circle,
  Defs,
  G,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { Text, entryLayout, radius, space, type as typography, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { growthEase, growthFrame, growthSeries, growthX as X, growthY as Y } from './growthArtwork';

export function GrowthProjectionStep() {
  const { colors, reduceMotion } = useTheme();
  const [elapsed, setElapsed] = useState(0);
  const id = useId().replace(/:/g, '');
  useEffect(() => {
    if (reduceMotion) return;
    let raf = 0,
      start: number | null = null;
    const tick = (now: number) => {
      if (start === null) start = now;
      const next = Math.min(5500, now - start);
      setElapsed(next);
      if (next < 5500) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reduceMotion]);
  const progress = reduceMotion ? 1 : growthEase(Math.min(1, elapsed / 4800));
  const done = progress >= 1;
  const pulse = (elapsed % 1100) / 1100;
  const palette = {
    none: [colors.textLo, colors.textLo],
    plus: [colors.teal, colors.sky],
    pro: [colors.apricot, colors.rose],
  };
  return (
    <View style={styles.section} testID="growth-projection-step">
      <Text color={colors.textMid}>{t('entryPolish.growthSubtitle')}</Text>
      <View style={styles.legend}>
        {growthSeries.map((s) => (
          <View key={s.id} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: palette[s.id][1] }]} />
            <Text variant="bodyS">{t(`entryPolish.${s.id}`)}</Text>
          </View>
        ))}
      </View>
      <View
        style={[styles.card, { backgroundColor: colors.s1 }]}
        accessible
        accessibilityRole="image"
        accessibilityLabel={t('entryPolish.growthSummary')}
      >
        <Svg width="100%" viewBox="0 0 400 340" style={styles.chart} accessible={false}>
          <Defs>
            {growthSeries.map((s) => (
              <G key={s.id}>
                <LinearGradient
                  id={`${id}-g-${s.id}`}
                  gradientUnits="userSpaceOnUse"
                  x1={X(0)}
                  x2={X(1)}
                  y1={0}
                  y2={0}
                >
                  <Stop offset="0" stopColor={palette[s.id][0]} />
                  <Stop offset="1" stopColor={palette[s.id][1]} />
                </LinearGradient>
                <LinearGradient id={`${id}-a-${s.id}`} x1="0" y1="0" x2="0" y2="1">
                  <Stop offset="0" stopColor={palette[s.id][1]} stopOpacity={0.26} />
                  <Stop offset="1" stopColor={palette[s.id][1]} stopOpacity={0} />
                </LinearGradient>
              </G>
            ))}
          </Defs>
          {[0.25, 0.5, 0.75, 1].map((v) => (
            <Line
              key={v}
              x1={X(0)}
              x2={X(1)}
              y1={Y(v)}
              y2={Y(v)}
              stroke={colors.hairline}
              strokeWidth={1}
            />
          ))}
          <Line
            x1={X(1)}
            x2={X(1)}
            y1={28}
            y2={Y(0)}
            stroke={colors.hairlineLit}
            strokeWidth={1.5}
            strokeDasharray="4 5"
          />
          <SvgText
            x={X(1) + 14}
            y={24}
            textAnchor="end"
            fill={colors.textMid}
            fontSize={typography.micro.fontSize}
            fontFamily={typography.body.fontFamily}
          >
            {t('entryPolish.end')}
          </SvgText>
          <Line
            x1={X(0)}
            x2={X(1)}
            y1={Y(0)}
            y2={Y(0)}
            stroke={colors.hairlineLit}
            strokeWidth={1.5}
          />
          <Line
            x1={X(0)}
            x2={X(0)}
            y1={Y(0)}
            y2={34}
            stroke={colors.hairlineLit}
            strokeWidth={1.5}
          />
          {(['start', 'month1', 'month2', 'month3'] as const).map((key, i) => (
            <G key={key}>
              <Line
                x1={X(i / 3)}
                x2={X(i / 3)}
                y1={Y(0)}
                y2={Y(0) + 5}
                stroke={colors.hairlineLit}
                strokeWidth={1.5}
              />
              <SvgText
                x={X(i / 3)}
                y={Y(0) + 22}
                textAnchor={i === 0 ? 'start' : i === 3 ? 'end' : 'middle'}
                fill={colors.textMid}
                fontSize={typography.micro.fontSize}
                fontFamily={typography.body.fontFamily}
              >
                {t(`entryPolish.${key}`)}
              </SvgText>
            </G>
          ))}
          <SvgText
            x={185}
            y={334}
            textAnchor="middle"
            fill={colors.textMid}
            fontSize={typography.micro.fontSize}
            fontFamily={typography.body.fontFamily}
          >
            {t('entryPolish.time')}
          </SvgText>
          <SvgText
            transform="translate(13 168) rotate(-90)"
            textAnchor="middle"
            fill={colors.textMid}
            fontSize={typography.micro.fontSize}
            fontFamily={typography.body.fontFamily}
          >
            {t('entryPolish.growth')}
          </SvgText>
          {growthSeries.map((s, i) => {
            const frame = growthFrame(i, progress),
              end = growthFrame(i, 1),
              color = palette[s.id][1];
            return (
              <G key={s.id}>
                <Path d={frame.area} fill={`url(#${id}-a-${s.id})`} />
                <Path
                  d={frame.d}
                  fill="none"
                  stroke={`url(#${id}-g-${s.id})`}
                  strokeWidth={s.id === 'pro' ? 5 : 4}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                <G transform={`translate(${frame.x} ${frame.y})`}>
                  {!done && !reduceMotion ? (
                    <Circle
                      r={9 * (0.6 + 1.6 * pulse)}
                      fill="none"
                      stroke={color}
                      strokeWidth={2}
                      opacity={0.8 * (1 - pulse)}
                    />
                  ) : null}
                  <Circle r={6} fill={colors.s1} stroke={color} strokeWidth={3.5} />
                </G>
                <G opacity={reduceMotion ? 1 : Math.max(0, Math.min(1, (elapsed - 4800) / 700))}>
                  <Circle
                    cx={end.x}
                    cy={end.y}
                    r={6}
                    fill={colors.s1}
                    stroke={color}
                    strokeWidth={3.5}
                  />
                  <SvgText
                    x={end.x + 12}
                    y={end.y + 5}
                    fill={colors.textHi}
                    fontFamily={typography.heading.fontFamily}
                    fontSize={typography.micro.fontSize}
                  >
                    {t(s.id === 'none' ? 'entryPolish.noneShort' : `entryPolish.${s.id}`)}
                  </SvgText>
                </G>
              </G>
            );
          })}
        </Svg>
      </View>
      <Text variant="bodyS" testID="growth-disclosure">
        {t('entryPolish.growthDisclosure')}
      </Text>
      <Text variant="bodyS">{t('entryPolish.growthSummary')}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  section: { gap: space[4] },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3] },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: space[2] },
  swatch: { width: space[5], height: space[1], borderRadius: radius.full },
  card: { borderRadius: radius.card, padding: space[2], overflow: 'hidden' },
  chart: { aspectRatio: entryLayout.chartWidth / entryLayout.chartHeight },
});
