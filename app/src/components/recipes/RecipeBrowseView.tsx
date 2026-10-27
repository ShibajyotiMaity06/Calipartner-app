import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@calipartner/ui';
import { PaywallModal } from '@/components/rooms/PaywallModal';
import { STARTER_RECIPE_IDS } from '@/services/recipeService';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  filterRecipes,
  type MealSection,
  type Recipe,
  type RecipeFilterCriteria,
} from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { getSupabase } from '@/lib/supabase';
import {
  getFavoriteRecipes,
  getRecipeDetail,
  getRecipes,
  toggleRecipeFavorite,
} from '@/services/recipeService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { RecipeCard } from './RecipeCard';
import { RecipeDetailModal } from './RecipeDetailModal';
import { RecipeFilterBar } from './RecipeFilterBar';

export interface RecipeBrowseViewProps {
  initialMealSection?: MealSection;
  localDate?: string;
  onRecipeLogged?: () => void;
  headerTitle?: string;
  showBackOrClose?: boolean;
  onBackOrClose?: () => void;
}

type BrowseTab = 'all' | 'favorites';

export function RecipeBrowseView({
  initialMealSection,
  localDate,
  onRecipeLogged,
  headerTitle,
  showBackOrClose,
  onBackOrClose,
}: RecipeBrowseViewProps) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { hasActiveAccess, loading: planLoading } = useSubscription();
  const [showPlans, setShowPlans] = useState(false);

  const [activeTab, setActiveTab] = useState<BrowseTab>('all');
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState<RecipeFilterCriteria>({});
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Selected recipe detail
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);

  // Fetch recipes
  const loadRecipes = useCallback(async () => {
    setErrorMsg(null);
    try {
      const db = await getDb();
      const supabase = getSupabase();

      if (activeTab === 'favorites') {
        if (!user?.id) {
          setRecipes([]);
          return;
        }
        const favs = await getFavoriteRecipes(db, user.id);
        const fullCriteria: RecipeFilterCriteria = {
          ...criteria,
          query: query.trim() || undefined,
        };
        const filtered = filterRecipes(
          favs.map((r) => ({ ...r, is_favorite: true })),
          fullCriteria,
        );
        setRecipes(filtered);
      } else {
        const fullCriteria: RecipeFilterCriteria = {
          ...criteria,
          query: query.trim() || undefined,
        };
        const list = await getRecipes(db, fullCriteria, user?.id, supabase);
        setRecipes(list);
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to load recipes.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [activeTab, criteria, query, user?.id]);

  useEffect(() => {
    setLoading(true);
    loadRecipes();
  }, [loadRecipes]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadRecipes();
  };

  const handleSelectRecipe = async (recipe: Recipe) => {
    if (planLoading) return;
    if (!hasActiveAccess && !STARTER_RECIPE_IDS.has(recipe.id)) {
      setShowPlans(true);
      return;
    }
    try {
      const db = await getDb();
      const supabase = getSupabase();
      const full = await getRecipeDetail(db, recipe.id, user?.id, supabase);
      setSelectedRecipe(full ?? recipe);
      setDetailModalVisible(true);
    } catch {
      setSelectedRecipe(recipe);
      setDetailModalVisible(true);
    }
  };

  const handleToggleFavorite = async (recipe: Recipe) => {
    if (!user?.id) return;
    const nextFavorite = !recipe.is_favorite;

    if (!hasActiveAccess && !STARTER_RECIPE_IDS.has(recipe.id)) {
      setShowPlans(true);
      return;
    }
    // Optimistically update list
    setRecipes((prev) =>
      prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: nextFavorite } : r)),
    );

    if (selectedRecipe && selectedRecipe.id === recipe.id) {
      setSelectedRecipe({ ...selectedRecipe, is_favorite: nextFavorite });
    }

    try {
      const db = await getDb();
      const supabase = getSupabase();
      await toggleRecipeFavorite(db, user.id, recipe.id, nextFavorite, supabase);
    } catch {
      // Revert on error
      setRecipes((prev) =>
        prev.map((r) => (r.id === recipe.id ? { ...r, is_favorite: !nextFavorite } : r)),
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      {!planLoading && !hasActiveAccess && (
        <View style={{ padding: spacing.md }} testID="starter-recipe-notice">
          <Text style={{ color: colors.text }}>{t('brandRepair.starterRecipes')}</Text>
          <Button
            variant="secondary"
            label={t('brandRepair.seePlans')}
            onPress={() => setShowPlans(true)}
            testID="recipe-see-plans"
          />
        </View>
      )}
      <PaywallModal
        visible={showPlans}
        onClose={() => setShowPlans(false)}
        preselectedTier="plus"
      />

      {/* Optional Header */}
      {(headerTitle || showBackOrClose) && (
        <View
          style={[
            styles.headerRow,
            {
              backgroundColor: colors.surface,
              borderBottomColor: colors.border,
            },
          ]}
        >
          {showBackOrClose && (
            <Pressable
              testID="btn-browse-recipes-back"
              onPress={onBackOrClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel="Back"
              style={styles.backBtn}
            >
              <Ionicons name="chevron-back" size={24} color={colors.text} />
            </Pressable>
          )}

          <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
            {headerTitle ?? t('recipes.browse.title')}
          </Text>

          {showBackOrClose ? <View style={styles.backBtn} /> : null}
        </View>
      )}

      {/* Tabs: All Recipes vs Favourites */}
      <View
        style={[
          styles.tabsBar,
          {
            backgroundColor: colors.surface,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <Pressable
          testID="tab-recipes-all"
          onPress={() => setActiveTab('all')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'all' }}
          style={[
            styles.tabItem,
            {
              borderBottomColor: activeTab === 'all' ? colors.accent : 'transparent',
              borderBottomWidth: activeTab === 'all' ? 2.5 : 0,
            },
          ]}
        >
          <Text
            style={[
              styles.tabText,
              {
                color: activeTab === 'all' ? colors.accent : colors.textMuted,
                fontWeight: activeTab === 'all' ? '700' : '500',
              },
            ]}
          >
            {t('recipes.browse.tabAll')}
          </Text>
        </Pressable>

        <Pressable
          testID="tab-recipes-favorites"
          onPress={() => setActiveTab('favorites')}
          accessibilityRole="tab"
          accessibilityState={{ selected: activeTab === 'favorites' }}
          style={[
            styles.tabItem,
            {
              borderBottomColor: activeTab === 'favorites' ? colors.accent : 'transparent',
              borderBottomWidth: activeTab === 'favorites' ? 2.5 : 0,
            },
          ]}
        >
          <View style={styles.tabWithIcon}>
            <Ionicons
              name={activeTab === 'favorites' ? 'heart' : 'heart-outline'}
              size={15}
              color={activeTab === 'favorites' ? '#EF4444' : colors.textMuted}
            />
            <Text
              style={[
                styles.tabText,
                {
                  color: activeTab === 'favorites' ? colors.accent : colors.textMuted,
                  fontWeight: activeTab === 'favorites' ? '700' : '500',
                },
              ]}
            >
              {t('recipes.browse.tabFavorites')}
            </Text>
          </View>
        </Pressable>
      </View>

      {/* Filter and Search Bar */}
      <View style={styles.filterBarWrap}>
        <RecipeFilterBar
          query={query}
          onQueryChange={setQuery}
          criteria={criteria}
          onCriteriaChange={setCriteria}
        />
      </View>

      {/* Recipe List / Grid Content */}
      {loading ? (
        <View testID="loading-recipes" style={styles.centerState}>
          <ActivityIndicator size="large" color={colors.accent} />
          <Text style={[styles.stateText, { color: colors.textMuted }]}>
            {t('recipes.browse.loadingTitle')}
          </Text>
        </View>
      ) : errorMsg ? (
        <View testID="error-recipes-view" style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={44} color={colors.danger} />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            {t('recipes.browse.errorTitle')}
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted }]}>{errorMsg}</Text>
          <Pressable
            testID="btn-retry-recipes"
            onPress={loadRecipes}
            accessibilityRole="button"
            accessibilityLabel={t('recipes.browse.errorRetry')}
            style={[styles.retryBtn, { backgroundColor: colors.accent }]}
          >
            <Text style={[styles.retryBtnText, { color: colors.onAccent }]}>
              {t('recipes.browse.errorRetry')}
            </Text>
          </Pressable>
        </View>
      ) : recipes.length === 0 ? (
        <View
          testID={activeTab === 'favorites' ? 'empty-favorites-view' : 'empty-recipes-view'}
          style={styles.centerState}
        >
          <Ionicons
            name={activeTab === 'favorites' ? 'heart-dislike-outline' : 'search-outline'}
            size={44}
            color={colors.textMuted}
          />
          <Text style={[styles.stateTitle, { color: colors.text }]}>
            {activeTab === 'favorites'
              ? t('recipes.browse.emptyFavTitle')
              : t('recipes.browse.emptyAllTitle')}
          </Text>
          <Text style={[styles.stateText, { color: colors.textMuted, maxWidth: 300 }]}>
            {activeTab === 'favorites'
              ? t('recipes.browse.emptyFavDesc')
              : t('recipes.browse.emptyAllDesc')}
          </Text>
          {activeTab === 'all' && (query.length > 0 || Object.keys(criteria).length > 0) && (
            <Pressable
              testID="btn-empty-clear-filters"
              onPress={() => {
                setQuery('');
                setCriteria({});
              }}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.browse.clearFilters')}
              style={[styles.retryBtn, { backgroundColor: colors.accent }]}
            >
              <Text style={[styles.retryBtnText, { color: colors.onAccent }]}>
                {t('recipes.browse.clearFilters')}
              </Text>
            </Pressable>
          )}
        </View>
      ) : (
        <FlatList
          testID="recipe-browse-grid"
          data={recipes}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <RecipeCard
              recipe={item}
              locked={!hasActiveAccess && !STARTER_RECIPE_IDS.has(item.id)}
              onPress={handleSelectRecipe}
              onToggleFavorite={handleToggleFavorite}
            />
          )}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={colors.accent}
            />
          }
        />
      )}

      {/* Detail Modal */}
      {selectedRecipe &&
        !planLoading &&
        (hasActiveAccess || STARTER_RECIPE_IDS.has(selectedRecipe.id)) && (
          <RecipeDetailModal
            visible={detailModalVisible}
            recipe={selectedRecipe}
            defaultMealSection={initialMealSection}
            localDate={localDate}
            onClose={() => setDetailModalVisible(false)}
            onToggleFavorite={handleToggleFavorite}
            onRecipeLogged={onRecipeLogged}
          />
        )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  tabsBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingHorizontal: spacing.md,
  },
  tabItem: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabWithIcon: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabText: {
    fontSize: fontSize.xs,
  },
  filterBarWrap: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  listContent: {
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: 40,
  },
  centerState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: 12,
  },
  stateTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    textAlign: 'center',
  },
  stateText: {
    fontSize: fontSize.xs,
    textAlign: 'center',
    lineHeight: 18,
  },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: radius.md,
    marginTop: 4,
  },
  retryBtnText: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
});
