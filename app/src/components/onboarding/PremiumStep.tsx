import React from 'react';
import { View } from 'react-native';
import { CheckIcon, Text, onboardingLayout as layout, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function PremiumStep() {
  const { colors } = useTheme();
  return (
    <PlanCard testID="premium-highlights">
      {(['One', 'Two', 'Three', 'Four'] as const).map((number) => (
        <View key={number} style={planStyles.row}>
          <CheckIcon size={layout.icon} color={colors.textHi} />
          <Text fontSet="onboarding" color={colors.textHi} style={planStyles.flex}>
            {t(`setup.premiumHighlight${number}`)}
          </Text>
        </View>
      ))}
    </PlanCard>
  );
}
