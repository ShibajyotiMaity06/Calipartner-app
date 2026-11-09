import { CompactSelect, type CompactSelectOption } from '@/components/CompactSelect';
import React, { type ComponentProps } from 'react';
import { View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { NumberField, PlanCard, planStyles } from './PlanPrimitives';
import { HeightField } from './HeightField';

const DAY_ICONS: ComponentProps<typeof Ionicons>['name'][] = [
  'bed-outline',
  'walk-outline',
  'walk-outline',
  'fitness-outline',
  'fitness-outline',
  'barbell-outline',
  'barbell-outline',
  'flame-outline',
];

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
  const dayOptions: CompactSelectOption<number>[] = Array.from({ length: 8 }, (_, day) => ({
    value: day,
    label: t('setup.daysLabel', { days: day }),
    icon: DAY_ICONS[day] ?? 'calendar-outline',
  }));

  return (
    <View style={planStyles.section}>
      <PlanCard>
        <NumberField
          label={t('setup.weight')}
          icon="scale-outline"
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
          icon="calendar-outline"
          selected={[state.gymDays]}
          options={dayOptions}
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
