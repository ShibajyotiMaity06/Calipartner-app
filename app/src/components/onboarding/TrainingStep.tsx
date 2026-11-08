import { CompactSelect } from '@/components/CompactSelect';
import React from 'react';
import { View } from 'react-native';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { NumberField, PlanCard, planStyles } from './PlanPrimitives';
import { HeightField } from './HeightField';

export function TrainingStep({
  state,
  onWeight,
  onHeight,
  onDays,
}: {
  state: OnboardingState;
  onWeight: (value: number) => void;
  onHeight: (value: number) => void;
  onDays: (value: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={planStyles.section}>
      <PlanCard>
        <NumberField
          label={t('setup.weight')}
          value={state.weightKg}
          onChange={(value) => onWeight(value ?? NaN)}
          testID="input-weight"
        />
        <HeightField value={state.heightCm} onChange={onHeight} />
      </PlanCard>
      <PlanCard>
        <Text fontSet="onboarding" variant="heading" color={colors.textHi}>
          {t('setup.gymDays')}
        </Text>
        <Text fontSet="onboarding" variant="bodyS" color={colors.textMid}>
          {t(
            ['sedentary', 'light'].includes(state.activityLevel)
              ? 'setup.gentleTraining'
              : 'setup.activeTraining',
          )}
        </Text>
        <CompactSelect
          label={t('setup.gymDays')}
          selected={[state.gymDays]}
          options={Array.from({ length: 8 }, (_, day) => ({
            value: day,
            label: t('setup.daysLabel', { days: day }),
          }))}
          onSelect={onDays}
          testID="gym-days"
        />
        <Text
          fontSet="onboarding"
          variant="bodyS"
          tabular
          accessibilityLiveRegion="polite"
          color={colors.textHi}
        >
          {t('setup.selectedDays', { days: state.gymDays })}
        </Text>
      </PlanCard>
      {Object.keys(state.errors).length > 0 ? (
        <Text fontSet="onboarding" accessibilityRole="alert" color={colors.danger}>
          {t('setup.detailsError')}
        </Text>
      ) : null}
    </View>
  );
}
