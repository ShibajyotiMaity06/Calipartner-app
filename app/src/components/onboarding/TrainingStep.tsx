import React from 'react';
import { Pressable, View } from 'react-native';
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
        <View style={planStyles.row} accessibilityRole="radiogroup">
          {Array.from({ length: 8 }, (_, day) => (
            <Pressable
              key={day}
              accessibilityRole="radio"
              accessibilityState={{ selected: day === state.gymDays }}
              accessibilityLabel={t('setup.daysLabel', { days: day })}
              testID={`gym-days-${day}`}
              onPress={() => onDays(day)}
              style={({ pressed }) => [
                planStyles.radio,
                {
                  borderColor: day === state.gymDays ? colors.cream : colors.hairlineLit,
                  backgroundColor:
                    day === state.gymDays ? colors.cream : pressed ? colors.s3 : colors.s2,
                },
              ]}
            >
              <Text
                fontSet="onboarding"
                tabular
                color={day === state.gymDays ? colors.onBrand : colors.textHi}
                maxFontSizeMultiplier={2}
              >
                {day}
              </Text>
            </Pressable>
          ))}
        </View>
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
