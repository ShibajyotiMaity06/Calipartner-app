import React from 'react';
import { View } from 'react-native';
import type { Goal } from '@calipartner/core';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function MotivationStep({ goal }: { goal: Goal }) {
  const { colors } = useTheme();
  return (
    <View style={planStyles.section} testID={`motivation-${goal}`}>
      <Text fontSet="onboarding" variant="title1" color={colors.textHi}>
        {t(`setup.${goal}Title`)}
      </Text>
      <Text fontSet="onboarding" variant="body" color={colors.textMid}>
        {t(`setup.${goal}Body`)}
      </Text>
      <PlanCard>
        <Text fontSet="onboarding" variant="title2" color={colors.textHi}>
          {t(`setup.${goal}Fun`)}
        </Text>
      </PlanCard>
      <PlanCard testID="motivation-fact">
        <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
          {t('setup.usefulFact')}
        </Text>
        <Text fontSet="onboarding" variant="body" color={colors.textHi}>
          {t(`setup.${goal}Fact`)}
        </Text>
      </PlanCard>
    </View>
  );
}
