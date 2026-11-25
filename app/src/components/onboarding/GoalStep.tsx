import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { Goal } from '@calipartner/core';
import { useTheme } from '@calipartner/ui';
import {
  DumbbellIcon,
  FlameIcon,
  Radio,
  Text,
  borders,
  colors,
  radius,
  space,
  triggerHaptic,
  usePressScale,
} from '@calipartner/ui/v1';
import type { SelectedGoal } from '@/services/onboardingStateMachine';
import { t } from '@/i18n';

interface GoalStepProps {
  selectedGoal: Goal | null;
  onSelectGoal: (goal: SelectedGoal) => void;
}

const GOALS: readonly SelectedGoal[] = ['cut', 'bulk'];

function GoalOptionCard({
  goal,
  selected,
  onPress,
}: {
  goal: SelectedGoal;
  selected: boolean;
  onPress: () => void;
}) {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const title = t(`onboardingV1.${goal}Title`);
  const tag = t(`onboardingV1.${goal}Tag`);
  const description = t(`onboardingV1.${goal}Desc`);
  const iconColor = selected ? colors.apricot : colors.textMid;

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPress={() => {
          triggerHaptic('selection');
          onPress();
        }}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        accessibilityRole="radio"
        accessibilityState={{ selected }}
        accessibilityLabel={`${title} · ${tag}. ${description}`}
        testID={`goal-card-${goal}`}
        style={[styles.card, selected ? styles.cardSelected : styles.cardDefault]}
      >
        <View style={styles.topRow}>
          <View style={[styles.iconTile, { backgroundColor: selected ? colors.s3 : colors.s2 }]}>
            {goal === 'cut' ? (
              <FlameIcon size={20} color={iconColor} />
            ) : (
              <DumbbellIcon size={20} color={iconColor} />
            )}
          </View>
          <Radio selected={selected} />
        </View>

        <View style={styles.titleRow}>
          <Text variant="titleS" color="textHi">
            {title}
          </Text>
          <Text variant="titleS" color="textLo">
            {` · ${tag}`}
          </Text>
        </View>

        <Text variant="meta" color="textLo" style={styles.description}>
          {description}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function GoalStep({ selectedGoal, onSelectGoal }: GoalStepProps) {
  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {GOALS.map((goal) => (
        <GoalOptionCard
          key={goal}
          goal={goal}
          selected={selectedGoal === goal}
          onPress={() => onSelectGoal(goal)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.optical14,
  },
  card: {
    borderRadius: radius.optionCard,
    padding: space.xl,
  },
  cardDefault: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  cardSelected: {
    backgroundColor: colors.s2,
    borderWidth: borders.selectedWidth,
    borderColor: colors.apricot,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconTile: {
    width: 44,
    height: 44,
    borderRadius: radius.iconTile,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleRow: {
    marginTop: space.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
    flexWrap: 'wrap',
  },
  description: {
    marginTop: space.sm,
    fontSize: 14,
    lineHeight: 20,
  },
});
