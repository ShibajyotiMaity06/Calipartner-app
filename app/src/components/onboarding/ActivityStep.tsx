import React from 'react';
import { View } from 'react-native';
import type { ActivityLevel } from '@calipartner/core';
import { t } from '@/i18n';
import { PlanChoice, planStyles } from './PlanPrimitives';

export function ActivityStep({
  selectedActivityLevel,
  onSelectActivityLevel,
}: {
  selectedActivityLevel: ActivityLevel;
  onSelectActivityLevel: (level: ActivityLevel) => void;
}) {
  return (
    <View style={planStyles.section} accessibilityRole="radiogroup">
      {(
        [
          ['sedentary', 'sedentary'],
          ['light', 'light'],
          ['moderate', 'moderate'],
          ['very_active', 'veryActive'],
          ['extra_active', 'extraActive'],
        ] as const
      ).map(([level, key]) => (
        <PlanChoice
          key={level}
          title={t(`onboarding.activity.${key}Title`)}
          description={t(`onboarding.activity.${key}Desc`)}
          selected={selectedActivityLevel === level}
          onPress={() => onSelectActivityLevel(level)}
          testID={`activity-card-${level}`}
        />
      ))}
    </View>
  );
}
