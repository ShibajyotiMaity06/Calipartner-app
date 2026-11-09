import React, { type ComponentProps } from 'react';
import { View } from 'react-native';
import type { Goal } from '@calipartner/core';
import type { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { PlanChoice, planStyles } from './PlanPrimitives';

interface GoalStepProps {
  selectedGoal: Goal;
  onSelectGoal: (goal: Goal) => void;
  onAutoAdvance?: () => void;
}

const GOAL_ICONS: Record<Goal, ComponentProps<typeof Ionicons>['name']> = {
  bulk: 'barbell-outline',
  cut: 'flame-outline',
  maintain: 'shield-checkmark-outline',
};

export function GoalStep({ selectedGoal, onSelectGoal }: GoalStepProps) {
  return (
    <View style={planStyles.section} accessibilityRole="radiogroup">
      {(['bulk', 'cut', 'maintain'] as const).map((goal) => (
        <PlanChoice
          key={goal}
          icon={GOAL_ICONS[goal]}
          title={t(`onboarding.goal.${goal}Title`)}
          description={t(`onboarding.goal.${goal}Desc`)}
          selected={selectedGoal === goal}
          onPress={() => onSelectGoal(goal)}
          testID={`goal-card-${goal}`}
        />
      ))}
    </View>
  );
}
