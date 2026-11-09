import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';
import {
  dark,
  homeLayout,
  radius,
  space,
  Text,
  nutritionColors,
  squadIndicators,
} from '@calipartner/ui';
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
  activity,
  onEdit,
}: {
  score?: number | null;
  goal?: string;
  metrics: {
    id?: string;
    enabled?: boolean;
    nutrient?: 'calories' | 'protein' | 'carbs' | 'fat';
    label: string;
    value: number;
    target: number | null;
    unit: string;
    loading?: boolean;
    error?: boolean;
  }[];
  activity?: { loading: boolean; error: boolean; names: string[] };
  loading: boolean;
  error: boolean;
  errorMessage?: string;
  onRetry: () => void;
  onPress: () => void;
  onEdit?: () => void;
}) {
  return (
    <View style={styles.card} testID="personal-day-card">
      <View style={styles.row}>
        <View style={styles.titleGroup}>
          <Text variant="heading" style={styles.title}>
            <Ionicons
              name="stats-chart"
              size={homeLayout.iconSize}
              color={dark.textHi}
              accessible={false}
            />{' '}
            {t('homeRefresh.yourDay')}
          </Text>
          {onEdit && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('personalDay.editTracking')}
              onPress={onEdit}
              style={styles.edit}
              testID="edit-daily-tracking"
            >
              <Ionicons
                name="pencil"
                size={homeLayout.editIconSize}
                color={dark.textHi}
                style={styles.pencil}
                accessible={false}
              />
            </Pressable>
          )}
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
          {metrics.length === 0 && <Text>{t('personalDay.nothingTracked')}</Text>}
          {metrics.map(
            ({
              id,
              label,
              value,
              target,
              unit,
              nutrient,
              enabled = true,
              loading: pending,
              error: failed,
            }) => (
              <View
                key={label}
                style={[
                  styles.metric,
                  nutrient === 'calories' && styles.fullMetric,
                  !enabled && styles.disabled,
                ]}
                testID={`personal-day-metric-${id ?? nutrient}`}
                accessible
                accessibilityLabel={
                  label +
                  ': ' +
                  (!enabled
                    ? t('squadDesign.notTracked')
                    : pending
                      ? t('common.loading')
                      : failed
                        ? t('common.errorBody')
                        : target == null
                          ? t('common.targetUnavailable')
                          : t('squadDesign.amount', { value, target, unit }))
                }
              >
                <View style={nutrient === 'calories' ? styles.row : styles.tileHeading}>
                  <Text
                    variant="bodyS"
                    nutrient={enabled ? nutrient : undefined}
                    style={!enabled && styles.blurredText}
                  >
                    <Ionicons
                      name={
                        nutrient === 'calories'
                          ? 'flame-outline'
                          : nutrient === 'protein'
                            ? 'barbell-outline'
                            : nutrient === 'carbs'
                              ? 'restaurant-outline'
                              : nutrient === 'fat'
                                ? 'water-outline'
                                : id === 'steps'
                                  ? 'footsteps-outline'
                                  : 'beaker-outline'
                      }
                      size={homeLayout.editIconSize}
                      color={dark.textMid}
                      accessible={false}
                    />{' '}
                    {label}
                  </Text>
                  <Text
                    variant="bodyS"
                    nutrient={enabled ? nutrient : undefined}
                    tabular
                    style={[styles.amount, !enabled && styles.blurredText]}
                  >
                    {pending
                      ? t('common.loading')
                      : failed
                        ? t('common.errorBody')
                        : target == null
                          ? t('common.targetUnavailable')
                          : t('squadDesign.amount', { value, target, unit })}
                  </Text>
                </View>
                {!pending && !failed && (
                  <DayProgressTrack
                    value={value}
                    target={target}
                    color={nutrient ? nutritionColors[nutrient] : dark.textMid}
                    testID={`personal-day-track-${id ?? nutrient ?? 'steps'}`}
                  />
                )}
                {!pending && !failed && target != null && value > target && (
                  <Text variant="bodyS">{t('homeRefresh.over')}</Text>
                )}
              </View>
            ),
          )}
          {activity && (
            <View style={styles.metric} testID="home-workout-summary">
              <Text variant="bodyS">{t('aha.workout')}</Text>
              <Text variant="bodyS" accessibilityLiveRegion="polite">
                {activity.loading
                  ? t('common.loading')
                  : activity.error
                    ? t('common.errorBody')
                    : activity.names.length
                      ? activity.names.join(' · ')
                      : t('aha.noWorkout')}
              </Text>
            </View>
          )}
        </Pressable>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  disabled: { opacity: homeLayout.disabledOpacity },
  blurredText: {
    color: squadIndicators.transparent,
    textShadowColor: dark.textMid,
    textShadowOffset: { width: space[0], height: space[0] },
    textShadowRadius: homeLayout.disabledBlur,
  },
  titleGroup: { flexDirection: 'row', alignItems: 'center', flexShrink: 1 },
  title: { flexShrink: 1 },
  pencil: { transform: [{ scaleX: homeLayout.editIconWidthScale }] },
  edit: {
    marginLeft: -space[2],
    minHeight: homeLayout.touchSize,
    minWidth: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
  card: {
    backgroundColor: dark.s1,
    borderColor: dark.copper,
    borderWidth: 1,
    borderRadius: radius.card,
    padding: space[4],
    gap: space[4],
    marginBottom: space[5],
  },
  list: { flexDirection: 'row', flexWrap: 'wrap', gap: space[3], minHeight: homeLayout.touchSize },
  metric: { gap: space[2], flexGrow: 1, flexBasis: homeLayout.metricTileMinWidth, minWidth: 0 },
  fullMetric: { flexBasis: '100%' },
  tileHeading: { gap: space[1], flexWrap: 'wrap' },
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
