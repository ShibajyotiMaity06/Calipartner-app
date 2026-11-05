import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { dark, homeLayout, radius, space, Text, nutritionColors } from '@calipartner/ui';
import { t } from '@/i18n';

/** A visual progress track. Goal and nutrition calculations remain in core. */
export function DayProgressTrack({
  value,
  target,
  color,
  testID,
}: {
  value: number;
  target: number | null;
  color: string;
  testID?: string;
}) {
  const ratio = target != null && target > 0 ? value / target : null;
  return (
    <View style={styles.track} accessible={false} testID={testID}>
      {ratio !== null && (
        <View
          style={[
            styles.fill,
            { width: `${Math.min(100, Math.max(0, ratio * 100))}%`, backgroundColor: color },
          ]}
        />
      )}
      {ratio !== null && ratio > 1 && (
        <View style={[styles.over, { width: `${Math.min(100, (ratio - 1) * 100)}%` }]} />
      )}
    </View>
  );
}

export function PersonalDayCard({
  score,
  goal,
  metrics,
  loading,
  error,
  errorMessage,
  onRetry,
  onPress,
}: {
  score?: number | null;
  goal?: string;
  metrics: {
    nutrient?: 'calories' | 'protein' | 'carbs' | 'fat';
    label: string;
    value: number;
    target: number | null;
    unit: string;
  }[];
  loading: boolean;
  error: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onPress: () => void;
}) {
  return (
    <View style={styles.card} testID="personal-day-card">
      <View style={styles.row}>
        <View style={styles.metric}>
          <Text variant="heading">{t('homeRefresh.yourDay')}</Text>
          {goal && <Text variant="bodyS">{goal}</Text>}
        </View>
        {!loading && !error && score != null && (
          <Text variant="numeralL" tabular>
            {t('squadDesign.percent', { value: score })}
          </Text>
        )}
      </View>
      {loading ? (
        <Text accessibilityLiveRegion="polite">{t('common.loading')}</Text>
      ) : error ? (
        <Pressable
          onPress={onRetry}
          accessibilityRole="button"
          accessibilityLabel={t('common.retry')}
          style={styles.action}
          testID="personal-day-retry"
        >
          <Text accessibilityRole="alert">
            {errorMessage ?? t('common.errorBody')} · {t('common.retry')}
          </Text>
        </Pressable>
      ) : (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={t('tabs.progress')}
          testID="personal-day-open"
          style={styles.list}
        >
          {metrics.map(({ label, value, target, unit, nutrient }) => (
            <View
              key={label}
              style={styles.metric}
              accessible
              accessibilityLabel={
                label +
                ': ' +
                (target == null
                  ? t('common.targetUnavailable')
                  : t('squadDesign.amount', { value, target, unit }))
              }
            >
              <View style={styles.row}>
                <Text variant="bodyS" nutrient={nutrient}>
                  {label}
                </Text>
                <Text variant="bodyS" nutrient={nutrient} tabular style={styles.amount}>
                  {target == null
                    ? t('common.targetUnavailable')
                    : t('squadDesign.amount', { value, target, unit })}
                </Text>
              </View>
              <DayProgressTrack
                value={value}
                target={target}
                color={nutrient ? nutritionColors[nutrient] : dark.textMid}
                testID={`personal-day-track-${nutrient ?? 'steps'}`}
              />
              {target != null && value > target && (
                <Text variant="bodyS">{t('homeRefresh.over')}</Text>
              )}
            </View>
          ))}
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.s1,
    borderColor: dark.copper,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[4],
    marginBottom: space[5],
  },
  list: { gap: space[3], minHeight: homeLayout.touchSize },
  metric: { gap: space[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: space[2] },
  amount: { flexShrink: 1 },
  track: {
    width: '100%',
    height: space[2],
    backgroundColor: dark.s3,
    borderRadius: radius.full,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: dark.apricot, borderRadius: radius.full },
  over: {
    position: 'absolute',
    height: '100%',
    backgroundColor: dark.cream,
    borderRadius: radius.full,
  },
  action: { minHeight: homeLayout.touchSize, justifyContent: 'center' },
});
