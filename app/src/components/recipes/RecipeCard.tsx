import React from 'react';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { Recipe } from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface RecipeCardProps {
  recipe: Recipe;
  onPress: (recipe: Recipe) => void;
  onToggleFavorite?: (recipe: Recipe) => void;
  testID?: string;
}

export function RecipeCard({ recipe, onPress, onToggleFavorite, testID }: RecipeCardProps) {
  const { colors } = useTheme();

  const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  const heroImage = recipe.image_urls?.[0];
  const nutrition = recipe.nutrition_per_serving;

  const dietTagLabel = recipe.diet_tags?.[0]
    ? t(`recipes.dietTags.${recipe.diet_tags[0]}` as Parameters<typeof t>[0])
    : null;

  return (
    <Pressable
      testID={testID ?? `recipe-card-${recipe.id}`}
      onPress={() => onPress(recipe)}
      accessibilityRole="button"
      accessibilityLabel={`${recipe.title}, ${recipe.cuisine}, ${totalMinutes} minutes, ${nutrition.calories} calories, ${nutrition.protein} grams of protein`}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.92 : 1,
        },
      ]}
    >
      {/* Recipe Photo / Hero area */}
      <View style={[styles.imageWrap, { backgroundColor: colors.surfaceAlt }]}>
        {heroImage ? (
          <Image
            source={{ uri: heroImage }}
            style={styles.image}
            resizeMode="cover"
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.imagePlaceholder, { backgroundColor: colors.surfaceAlt }]}>
            <Ionicons name="restaurant-outline" size={36} color={colors.textMuted} />
          </View>
        )}

        {/* Favorite heart toggle button */}
        {onToggleFavorite && (
          <Pressable
            testID={`btn-recipe-fav-${recipe.id}`}
            onPress={(e) => {
              e.stopPropagation?.();
              onToggleFavorite(recipe);
            }}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.card.favoriteLabel', { title: recipe.title })}
            style={[styles.favoriteBtn, { backgroundColor: 'rgba(0,0,0,0.45)' }]}
          >
            <Ionicons
              name={recipe.is_favorite ? 'heart' : 'heart-outline'}
              size={18}
              color={recipe.is_favorite ? '#EF4444' : '#FFFFFF'}
            />
          </Pressable>
        )}

        {/* Diet tag chip */}
        {dietTagLabel && (
          <View style={[styles.dietChip, { backgroundColor: 'rgba(15, 23, 42, 0.75)' }]}>
            <Text style={styles.dietChipText}>{dietTagLabel}</Text>
          </View>
        )}
      </View>

      {/* Recipe Info */}
      <View style={styles.infoWrap}>
        <View style={styles.metaHeader}>
          <Text style={[styles.cuisineText, { color: colors.accent }]} numberOfLines={1}>
            {recipe.cuisine.toUpperCase()}
          </Text>
          <View style={styles.timeWrap}>
            <Ionicons name="time-outline" size={13} color={colors.textMuted} />
            <Text style={[styles.timeText, { color: colors.textMuted }]}>
              {t('recipes.card.time', { mins: totalMinutes })}
            </Text>
          </View>
        </View>

        <Text style={[styles.title, { color: colors.text }]} numberOfLines={2}>
          {recipe.title}
        </Text>

        {/* Macro Badges: Calories & Protein */}
        <View style={styles.macroRow}>
          <View
            style={[
              styles.macroBadge,
              { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
            ]}
          >
            <Ionicons name="flame" size={13} color={colors.macroCalories} />
            <Text style={[styles.macroText, { color: colors.text }]}>
              {t('recipes.card.calories', { cal: Math.round(nutrition.calories) })}
            </Text>
          </View>

          <View
            style={[
              styles.macroBadge,
              { backgroundColor: colors.cardHighlight, borderColor: colors.border },
            ]}
          >
            <Ionicons name="barbell" size={13} color={colors.macroProtein} />
            <Text style={[styles.macroText, { color: colors.accent, fontWeight: '700' }]}>
              {t('recipes.card.protein', { p: Math.round(nutrition.protein) })}
            </Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: spacing.sm,
  },
  imageWrap: {
    width: '100%',
    height: 140,
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  favoriteBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dietChip: {
    position: 'absolute',
    bottom: 8,
    left: 8,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  dietChipText: {
    color: '#FFFFFF',
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  infoWrap: {
    padding: spacing.sm,
    gap: 4,
  },
  metaHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  cuisineText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  timeWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  timeText: {
    fontSize: fontSize.xs,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
    lineHeight: 20,
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 4,
  },
  macroBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  macroText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
