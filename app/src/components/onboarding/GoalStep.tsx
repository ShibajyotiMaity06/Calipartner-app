import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import type { Goal } from '@calipartner/core';
import { Text, CheckIcon, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

interface GoalStepProps {
  selectedGoal: Goal;
  onSelectGoal: (goal: Goal) => void;
  onAutoAdvance?: () => void;
}

interface GoalOption {
  id: Goal;
  titleKey:
    'onboarding.goal.cutTitle' | 'onboarding.goal.maintainTitle' | 'onboarding.goal.bulkTitle';
  descKey: 'onboarding.goal.cutDesc' | 'onboarding.goal.maintainDesc' | 'onboarding.goal.bulkDesc';
  defaultTitle: string;
  defaultDesc: string;
}

const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    id: 'cut',
    titleKey: 'onboarding.goal.cutTitle',
    descKey: 'onboarding.goal.cutDesc',
    defaultTitle: 'Lose fat',
    defaultDesc: 'Eat a little less than you burn.',
  },
  {
    id: 'bulk',
    titleKey: 'onboarding.goal.bulkTitle',
    descKey: 'onboarding.goal.bulkDesc',
    defaultTitle: 'Build muscle',
    defaultDesc: 'Eat enough protein and train with intent.',
  },
  {
    id: 'maintain',
    titleKey: 'onboarding.goal.maintainTitle',
    descKey: 'onboarding.goal.maintainDesc',
    defaultTitle: 'Stay where I am',
    defaultDesc: 'Keep your weight and build consistency.',
  },
];

export function GoalStep({ selectedGoal, onSelectGoal, onAutoAdvance }: GoalStepProps) {
  const handleSelect = (goalId: Goal) => {
    playClickSound();
    onSelectGoal(goalId);
    if (onAutoAdvance) {
      setTimeout(() => {
        onAutoAdvance();
      }, 250);
    }
  };

  return (
    <View style={styles.container} accessible accessibilityRole="radiogroup">
      {GOAL_OPTIONS.map((option) => {
        const isSelected = selectedGoal === option.id;
        const title = t(option.titleKey) || option.defaultTitle;
        const desc = t(option.descKey) || option.defaultDesc;

        return (
          <TouchableOpacity
            key={option.id}
            testID={`goal-card-${option.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${title}. ${desc}`}
            onPress={() => handleSelect(option.id)}
            activeOpacity={0.8}
            style={[
              styles.card,
              {
                backgroundColor: isSelected ? dark.s2 : dark.s1,
                borderColor: isSelected ? dark.apricot : dark.hairline,
                borderWidth: isSelected ? 2 : 1,
              },
            ]}
          >
            <View style={styles.contentRow}>
              <View style={styles.textGroup}>
                <Text variant="heading" color={dark.textHi} style={styles.cardTitle}>
                  {title}
                </Text>
                <Text variant="body" color={dark.textMid} style={styles.cardDesc}>
                  {desc}
                </Text>
              </View>

              {/* Radio Indicator with Check when selected */}
              <View
                style={[
                  styles.checkCircle,
                  {
                    borderColor: isSelected ? dark.apricot : dark.hairlineLit,
                    backgroundColor: isSelected ? dark.apricot : 'transparent',
                  },
                ]}
              >
                {isSelected && <CheckIcon size={14} color={dark.onBrand} />}
              </View>
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    gap: space[3],
    paddingTop: space[2],
  },
  card: {
    paddingHorizontal: space[4],
    paddingVertical: space[4],
    borderRadius: radius.card,
    minHeight: 88, // Spec A04: three full-width cards (88 high)
    justifyContent: 'center',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space[3],
  },
  textGroup: {
    flex: 1,
    gap: space[1],
  },
  cardTitle: {
    fontWeight: '600',
  },
  cardDesc: {
    lineHeight: 20,
  },
  checkCircle: {
    width: 24,
    height: 24,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
