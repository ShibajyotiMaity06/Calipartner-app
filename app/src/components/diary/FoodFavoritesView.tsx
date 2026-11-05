import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { Button, Text, space, homeLayout } from '@calipartner/ui';
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
import { NutrientSummary } from './NutrientSummary';
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
}: {
  library: ReturnType<typeof useFoodLibrary>;
  onFood: (food: Food) => void;
  defaultSection: MealSection;
  localDate: string;
  onLogged?: () => void;
}) {
  const { user } = useAuth();
  const id = user?.id;
  const { hasActiveAccess, loading: planLoading } = useSubscription();
  const [recipes, setRecipes] = useState<Recipe[]>([]),
    [selected, setSelected] = useState<Recipe | null>(null);
  const [loading, setLoading] = useState(true),
    [error, setError] = useState(false),
    [plans, setPlans] = useState(false),
    [busy, setBusy] = useState(false);
  const version = useRef(0),
    acting = useRef(false);
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
    <View style={{ flex: 1 }} testID="food-favorites-view">
      <ScrollView contentContainerStyle={{ gap: space[3], padding: space[4] }}>
        <Text variant="heading">{t('foodPolish.favoriteFoods')}</Text>
        {library.loading ? (
          <Text>{t('common.loading')}</Text>
        ) : !library.foods.length ? (
          <Text>{t('foodPolish.favoritesEmpty')}</Text>
        ) : (
          library.foods.map((food) => (
            <View
              key={food.id}
              style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}
            >
              <Pressable
                onPress={() => onFood(food)}
                accessibilityRole="button"
                accessibilityLabel={food.name}
                testID={`favorite-result-${food.id}`}
                style={{ flex: 1, minHeight: homeLayout.touchSize, gap: space[1] }}
              >
                <Text variant="heading">{food.name}</Text>
                <NutrientSummary
                  values={{
                    calories: food.calories_per_100g,
                    protein: food.protein_per_100g,
                    carbs: food.carbs_per_100g,
                    fat: food.fat_per_100g,
                  }}
                  variant="micro"
                />
                <Text variant="micro">{t('foodPolish.portion')}</Text>
              </Pressable>
              <FoodFavoriteButton food={food} library={library} />
            </View>
          ))
        )}
        <Text variant="heading">{t('foodPolish.favoriteRecipes')}</Text>
        {loading ? (
          <Text>{t('common.loading')}</Text>
        ) : error ? (
          <>
            <Text accessibilityRole="alert">{t('foodPolish.actionError')}</Text>
            <Button
              variant="secondary"
              label={t('common.retry')}
              onPress={() => void reload()}
              testID="retry-favorite-recipes"
            />
          </>
        ) : !recipes.length ? (
          <Text>{t('foodPolish.recipesEmpty')}</Text>
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
      </ScrollView>
      {selected && (
        <RecipeDetailModal
          visible
          recipe={selected}
          defaultMealSection={defaultSection}
          localDate={localDate}
          onClose={() => setSelected(null)}
          onToggleFavorite={() => void toggle(selected)}
          onRecipeLogged={onLogged}
        />
      )}
      {plans && <PaywallModal visible onClose={() => setPlans(false)} preselectedTier="plus" />}
    </View>
  );
}
