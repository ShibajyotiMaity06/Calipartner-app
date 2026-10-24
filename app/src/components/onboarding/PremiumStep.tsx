import React from 'react';
import { View } from 'react-native';
import { CheckIcon, Text, onboardingLayout as layout, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';

export function PremiumStep() {
  const { colors } = useTheme();
  return (
    <View style={planStyles.section}>
      {(['plus', 'pro'] as const).map((tier) => (
        <PlanCard key={tier} testID={`premium-${tier}`}>
          <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
            {t(`setup.${tier}Badge`)}
          </Text>
          <Text fontSet="onboarding" variant="title2" color={colors.textHi}>
            {t(`setup.${tier}`)}
          </Text>
          <Text fontSet="onboarding" variant="body" color={colors.textMid}>
            {t(`setup.${tier}Body`)}
          </Text>
          {(['One', 'Two', 'Three'] as const).map((number) => (
            <View key={number} style={planStyles.row}>
              <CheckIcon size={layout.icon} color={colors.textHi} />
              <Text
                fontSet="onboarding"
                variant="bodyS"
                color={colors.textMid}
                style={planStyles.flex}
              >
                {t(`setup.${tier}Feature${number}`)}
              </Text>
            </View>
          ))}
        </PlanCard>
      ))}
      <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
        {t('setup.premiumFootnote')}
      </Text>
      <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
        {t('setup.tryHint')}
      </Text>
    </View>
  );
}
