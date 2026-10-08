import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { Goal } from '@calipartner/core';
import { t } from '@/i18n';
import { playClickSound } from '@/lib/sound';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

interface GoalStepProps {
  selectedGoal: Goal;
  onSelectGoal: (goal: Goal) => void;
}

interface GoalOption {
  id: Goal;
  titleKey: 'onboarding.goal.cutTitle' | 'onboarding.goal.maintainTitle' | 'onboarding.goal.bulkTitle';
  descKey: 'onboarding.goal.cutDesc' | 'onboarding.goal.maintainDesc' | 'onboarding.goal.bulkDesc';
  badge: string;
}

const GOAL_OPTIONS: readonly GoalOption[] = [
  {
    id: 'cut',
    titleKey: 'onboarding.goal.cutTitle',
    descKey: 'onboarding.goal.cutDesc',
    badge: '- Deficit',
  },
  {
    id: 'maintain',
    titleKey: 'onboarding.goal.maintainTitle',
    descKey: 'onboarding.goal.maintainDesc',
    badge: 'Baseline',
  },
  {
    id: 'bulk',
    titleKey: 'onboarding.goal.bulkTitle',
    descKey: 'onboarding.goal.bulkDesc',
    badge: '+ Surplus',
  },
];

export function GoalStep({ selectedGoal, onSelectGoal }: GoalStepProps) {
  const { colors } = useTheme();

  return (
    <View style={styles.container} accessible accessibilityRole="radiogroup">
      {GOAL_OPTIONS.map((option) => {
        const isSelected = selectedGoal === option.id;
        return (
          <Pressable
            key={option.id}
            testID={`goal-card-${option.id}`}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
            accessibilityLabel={`${t(option.titleKey)}. ${t(option.descKey)}`}
            onPress={() => {
              playClickSound();
              onSelectGoal(option.id);
            }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: isSelected ? colors.surface : colors.surface,
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
                    backgroundColor: isSelected ? colors.surfaceAlt : colors.surfaceAlt,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.textMuted }]}>
                  {option.badge}
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
    gap: spacing.md,
  },
  card: {
    padding: spacing.md,
    borderRadius: radius.md,
    minHeight: 96,
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
    width: 22,
    height: 22,
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
    lineHeight: 20,
    paddingLeft: 30,
  },
});
