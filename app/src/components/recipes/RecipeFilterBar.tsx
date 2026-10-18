import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { RecipeFilterCriteria, RecipeMealType } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeFilterBarProps {
  query: string;
  onQueryChange: (q: string) => void;
  criteria: RecipeFilterCriteria;
  onCriteriaChange: (next: RecipeFilterCriteria) => void;
}

const MEAL_TYPES: { key: RecipeMealType | 'all'; labelKey: string }[] = [
  { key: 'all', labelKey: 'recipes.browse.filterAll' },
  { key: 'breakfast', labelKey: 'recipes.mealTypes.breakfast' },
  { key: 'lunch', labelKey: 'recipes.mealTypes.lunch' },
  { key: 'dinner', labelKey: 'recipes.mealTypes.dinner' },
  { key: 'snack', labelKey: 'recipes.mealTypes.snack' },
];

const DIET_TAGS: { key: string; labelKey: string }[] = [
  { key: 'vegetarian', labelKey: 'recipes.dietTags.vegetarian' },
  { key: 'eggetarian', labelKey: 'recipes.dietTags.eggetarian' },
  { key: 'vegan', labelKey: 'recipes.dietTags.vegan' },
  { key: 'non_vegetarian', labelKey: 'recipes.dietTags.non_vegetarian' },
];

export function RecipeFilterBar({
  query,
  onQueryChange,
  criteria,
  onCriteriaChange,
}: RecipeFilterBarProps) {
  const { colors } = useTheme();

  const isHighProtein = (criteria.min_protein ?? 0) >= 25;
  const isQuick = (criteria.max_time_minutes ?? 999) <= 30;
  const isUnder400 = (criteria.max_calories ?? 9999) <= 400;

  const hasActiveFilters =
    query.trim().length > 0 ||
    Boolean(criteria.meal_type) ||
    Boolean(criteria.diet) ||
    isHighProtein ||
    isQuick ||
    isUnder400;

  const handleClearFilters = () => {
    onQueryChange('');
    onCriteriaChange({});
  };

  const handleMealTypeSelect = (mt: RecipeMealType | 'all') => {
    onCriteriaChange({
      ...criteria,
      meal_type: mt === 'all' ? undefined : mt,
    });
  };

  const handleDietTagToggle = (tag: string) => {
    onCriteriaChange({
      ...criteria,
      diet: criteria.diet === tag ? undefined : tag,
    });
  };

  const handleToggleHighProtein = () => {
    onCriteriaChange({
      ...criteria,
      min_protein: isHighProtein ? undefined : 25,
    });
  };

  const handleToggleQuick = () => {
    onCriteriaChange({
      ...criteria,
      max_time_minutes: isQuick ? undefined : 30,
    });
  };

  const handleToggleUnder400 = () => {
    onCriteriaChange({
      ...criteria,
      max_calories: isUnder400 ? undefined : 400,
    });
  };

  return (
    <View style={styles.container}>
      {/* Search Input Box */}
      <View
        style={[
          styles.searchBox,
          {
            backgroundColor: colors.surfaceAlt,
            borderColor: colors.border,
          },
        ]}
      >
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          testID="input-recipe-search"
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('recipes.browse.searchPlaceholder')}
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          accessibilityLabel={t('recipes.browse.searchPlaceholder')}
          style={[styles.searchInput, { color: colors.text }]}
        />
        {query.length > 0 && (
          <Pressable
            testID="btn-clear-recipe-search"
            onPress={() => onQueryChange('')}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            accessibilityRole="button"
            accessibilityLabel="Clear recipe search"
          >
            <Ionicons name="close-circle" size={18} color={colors.textMuted} />
          </Pressable>
        )}
      </View>

      {/* Horizontal Scroll of Filter Chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsScroll}
      >
        {/* Clear Filters Button if active */}
        {hasActiveFilters && (
          <Pressable
            testID="btn-clear-filters"
            onPress={handleClearFilters}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.browse.clearFilters')}
            style={[
              styles.chip,
              {
                backgroundColor: colors.surfaceAlt,
                borderColor: colors.danger,
              },
            ]}
          >
            <Ionicons name="close" size={12} color={colors.danger} />
            <Text style={[styles.chipText, { color: colors.danger, fontWeight: '700' }]}>
              {t('recipes.browse.clearFilters')}
            </Text>
          </Pressable>
        )}

        {/* Meal Type Chips */}
        {MEAL_TYPES.map(({ key, labelKey }) => {
          const isActive = key === 'all' ? !criteria.meal_type : criteria.meal_type === key;
          return (
            <Pressable
              key={`meal-${key}`}
              testID={`filter-chip-meal-${key}`}
              onPress={() => handleMealTypeSelect(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.accent : colors.surface,
                  borderColor: isActive ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isActive ? colors.onAccent : colors.text,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {t(labelKey as Parameters<typeof t>[0])}
              </Text>
            </Pressable>
          );
        })}

        {/* Quick High Protein Filter */}
        <Pressable
          testID="filter-chip-high-protein"
          onPress={handleToggleHighProtein}
          accessibilityRole="button"
          accessibilityState={{ selected: isHighProtein }}
          style={[
            styles.chip,
            {
              backgroundColor: isHighProtein ? colors.accent : colors.surface,
              borderColor: isHighProtein ? colors.accent : colors.border,
            },
          ]}
        >
          <Ionicons
            name="barbell-outline"
            size={12}
            color={isHighProtein ? colors.onAccent : colors.text}
          />
          <Text
            style={[
              styles.chipText,
              {
                color: isHighProtein ? colors.onAccent : colors.text,
                fontWeight: isHighProtein ? '700' : '500',
              },
            ]}
          >
            {t('recipes.browse.filterHighProtein')}
          </Text>
        </Pressable>

        {/* Quick (<30m) Filter */}
        <Pressable
          testID="filter-chip-quick"
          onPress={handleToggleQuick}
          accessibilityRole="button"
          accessibilityState={{ selected: isQuick }}
          style={[
            styles.chip,
            {
              backgroundColor: isQuick ? colors.accent : colors.surface,
              borderColor: isQuick ? colors.accent : colors.border,
            },
          ]}
        >
          <Ionicons name="time-outline" size={12} color={isQuick ? colors.onAccent : colors.text} />
          <Text
            style={[
              styles.chipText,
              {
                color: isQuick ? colors.onAccent : colors.text,
                fontWeight: isQuick ? '700' : '500',
              },
            ]}
          >
            {t('recipes.browse.filterQuick')}
          </Text>
        </Pressable>

        {/* Under 400 kcal Filter */}
        <Pressable
          testID="filter-chip-under-400"
          onPress={handleToggleUnder400}
          accessibilityRole="button"
          accessibilityState={{ selected: isUnder400 }}
          style={[
            styles.chip,
            {
              backgroundColor: isUnder400 ? colors.accent : colors.surface,
              borderColor: isUnder400 ? colors.accent : colors.border,
            },
          ]}
        >
          <Ionicons
            name="flame-outline"
            size={12}
            color={isUnder400 ? colors.onAccent : colors.text}
          />
          <Text
            style={[
              styles.chipText,
              {
                color: isUnder400 ? colors.onAccent : colors.text,
                fontWeight: isUnder400 ? '700' : '500',
              },
            ]}
          >
            {t('recipes.browse.filterUnder400')}
          </Text>
        </Pressable>

        {/* Diet Tag Chips */}
        {DIET_TAGS.map(({ key, labelKey }) => {
          const isActive = criteria.diet === key;
          return (
            <Pressable
              key={`diet-${key}`}
              testID={`filter-chip-diet-${key}`}
              onPress={() => handleDietTagToggle(key)}
              accessibilityRole="button"
              accessibilityState={{ selected: isActive }}
              style={[
                styles.chip,
                {
                  backgroundColor: isActive ? colors.accent : colors.surface,
                  borderColor: isActive ? colors.accent : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.chipText,
                  {
                    color: isActive ? colors.onAccent : colors.text,
                    fontWeight: isActive ? '700' : '500',
                  },
                ]}
              >
                {t(labelKey as Parameters<typeof t>[0])}
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
