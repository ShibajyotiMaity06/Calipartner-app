import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ActivityLevel } from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

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
}

const ACTIVITY_OPTIONS: readonly ActivityOption[] = [
  {
    id: 'sedentary',
    titleKey: 'onboarding.activity.sedentaryTitle',
    descKey: 'onboarding.activity.sedentaryDesc',
    multiplierKey: 'onboarding.activity.sedentaryMultiplier',
  },
  {
    id: 'light',
    titleKey: 'onboarding.activity.lightTitle',
    descKey: 'onboarding.activity.lightDesc',
    multiplierKey: 'onboarding.activity.lightMultiplier',
  },
  {
    id: 'moderate',
    titleKey: 'onboarding.activity.moderateTitle',
    descKey: 'onboarding.activity.moderateDesc',
    multiplierKey: 'onboarding.activity.moderateMultiplier',
  },
  {
    id: 'very_active',
    titleKey: 'onboarding.activity.veryActiveTitle',
    descKey: 'onboarding.activity.veryActiveDesc',
    multiplierKey: 'onboarding.activity.veryActiveMultiplier',
  },
  {
    id: 'extra_active',
    titleKey: 'onboarding.activity.extraActiveTitle',
    descKey: 'onboarding.activity.extraActiveDesc',
    multiplierKey: 'onboarding.activity.extraActiveMultiplier',
  },
];

export function ActivityStep({
  selectedActivityLevel,
  onSelectActivityLevel,
}: ActivityStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessible accessibilityRole="radiogroup">
      {ACTIVITY_OPTIONS.map((option) => {
        const isSelected = selectedActivityLevel === option.id;
        return (
          <Pressable
            key={option.id}
            testID={`activity-card-${option.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${t(option.titleKey)}, ${t(option.multiplierKey)}. ${t(option.descKey)}`}
            onPress={() => {
              playClickSound();
              onSelectActivityLevel(option.id);
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: isSelected ? colors.accent : colors.border,
                borderWidth: isSelected ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.headerRow}>
              <View style={styles.titleGroup}>
                <View
                  style={[
                    styles.radioCircle,
                    {
                      borderColor: isSelected ? colors.accent : colors.border,
                      backgroundColor: isSelected ? colors.accent : 'transparent',
                    },
                  ]}
                >
                  {isSelected && <View style={[styles.radioDot, { backgroundColor: colors.onAccent }]} />}
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                  {t(option.titleKey)}
                </Text>
              </View>

              <View
                style={[
                  styles.badgeContainer,
                  {
                    backgroundColor: colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                  {t(option.multiplierKey)}
                </Text>
              </View>
            </View>

            <Text style={[styles.description, { color: colors.textMuted }]}>
              {t(option.descKey)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 88,
    justifyContent: 'center',
    gap: spacing.xs,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: radius.pill,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioDot: {
    width: 8,
    height: 8,
    borderRadius: radius.pill,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '600',
    flexShrink: 1,
  },
  badgeContainer: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  badgeText: {
    fontSize: fontSize.sm - 2,
    fontWeight: '600',
  },
  description: {
    fontSize: fontSize.sm,
    lineHeight: 19,
    paddingLeft: 28,
  },
});
