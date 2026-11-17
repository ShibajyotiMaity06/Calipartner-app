import React from 'react';
import { View } from 'react-native';
import { Button, controls, radius, space, Text, useTheme } from '@calipartner/ui';
import { weightMilestone } from '@calipartner/core';
import { t } from '@/i18n';

export function WeightGoalHeroCard({
  starting,
  current,
  target,
  pace,
  onGoals,
}: {
  starting: number | null;
  current: number | null;
  target: number | null;
  pace: number | null;
  onGoals: () => void;
}) {
  const { colors } = useTheme();
  const result = weightMilestone(starting, current, target);
  const kg = (value: number | null) =>
    value === null
      ? t('progressRefresh.missing')
      : t('progressRefresh.kg', { value: value.toFixed(1) });
  return (
    <View
      testID="weight-goal-hero"
      style={{
        backgroundColor: colors.s1,
        borderRadius: radius.card,
        padding: space[4],
        gap: space[3],
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[4] }}>
        {(
          [
            ['current', current],
            ['goal', target],
            ['starting', starting],
          ] as const
        ).map(([key, value]) => (
          <View key={key} style={{ flexGrow: 1 }}>
            <Text variant="micro" color={colors.textMid}>
              {t(`progressRefresh.${key}`)}
            </Text>
            <Text variant={key === 'current' ? 'numeralL' : 'heading'} tabular>
              {kg(value)}
            </Text>
          </View>
        ))}
      </View>
      {result.percent !== null && !result.maintaining ? (
        <>
          <Text tabular>
            {t('progressRefresh.reached', { percent: Math.round(result.percent) })}
          </Text>
          <View
            accessibilityRole="progressbar"
            accessibilityLabel={t('progressRefresh.goal')}
            accessibilityValue={{ min: 0, max: 100, now: result.percent }}
            style={{
              height: controls.progressHeight,
              backgroundColor: colors.s3,
              borderRadius: radius.full,
              overflow: 'hidden',
            }}
          >
            <View
              style={{ height: '100%', width: `${result.percent}%`, backgroundColor: colors.iris }}
            />
          </View>
        </>
      ) : result.maintaining ? (
        <Text>{t('progressRefresh.maintain')}</Text>
      ) : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space[3] }}>
        <Text variant="bodyS" tabular>
          {t('progressRefresh.change')}: {kg(result.change)}
        </Text>
        {!result.maintaining && (
          <Text variant="bodyS" tabular>
            {t('progressRefresh.remaining')}: {kg(result.remaining)}
          </Text>
        )}
        <Text variant="bodyS" tabular>
          {t('progressRefresh.pace')}:{' '}
          {pace === null
            ? t('progressRefresh.missing')
            : t('progressRefresh.kgWeek', { value: pace.toFixed(2) })}
        </Text>
      </View>
      {current === null && <Text>{t('progressRefresh.noWeight')}</Text>}
      {target === null && (
        <Button
          variant="secondary"
          label={t('progressRefresh.setGoal')}
          onPress={onGoals}
          testID="progress-set-goal"
        />
      )}
    </View>
  );
}
