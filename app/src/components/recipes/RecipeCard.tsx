import { NutrientSummary } from '../diary/NutrientSummary';
import React from 'react';
import { Image, Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { homeLayout, radius, space, Text } from '@calipartner/ui';
import type { Recipe } from '@calipartner/core';
import { t } from '@/i18n';
import { useTheme } from '@/theme/useTheme';

export interface RecipeCardProps {
  recipe: Recipe;
  locked?: boolean;
  disabled?: boolean;
  onPress: (recipe: Recipe) => void;
  onToggleFavorite?: (recipe: Recipe) => void;
  testID?: string;
}
export function RecipeCard({
  recipe,
  locked = false,
  disabled = false,
  onPress,
  onToggleFavorite,
  testID,
}: RecipeCardProps) {
  const { colors } = useTheme();
  const minutes = recipe.prep_minutes + recipe.cook_minutes;
  const nutrition = recipe.nutrition_per_serving;
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {recipe.image_urls[0] && (
        <Image
          source={{ uri: recipe.image_urls[0] }}
          style={styles.image}
          accessibilityIgnoresInvertColors
        />
      )}
      <View style={styles.row}>
        <Pressable
          onPress={() => onPress(recipe)}
          testID={testID ?? `recipe-card-${recipe.id}`}
          accessibilityRole="button"
          disabled={disabled}
          accessibilityState={{ disabled }}
          accessibilityLabel={t('homeRefresh.recipeLabel', {
            name: recipe.title,
            region: recipe.cuisine,
            minutes,
            calories: nutrition.calories,
            protein: nutrition.protein,
          })}
          style={styles.info}
        >
          <Text variant="micro" color={colors.textMuted}>
            {recipe.cuisine} · {t('recipes.card.time', { mins: minutes })}
          </Text>
          <Text variant="heading" color={colors.text}>
            {recipe.title}
          </Text>
          <NutrientSummary values={nutrition} />
          {recipe.source_portion && (
            <Text variant="micro" color={colors.textMuted}>
              {t('homeRefresh.sourcePortion', { portion: recipe.source_portion })}
            </Text>
          )}
          <Text variant="micro" color={colors.textMuted}>
            {recipe.diet_tags
              .map((tag) =>
                t(`recipes.dietTags.${tag.replaceAll('-', '_')}` as Parameters<typeof t>[0]),
              )
              .join(' · ')}
          </Text>
          {locked && (
            <Text variant="micro" color={colors.textMuted} testID={`recipe-lock-${recipe.id}`}>
              {t('brandRepair.plusRequired')}
            </Text>
          )}
        </Pressable>
        {onToggleFavorite && (
          <Pressable
            onPress={() => onToggleFavorite(recipe)}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.card.favoriteLabel', { title: recipe.title })}
            accessibilityState={{ selected: Boolean(recipe.is_favorite) }}
            disabled={disabled}
            testID={`btn-recipe-fav-${recipe.id}`}
            style={styles.favorite}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={homeLayout.iconSize}
              color={colors.text}
            />
          </Pressable>
        )}
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: radius.card, overflow: 'hidden', marginBottom: space[3] },
  image: { width: '100%', height: homeLayout.ringSize },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: space[2], padding: space[4] },
  info: { flex: 1, gap: space[2], minHeight: homeLayout.touchSize },
  favorite: {
    width: homeLayout.touchSize,
    height: homeLayout.touchSize,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
