import React, { type ComponentProps } from 'react';
import { View } from 'react-native';
import type { Goal } from '@calipartner/core';
import type { Ionicons } from '@expo/vector-icons';
import type { SelectedGoal } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';
import { PlanChoice, planStyles } from './PlanPrimitives';

interface GoalStepProps {
  selectedGoal: Goal | null;
  onSelectGoal: (goal: SelectedGoal) => void;
}

const GOAL_ICONS: Record<SelectedGoal, ComponentProps<typeof Ionicons>['name']> = {
  bulk: 'barbell-outline',
  cut: 'flame-outline',
};

export function GoalStep({ selectedGoal, onSelectGoal }: GoalStepProps) {
  return (
    <View style={planStyles.section} accessibilityRole="radiogroup">
      {(['bulk', 'cut'] as const).map((goal) => (
        <PlanChoice
          key={goal}
          icon={GOAL_ICONS[goal]}
          title={t(`socialUpdate.${goal}`)}
          description={t(`onboarding.goal.${goal}Desc`)}
          selected={selectedGoal === goal}
          onPress={() => onSelectGoal(goal)}
          testID={`goal-card-${goal}`}
        />
      ))}
    </View>
  );
}
