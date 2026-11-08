import { CompactSelect } from '@/components/CompactSelect';
import { Text } from '@calipartner/ui';
import React from 'react';
import { View } from 'react-native';
import type { ActivityLevel } from '@calipartner/core';
import { t } from '@/i18n';
import { planStyles } from './PlanPrimitives';

export function ActivityStep({
  selectedActivityLevel,
  onSelectActivityLevel,
}: {
  selectedActivityLevel: ActivityLevel;
  onSelectActivityLevel: (level: ActivityLevel) => void;
}) {
  const options = [
    ['sedentary', 'sedentary'],
    ['light', 'light'],
    ['moderate', 'moderate'],
    ['very_active', 'veryActive'],
    ['extra_active', 'extraActive'],
  ] as const;
  const selected = options.find(([value]) => value === selectedActivityLevel)!;
  return (
    <View style={planStyles.section}>
      <CompactSelect
        label={t('onboarding.activity.title')}
        selected={[selectedActivityLevel]}
        options={options.map(([value, key]) => ({
          value,
          label: t(`onboarding.activity.${key}Title`),
        }))}
        onSelect={onSelectActivityLevel}
        testID="activity-level"
      />
      <Text variant="bodyS">{t(`onboarding.activity.${selected[1]}Desc`)}</Text>
    </View>
  );
}
