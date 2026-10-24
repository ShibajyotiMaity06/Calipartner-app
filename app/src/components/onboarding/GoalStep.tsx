import React from 'react';
import { View } from 'react-native';
import type { Goal } from '@calipartner/core';
import { t } from '@/i18n';
import { PlanChoice, planStyles } from './PlanPrimitives';

interface GoalStepProps {
  selectedGoal: Goal;
  onSelectGoal: (goal: Goal) => void;
  onAutoAdvance?: () => void;
}
export function GoalStep({ selectedGoal, onSelectGoal }: GoalStepProps) {
  return (
    <View style={planStyles.section} accessibilityRole="radiogroup">
      {(['bulk', 'cut', 'maintain'] as const).map((goal) => (
        <PlanChoice
          key={goal}
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
