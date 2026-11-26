import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Text as LegacyText, space as legacySpace } from '@calipartner/ui';
import { CheckIcon, PlusIcon, Text, borders, colors, radius, space } from '@calipartner/ui/v1';
import type { Food, MealSection, Recipe } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { useSubscription } from '@/hooks/useSubscription';
import type { useFoodLibrary } from '@/hooks/useFoodLibrary';
import { getDb } from '@/db';
import { getSupabase } from '@/lib/supabase';
import { loadAccountTable } from '@/services/accountDataService';
import {
  getRecipes,
  getFavoriteRecipes,
  getRecipeDetail,
  toggleRecipeFavorite,
  STARTER_RECIPE_IDS,
} from '@/services/recipeService';
import { RecipeCard } from '@/components/recipes/RecipeCard';
import { RecipeDetailModal } from '@/components/recipes/RecipeDetailModal';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { FoodFavoriteButton } from './FoodFavoriteButton';
import { t } from '@/i18n';

export function FoodFavoritesView(props: React.ComponentProps<typeof FoodFavoritesContent>) {
  const { user } = useAuth();
  return <FoodFavoritesContent key={user?.id ?? 'guest'} {...props} />;
}

function FoodFavoritesContent({
  library,
  onFood,
  defaultSection,
  localDate,
  onLogged,
  selectedIds,
  onToggleSelect,
}: {
  library: ReturnType<typeof useFoodLibrary>;
  onFood: (food: Food) => void;
  defaultSection: MealSection;
  localDate: string;
  onLogged?: () => void;
  selectedIds?: Record<string, boolean>;
  onToggleSelect?: (food: Food) => void;
}) {
  const { user } = useAuth();
  const id = user?.id;
  const { hasActiveAccess, loading: planLoading } = useSubscription();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [selected, setSelected] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [plans, setPlans] = useState(false);
  const [busy, setBusy] = useState(false);
  const version = useRef(0);
  const acting = useRef(false);

  const reload = useCallback(async () => {
    const current = ++version.current;
    if (!id) {
      setRecipes([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const db = await getDb();
      await getRecipes(db, {}, id, getSupabase());
      await loadAccountTable(db, 'recipe_favorites', id);
      const favorites = await getFavoriteRecipes(db, id);
      if (current === version.current) setRecipes(favorites);
    } catch {
      if (current === version.current) setError(true);
    } finally {
      if (current === version.current) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const open = async (recipe: Recipe) => {
    if (planLoading) return;
    if (!hasActiveAccess && !STARTER_RECIPE_IDS.has(recipe.id)) {
      setPlans(true);
      return;
    }
    try {
      setSelected(await getRecipeDetail(await getDb(), recipe.id, id, getSupabase()));
    } catch {
      setError(true);
    }
  };

  const toggle = async (recipe: Recipe) => {
    if (!id || acting.current) return;
    if (!hasActiveAccess && !STARTER_RECIPE_IDS.has(recipe.id)) {
      setPlans(true);
      return;
    }
    acting.current = true;
    setBusy(true);
    setError(false);
    try {
      await toggleRecipeFavorite(await getDb(), id, recipe.id, !recipe.is_favorite, getSupabase());
      setRecipes((current) => current.filter((item) => item.id !== recipe.id));
      setSelected(null);
    } catch {
      setError(true);
    } finally {
      acting.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={styles.root} testID="food-favorites-view">
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {library.loading ? (
          <Text variant="meta" color="textLo">
            {t('common.loading')}
          </Text>
        ) : !library.foods.length ? (
          <View style={styles.emptyState}>
            <Text variant="body" color="textLo">
              {t('foodPolish.favoritesEmpty')}
            </Text>
          </View>
        ) : (
          <View>
            {library.foods.map((food, idx) => {
              const isSelected = Boolean(selectedIds?.[food.id]);
              const baseServing = food.serving_units[0];
              const subMeta = baseServing
                ? `1 ${baseServing.unit} · ${Math.round(baseServing.grams)} g`
                : t('foodPolish.portion');
              const displayKcal = baseServing
                ? Math.round((food.calories_per_100g * baseServing.grams) / 100)
                : Math.round(food.calories_per_100g);

              return (
                <View key={food.id}>
                  <View style={styles.foodRow}>
                    <Pressable
                      onPress={() => onFood(food)}
                      accessibilityRole="button"
                      accessibilityLabel={food.name}
                      testID={`favorite-result-${food.id}`}
                      style={styles.foodCopy}
                    >
                      <Text variant="rowTitle" color="textHi" numberOfLines={1}>
                        {food.name}
                      </Text>
                      <Text variant="meta" color="textLo" numberOfLines={1}>
                        {subMeta}
                      </Text>
                    </Pressable>

                    <View style={styles.foodRight}>
                      <Text variant="rowTitle" tabular color="textHi">
                        {String(displayKcal)}
                        <Text variant="meta" color="textLo">
                          {' kcal'}
                        </Text>
                      </Text>
                      {onToggleSelect ? (
                        <Pressable
                          testID={`select-food-${food.id}`}
                          onPress={() => onToggleSelect(food)}
                          accessibilityRole="checkbox"
                          accessibilityState={{ checked: isSelected }}
                          accessibilityLabel={t('homeRefresh.selectFood', { name: food.name })}
                          style={[
                            styles.circleActionBtn,
                            isSelected ? styles.circleActionSelected : null,
                          ]}
                        >
                          {isSelected ? (
                            <CheckIcon size={16} color={colors.onBrand} strokeWidth={2.5} />
                          ) : (
                            <PlusIcon size={16} color={colors.textMid} />
                          )}
                        </Pressable>
                      ) : (
                        <FoodFavoriteButton food={food} library={library} />
                      )}
                    </View>
                  </View>
                  {idx < library.foods.length - 1 ? <View style={styles.divider} /> : null}
                </View>
              );
            })}
          </View>
        )}

        {recipes.length > 0 || error ? (
          <View style={styles.recipesSection}>
            <Text variant="eyebrow" color="textLo">
              {t('foodPolish.favoriteRecipes')}
            </Text>
            {loading ? (
              <LegacyText>{t('common.loading')}</LegacyText>
            ) : error ? (
              <>
                <Text variant="meta" color="danger" accessibilityRole="alert">
                  {t('foodPolish.actionError')}
                </Text>
                <Button
                  variant="secondary"
                  label={t('common.retry')}
                  onPress={() => void reload()}
                  testID="retry-favorite-recipes"
                />
              </>
            ) : (
              recipes.map((recipe) => (
                <RecipeCard
                  key={recipe.id}
                  recipe={recipe}
                  locked={!hasActiveAccess && !STARTER_RECIPE_IDS.has(recipe.id)}
                  disabled={busy || planLoading}
                  onPress={() => void open(recipe)}
                  onToggleFavorite={() => void toggle(recipe)}
                />
              ))
            )}
          </View>
        ) : null}
      </ScrollView>

      {selected ? (
        <RecipeDetailModal
          visible
          recipe={selected}
          defaultMealSection={defaultSection}
          localDate={localDate}
          onClose={() => setSelected(null)}
          onToggleFavorite={() => void toggle(selected)}
          onRecipeLogged={onLogged}
        />
      ) : null}
      {plans ? (
        <PaywallModal visible onClose={() => setPlans(false)} preselectedTier="plus" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: legacySpace[8],
    gap: space.md,
  },
  emptyState: {
    paddingVertical: space.xl,
    alignItems: 'center',
  },
  foodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: space.md,
    minHeight: 56,
  },
  foodCopy: {
    flex: 1,
    gap: 2,
  },
  foodRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  circleActionBtn: {
    width: 36,
    height: 36,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleActionSelected: {
    backgroundColor: colors.apricot,
    borderColor: colors.apricot,
  },
  divider: {
    height: borders.width,
    backgroundColor: colors.s2,
  },
  recipesSection: {
    marginTop: space.md,
    gap: space.sm,
  },
});
