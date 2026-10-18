import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface CoachSuggestedPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
}

export function CoachSuggestedPrompts({
  onSelectPrompt,
  disabled = false,
}: CoachSuggestedPromptsProps) {
  const { colors } = useTheme();

  const prompts = [
    {
      id: 'week',
      text: t('coach.prompts.week'),
      icon: 'trending-up-outline' as const,
      testID: 'chip-prompt-week',
    },
    {
      id: 'protein',
      text: t('coach.prompts.protein'),
      icon: 'restaurant-outline' as const,
      testID: 'chip-prompt-protein',
    },
    {
      id: 'target',
      text: t('coach.prompts.target'),
      icon: 'calculator-outline' as const,
      testID: 'chip-prompt-target',
    },
  ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {prompts.map((item) => (
          <Pressable
            key={item.id}
            testID={item.testID}
            onPress={() => !disabled && onSelectPrompt(item.text)}
            accessibilityRole="button"
            accessibilityLabel={item.text}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              {
                backgroundColor: colors.surface,
                borderColor: colors.border,
                opacity: disabled ? 0.5 : pressed ? 0.75 : 1,
              },
            ]}
          >
            <Ionicons name={item.icon} size={14} color={colors.accent} />
            <Text style={[styles.chipText, { color: colors.text }]} numberOfLines={1}>
              {item.text}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingVertical: spacing.xs,
  },
  scrollContent: {
    paddingHorizontal: spacing.md,
    gap: spacing.xs + 2,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.xs + 1,
    fontWeight: '500',
  },
});
