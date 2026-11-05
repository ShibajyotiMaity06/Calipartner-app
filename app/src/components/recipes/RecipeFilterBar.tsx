import React from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text, homeLayout, type as inputTypography } from '@calipartner/ui';
import type { RecipeFilterCriteria } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  criteria: RecipeFilterCriteria;
  onCriteriaChange: (next: RecipeFilterCriteria) => void;
}
export function RecipeFilterBar({
  query,
  onQueryChange,
  criteria,
  onCriteriaChange,
}: RecipeFilterBarProps) {
  const { colors } = useTheme();
  return (
    <View style={styles.container}>
      <View
        style={[
          styles.searchBox,
          { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
        ]}
      >
        <Ionicons name="search" size={homeLayout.iconSize} color={colors.textMuted} />
        <TextInput
          testID="input-recipe-search"
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('recipes.browse.searchPlaceholder')}
          accessibilityLabel={t('recipes.browse.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          style={[
            styles.searchInput,
            { color: colors.text, fontFamily: inputTypography.body.fontFamily },
          ]}
        />
        {query.length > 0 && (
          <Pressable
            testID="btn-clear-recipe-search"
            onPress={() => onQueryChange('')}
            accessibilityRole="button"
            accessibilityLabel={t('homeRefresh.clearSearch')}
            style={{
              minWidth: homeLayout.touchSize,
              minHeight: homeLayout.touchSize,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Ionicons name="close" size={homeLayout.iconSize} color={colors.textMuted} />
          </Pressable>
        )}
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {(['high-protein', 'high-carb', 'indian'] as const).map((filter) => {
          const selected =
            filter === 'indian'
              ? criteria.cuisine_group === 'indian'
              : criteria.nutrition_focus === filter;
          return (
            <Pressable
              key={filter}
              testID={'recipe-filter-' + filter}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() =>
                onCriteriaChange({
                  nutrition_focus:
                    filter === 'indian' ? criteria.nutrition_focus : selected ? undefined : filter,
                  cuisine_group:
                    filter === 'indian'
                      ? selected
                        ? undefined
                        : 'indian'
                      : criteria.cuisine_group,
                })
              }
              style={[
                styles.chip,
                {
                  backgroundColor: selected ? colors.surfaceAlt : colors.surface,
                  borderColor: selected ? colors.copper : colors.border,
                },
              ]}
            >
              <Text
                nutrient={
                  filter === 'high-protein'
                    ? 'protein'
                    : filter === 'high-carb'
                      ? 'carbs'
                      : undefined
                }
                variant="label"
                color={selected ? colors.accent : colors.text}
              >
                {t(
                  filter === 'high-protein'
                    ? 'homeRefresh.highProtein'
                    : filter === 'high-carb'
                      ? 'homeRefresh.highCarb'
                      : 'fastingRefresh.indian',
                )}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
    paddingVertical: spacing.xs,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radius.md,
    paddingHorizontal: 12,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 8,
    fontSize: fontSize.sm,
  },
  chipsScroll: {
    flexDirection: 'row',
    gap: 6,
    paddingVertical: 4,
    alignItems: 'center',
  },
  chip: {
    minHeight: homeLayout.touchSize,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  chipText: {
    fontSize: fontSize.xs,
  },
});
