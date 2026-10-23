import React from 'react';
import { TouchableOpacity, StyleSheet, View } from 'react-native';
import type { ActivityLevel } from '@calipartner/core';
import { Text, CheckIcon, space, dark, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';

interface ActivityStepProps {
  selectedActivityLevel: ActivityLevel;
  onSelectActivityLevel: (level: ActivityLevel) => void;
}

interface ActivityOption {
  id: ActivityLevel;
  titleKey:
    | 'onboarding.activity.sedentaryTitle'
    | 'onboarding.activity.lightTitle'
    | 'onboarding.activity.moderateTitle'
    | 'onboarding.activity.veryActiveTitle'
    | 'onboarding.activity.extraActiveTitle';
  descKey:
    | 'onboarding.activity.sedentaryDesc'
    | 'onboarding.activity.lightDesc'
    | 'onboarding.activity.moderateDesc'
    | 'onboarding.activity.veryActiveDesc'
    | 'onboarding.activity.extraActiveDesc';
  multiplierKey:
    | 'onboarding.activity.sedentaryMultiplier'
    | 'onboarding.activity.lightMultiplier'
    | 'onboarding.activity.moderateMultiplier'
    | 'onboarding.activity.veryActiveMultiplier'
    | 'onboarding.activity.extraActiveMultiplier';
  defaultTitle: string;
  defaultDesc: string;
  example: string;
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  {
    id: 'sedentary',
    titleKey: 'onboarding.activity.sedentaryTitle',
    descKey: 'onboarding.activity.sedentaryDesc',
    multiplierKey: 'onboarding.activity.sedentaryMultiplier',
    defaultTitle: 'Mostly sitting',
    defaultDesc: 'Desk job, little intentional movement.',
    example: 'desk job, < 5k steps',
  },
  {
    id: 'light',
    titleKey: 'onboarding.activity.lightTitle',
    descKey: 'onboarding.activity.lightDesc',
    multiplierKey: 'onboarding.activity.lightMultiplier',
    defaultTitle: 'Lightly active',
    defaultDesc: 'Light daily walking, 1–2 workouts a week.',
    example: '5k–7k steps, light workouts',
  },
  {
    id: 'moderate',
    titleKey: 'onboarding.activity.moderateTitle',
    descKey: 'onboarding.activity.moderateDesc',
    multiplierKey: 'onboarding.activity.moderateMultiplier',
    defaultTitle: 'Moderately active',
    defaultDesc: 'Active daily routine, workouts 3–5 days a week.',
    example: 'desk job, 8k–10k steps',
  },
  {
    id: 'very_active',
    titleKey: 'onboarding.activity.veryActiveTitle',
    descKey: 'onboarding.activity.veryActiveDesc',
    multiplierKey: 'onboarding.activity.veryActiveMultiplier',
    defaultTitle: 'Very active',
    defaultDesc: 'Active physical job or training 6–7 days a week.',
    example: 'physical work, 12k+ steps',
  },
  {
    id: 'extra_active',
    titleKey: 'onboarding.activity.extraActiveTitle',
    descKey: 'onboarding.activity.extraActiveDesc',
    multiplierKey: 'onboarding.activity.extraActiveMultiplier',
    defaultTitle: 'Extremely active',
    defaultDesc: 'Heavy physical labor or intense twice-daily athletic training.',
    example: 'competitive athlete, hard manual labor',
  },
];

export function ActivityStep({ selectedActivityLevel, onSelectActivityLevel }: ActivityStepProps) {
  return (
    <View style={styles.container} accessible accessibilityRole="radiogroup">
      {ACTIVITY_OPTIONS.map((option) => {
        const isSelected = selectedActivityLevel === option.id;
        const title = t(option.titleKey) || option.defaultTitle;
        const desc = t(option.descKey) || option.defaultDesc;
        const multiplier = t(option.multiplierKey);

        return (
          <TouchableOpacity
            key={option.id}
            testID={`activity-card-${option.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${title}, ${multiplier}. ${desc}`}
            onPress={() => {
              playClickSound();
              onSelectActivityLevel(option.id);
            }}
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
            <View style={styles.headerRow}>
              <View style={styles.titleGroup}>
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected ? dark.apricot : dark.hairlineLit,
                      backgroundColor: isSelected ? dark.apricot : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <CheckIcon size={12} color={dark.onBrand} />}
                </View>
                <Text variant="body" color={dark.textHi} style={styles.title}>
                  {title}
                </Text>
              </View>
            </View>

            <Text variant="bodyS" color={dark.textMid} style={styles.description}>
              {desc}
            </Text>
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
    padding: space[4],
    borderRadius: radius.card,
    minHeight: 88, // Spec A06
    justifyContent: 'center',
    gap: space[1],
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.full,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontWeight: '600',
    flexShrink: 1,
  },
  badgeContainer: {
    paddingHorizontal: space[2],
    paddingVertical: 2,
    borderRadius: radius.control,
    borderWidth: 1,
    borderColor: dark.hairline,
    backgroundColor: dark.s2,
  },
  badgeText: {
    fontWeight: '500',
  },
  description: {
    lineHeight: 20,
    paddingLeft: 32,
  },
});
