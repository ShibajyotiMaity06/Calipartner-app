import React from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import type { ActivityLevel } from '@calipartner/core';
import { useTheme } from '@calipartner/ui';
import {
  Text,
  borders,
  colors,
  radius,
  space,
  triggerHaptic,
  usePressScale,
} from '@calipartner/ui/v1';
import { t } from '@/i18n';

interface ActivityOption {
  value: Exclude<ActivityLevel, 'extra_active'>;
  titleKey:
    | 'onboardingV1.sedentaryTitle'
    | 'onboardingV1.lightTitle'
    | 'onboardingV1.moderateTitle'
    | 'onboardingV1.veryActiveTitle';
  descKey:
    | 'onboardingV1.sedentaryDesc'
    | 'onboardingV1.lightDesc'
    | 'onboardingV1.moderateDesc'
    | 'onboardingV1.veryActiveDesc';
  bars: 1 | 2 | 3 | 4;
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  {
    value: 'sedentary',
    titleKey: 'onboardingV1.sedentaryTitle',
    descKey: 'onboardingV1.sedentaryDesc',
    bars: 1,
  },
  {
    value: 'light',
    titleKey: 'onboardingV1.lightTitle',
    descKey: 'onboardingV1.lightDesc',
    bars: 2,
  },
  {
    value: 'moderate',
    titleKey: 'onboardingV1.moderateTitle',
    descKey: 'onboardingV1.moderateDesc',
    bars: 3,
  },
  {
    value: 'very_active',
    titleKey: 'onboardingV1.veryActiveTitle',
    descKey: 'onboardingV1.veryActiveDesc',
    bars: 4,
  },
];

const BAR_HEIGHTS = [7, 11, 15, 19] as const;

function ActivitySignalBars({ activeBars }: { activeBars: 1 | 2 | 3 | 4 }) {
  return (
    <View style={styles.barsRow} accessible={false}>
      {BAR_HEIGHTS.map((height, index) => (
        <View
          key={height}
          style={[
            styles.bar,
            {
              height,
              backgroundColor: index < activeBars ? colors.apricot : colors.s3,
            },
          ]}
        />
      ))}
    </View>
  );
}

function ActivityOptionCard({
  option,
  selected,
  onPress,
}: {
  option: ActivityOption;
  selected: boolean;
  onPress: () => void;
}) {
  const { reduceMotion } = useTheme();
  const { scale, onPressIn, onPressOut } = usePressScale(reduceMotion);
  const title = t(option.titleKey);
  const desc = t(option.descKey);

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
        accessibilityLabel={`${title}. ${desc}`}
        testID={`activity-card-${option.value}`}
        style={[styles.card, selected ? styles.cardSelected : styles.cardDefault]}
      >
        <View style={styles.textCol}>
          <Text variant="rowTitle" color="textHi" style={styles.titleText}>
            {title}
          </Text>
          <Text variant="meta" color="textLo" style={styles.descText}>
            {desc}
          </Text>
        </View>
        <ActivitySignalBars activeBars={option.bars} />
      </Pressable>
    </Animated.View>
  );
}

export function ActivityStep({
  selectedActivityLevel,
  onSelectActivityLevel,
}: {
  selectedActivityLevel: ActivityLevel;
  onSelectActivityLevel: (level: ActivityLevel) => void;
}) {
  const activeValue =
    selectedActivityLevel === 'extra_active' ? 'very_active' : selectedActivityLevel;

  return (
    <View style={styles.list} accessibilityRole="radiogroup" testID="activity-level">
      {ACTIVITY_OPTIONS.map((option) => (
        <ActivityOptionCard
          key={option.value}
          option={option}
          selected={activeValue === option.value}
          onPress={() => onSelectActivityLevel(option.value)}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    gap: space.md,
  },
  card: {
    borderRadius: radius.optionCard,
    paddingVertical: space.lg,
    paddingHorizontal: space.xl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
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
  textCol: {
    flex: 1,
    gap: 2,
  },
  titleText: {
    fontSize: 16,
    lineHeight: 20,
  },
  descText: {
    fontSize: 13,
    lineHeight: 18,
  },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 3,
    paddingVertical: space.xs,
  },
  bar: {
    width: 4,
    borderRadius: radius.bar,
  },
});
