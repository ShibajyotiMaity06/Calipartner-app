import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface GoalProgressRingProps {
  progressPct: number | null;
  targetWeightKg?: number | null;
  currentTrendKg?: number | null;
  testID?: string;
}

export function GoalProgressRing({
  progressPct,
  targetWeightKg,
  currentTrendKg,
  testID = 'goal-progress-ring',
}: GoalProgressRingProps) {
  const { colors } = useTheme();

  const size = 120;
  const strokeWidth = 10;
  const center = size / 2;
  const radiusVal = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radiusVal;

  const validPct = progressPct != null ? Math.min(100, Math.max(0, progressPct)) : 0;
  const strokeDashoffset = circumference - (circumference * validPct) / 100;

  const accessibilityText =
    progressPct != null
      ? `${Math.round(validPct)}% progress towards target weight`
      : 'Goal progress not available yet';

  return (
    <View
      style={[styles.container, { backgroundColor: colors.surface }]}
      testID={testID}
      accessibilityRole="image"
      accessibilityLabel={accessibilityText}
    >
      <View style={styles.ringWrapper}>
        <Svg width={size} height={size}>
          {/* Background circle */}
          <Circle
            cx={center}
            cy={center}
            r={radiusVal}
            stroke={colors.border}
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <Circle
            cx={center}
            cy={center}
            r={radiusVal}
            stroke={colors.accent}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        </Svg>
        <View style={styles.centerTextContainer}>
          <Text style={[styles.percentText, { color: colors.text }]}>
            {progressPct != null ? `${Math.round(validPct)}%` : '--%'}
          </Text>
          <Text style={[styles.subText, { color: colors.textMuted }]}>
            {t('progress.goalProgress.title')}
          </Text>
        </View>
      </View>

      <View style={styles.detailsContainer}>
        {currentTrendKg != null && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
              {t('progress.weight.current')}
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {currentTrendKg.toFixed(1)} kg
            </Text>
          </View>
        )}
        {targetWeightKg != null && (
          <View style={styles.detailItem}>
            <Text style={[styles.detailLabel, { color: colors.textMuted }]}>
              {t('progress.weight.goal')}
            </Text>
            <Text style={[styles.detailValue, { color: colors.text }]}>
              {targetWeightKg.toFixed(1)} kg
            </Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: spacing.md,
    borderRadius: radius.lg,
    marginHorizontal: spacing.md,
    marginVertical: spacing.sm,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  ringWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  centerTextContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  percentText: {
    fontSize: fontSize.xl,
    fontWeight: '700',
  },
  subText: {
    fontSize: fontSize.xs,
    fontWeight: '500',
    marginTop: 2,
  },
  detailsContainer: {
    flexDirection: 'row',
    marginTop: spacing.md,
    justifyContent: 'space-around',
    width: '100%',
  },
  detailItem: {
    alignItems: 'center',
  },
  detailLabel: {
    fontSize: fontSize.xs,
  },
  detailValue: {
    fontSize: fontSize.md,
    fontWeight: '600',
    marginTop: 2,
  },
});
