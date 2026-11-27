import { Text, borders, colors, radius, space } from '@calipartner/ui/v1';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { t } from '@/i18n';

export interface CoachSuggestedPromptsProps {
  onSelectPrompt: (promptText: string) => void;
  disabled?: boolean;
  quickReplies?: string[];
}

export function CoachSuggestedPrompts({
  onSelectPrompt,
  disabled = false,
  quickReplies,
}: CoachSuggestedPromptsProps) {
  const items =
    quickReplies && quickReplies.length > 0
      ? quickReplies.map((text, idx) => ({
          id: `reply-${idx}`,
          text,
          testID: `chip-quick-reply-${idx}`,
        }))
      : [
          { id: 'meal', text: t('coach.meal.prompt'), testID: 'chip-prompt-meal' },
          { id: 'week', text: t('coach.prompts.week'), testID: 'chip-prompt-week' },
          { id: 'protein', text: t('coach.prompts.protein'), testID: 'chip-prompt-protein' },
          { id: 'target', text: t('coach.prompts.target'), testID: 'chip-prompt-target' },
        ];

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {items.map((item) => (
          <Pressable
            key={item.id}
            testID={item.testID}
            onPress={() => !disabled && onSelectPrompt(item.text)}
            accessibilityRole="button"
            accessibilityLabel={item.text}
            disabled={disabled}
            style={({ pressed }) => [
              styles.chip,
              pressed && !disabled ? styles.chipPressed : null,
              disabled ? styles.chipDisabled : null,
            ]}
          >
            <Text variant="meta" color="textHi">
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
    paddingTop: space.xs,
    paddingBottom: space.xs,
  },
  scrollContent: {
    paddingHorizontal: space.lg,
    gap: space.sm,
  },
  chip: {
    minHeight: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  chipPressed: {
    backgroundColor: colors.s2,
  },
  chipDisabled: {
    opacity: 0.45,
  },
});
