import { CompactSelect, type CompactSelectOption } from '@/components/CompactSelect';
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
  const options: CompactSelectOption<ActivityLevel>[] = [
    {
      value: 'sedentary',
      label: t('onboarding.activity.sedentaryTitle'),
      icon: 'bed-outline',
      description: t('onboarding.activity.sedentaryDesc'),
    },
    {
      value: 'light',
      label: t('onboarding.activity.lightTitle'),
      icon: 'walk-outline',
      description: t('onboarding.activity.lightDesc'),
    },
    {
      value: 'moderate',
      label: t('onboarding.activity.moderateTitle'),
      icon: 'bicycle-outline',
      description: t('onboarding.activity.moderateDesc'),
    },
    {
      value: 'very_active',
      label: t('onboarding.activity.veryActiveTitle'),
      icon: 'fitness-outline',
      description: t('onboarding.activity.veryActiveDesc'),
    },
    {
      value: 'extra_active',
      label: t('onboarding.activity.extraActiveTitle'),
      icon: 'flash-outline',
      description: t('onboarding.activity.extraActiveDesc'),
    },
  ];

  const selected = options.find((item) => item.value === selectedActivityLevel);

  return (
    <View style={planStyles.section}>
      <CompactSelect
        label={t('onboarding.activity.title')}
        icon="fitness-outline"
        selected={[selectedActivityLevel]}
        options={options}
        onSelect={onSelectActivityLevel}
        testID="activity-level"
      />
      {selected?.description ? <Text variant="bodyS">{selected.description}</Text> : null}
    </View>
  );
}
