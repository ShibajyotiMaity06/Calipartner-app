import { CompactSelect, type CompactSelectOption } from '@/components/CompactSelect';
import React, { type ComponentProps } from 'react';
import { View } from 'react-native';
import type { Ionicons } from '@expo/vector-icons';
import type { OnboardingState } from '@/services/onboardingStateMachine';
import { Text, useTheme } from '@calipartner/ui';
import { t } from '@/i18n';
import { PlanCard, planStyles } from './PlanPrimitives';
import { BodyStatsStep } from './BodyStatsStep';

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
  onBodyStats,
  onUnits,
  onHeightUnits,
  onNickname,
  identityConfirmed = false,
}: {
  state: OnboardingState;
  onWeight: (value: number) => void;
  onHeight: (value: number) => void;
  onDays: (value: number) => void;
  onBodyStats: (value: { sex?: OnboardingState['sex']; dateOfBirth?: string }) => void;
  onUnits: (value: OnboardingState['units']) => void;
  onHeightUnits: (value: OnboardingState['heightUnits']) => void;
  onNickname: (value: string) => void;
  identityConfirmed?: boolean;
}) {
  const { colors } = useTheme();
  const dayOptions: CompactSelectOption<number>[] = Array.from({ length: 8 }, (_, day) => ({
    value: day,
    label: t('setup.daysLabel', { days: day }),
    icon: DAY_ICONS[day] ?? 'calendar-outline',
  }));

  return (
    <View style={planStyles.section}>
      <BodyStatsStep
        {...state}
        identityConfirmed={identityConfirmed}
        onChangeUnits={onUnits}
        onChangeHeightUnits={onHeightUnits}
        onChangeNickname={onNickname}
        onChangeSex={(sex) => onBodyStats({ sex })}
        onChangeDateOfBirth={(dateOfBirth) => onBodyStats({ dateOfBirth })}
        onChangeHeightCm={onHeight}
        onChangeWeightKg={onWeight}
        onChangeBodyFat={() => {}}
        errorDateOfBirth={state.errors.dateOfBirth ? t('profileSetup.under18Error') : undefined}
      />
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
