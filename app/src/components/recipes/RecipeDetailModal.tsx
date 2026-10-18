import React, { useState } from 'react';
import {
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  scaleRecipeServings,
  type MealSection,
  type Recipe,
} from '@calipartner/core';
import { t } from '@/i18n';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';
import { LogRecipeModal } from './LogRecipeModal';
import { RecipeReportModal } from './RecipeReportModal';
import { RecipeServingsScaler } from './RecipeServingsScaler';

export interface RecipeDetailModalProps {
  visible: boolean;
  recipe: Recipe | null;
  onClose: () => void;
  onToggleFavorite?: (recipe: Recipe) => void;
  defaultMealSection?: MealSection;
  localDate?: string;
  onRecipeLogged?: () => void;
}

export function RecipeDetailModal({
  visible,
  recipe,
  onClose,
  onToggleFavorite,
  defaultMealSection,
  localDate,
  onRecipeLogged,
}: RecipeDetailModalProps) {
  const { colors } = useTheme();

  const [currentServings, setCurrentServings] = useState<number>(recipe?.servings ?? 1);
  const [showLogModal, setShowLogModal] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Sync state if recipe changes
  React.useEffect(() => {
    if (recipe) {
      setCurrentServings(recipe.servings || 1);
    }
  }, [recipe]);

  if (!recipe) return null;

  const totalMinutes = (recipe.prep_minutes || 0) + (recipe.cook_minutes || 0);
  const heroImage = recipe.image_urls?.[0];
  const nutrition = recipe.nutrition_per_serving;

  // Compute scaled ingredients (RCP-5)
  const { scaledIngredients } = scaleRecipeServings(
    recipe,
    currentServings,
  );

  const formatQuantity = (val: number): string => {
    if (Number.isInteger(val)) return String(val);
    const rounded = Math.round(val * 10) / 10;
    return String(rounded);
  };

  return (
    <>
      <Modal
        testID="modal-recipe-detail"
        visible={visible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={onClose}
      >
        <View style={[styles.container, { backgroundColor: colors.background }]}>
          {/* Top Bar with Close & Favorite Toggle */}
          <View
            style={[
              styles.topBar,
              {
                backgroundColor: colors.surface,
                borderBottomColor: colors.border,
              },
            ]}
          >
            <Pressable
              testID="btn-recipe-detail-close"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.detail.close')}
              style={styles.circleBtn}
            >
              <Ionicons name="close" size={24} color={colors.text} />
            </Pressable>

            <Text style={[styles.topBarTitle, { color: colors.text }]} numberOfLines={1}>
              {recipe.title}
            </Text>

            {onToggleFavorite && (
              <Pressable
                testID="btn-recipe-fav-detail"
                onPress={() => onToggleFavorite(recipe)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                accessibilityRole="button"
                accessibilityLabel={
                  recipe.is_favorite
                    ? t('recipes.detail.favoriteOn')
                    : t('recipes.detail.favoriteOff')
                }
                style={styles.circleBtn}
              >
                <Ionicons
                  name={recipe.is_favorite ? 'heart' : 'heart-outline'}
                  size={24}
                  color={recipe.is_favorite ? '#EF4444' : colors.text}
                />
              </Pressable>
            )}
          </View>

          <ScrollView
            testID="scroll-recipe-detail"
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Hero Image */}
            <View style={[styles.heroWrap, { backgroundColor: colors.surfaceAlt }]}>
              {heroImage ? (
                <Image
                  source={{ uri: heroImage }}
                  style={styles.heroImage}
                  resizeMode="cover"
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <View style={styles.heroPlaceholder}>
                  <Ionicons name="restaurant-outline" size={54} color={colors.textMuted} />
                </View>
              )}
            </View>

            {/* Meta Title & Tags */}
            <View style={[styles.cardSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.tagsRow}>
                <View style={[styles.tagBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.tagBadgeText, { color: colors.accent }]}>
                    {recipe.cuisine.toUpperCase()}
                  </Text>
                </View>

                {recipe.diet_tags?.map((tag) => (
                  <View key={tag} style={[styles.tagBadge, { backgroundColor: colors.cardHighlight }]}>
                    <Text style={[styles.tagBadgeText, { color: colors.accent }]}>
                      {t(`recipes.dietTags.${tag}` as Parameters<typeof t>[0])}
                    </Text>
                  </View>
                ))}

                <View style={[styles.tagBadge, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.tagBadgeText, { color: colors.textMuted }]}>
                    {t(`recipes.difficulties.${recipe.difficulty}` as Parameters<typeof t>[0])}
                  </Text>
                </View>
              </View>

              <Text style={[styles.recipeTitle, { color: colors.text }]}>
                {recipe.title}
              </Text>

              {recipe.description && (
                <Text style={[styles.description, { color: colors.textMuted }]}>
                  {recipe.description}
                </Text>
              )}

              {/* Time Details Row */}
              <View style={styles.timeDetailsRow}>
                <View style={styles.timeItem}>
                  <Ionicons name="time-outline" size={16} color={colors.textMuted} />
                  <Text style={[styles.timeItemText, { color: colors.textMuted }]}>
                    {t('recipes.detail.totalTime', { mins: totalMinutes })}
                  </Text>
                </View>

                {recipe.prep_minutes > 0 && (
                  <View style={styles.timeItem}>
                    <Ionicons name="cut-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.timeItemText, { color: colors.textMuted }]}>
                      {t('recipes.detail.prepTime', { mins: recipe.prep_minutes })}
                    </Text>
                  </View>
                )}

                {recipe.cook_minutes > 0 && (
                  <View style={styles.timeItem}>
                    <Ionicons name="flame-outline" size={16} color={colors.textMuted} />
                    <Text style={[styles.timeItemText, { color: colors.textMuted }]}>
                      {t('recipes.detail.cookTime', { mins: recipe.cook_minutes })}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            {/* Nutrition Per Serving Section */}
            <View style={[styles.cardSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="nutrition-outline" size={20} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('recipes.detail.nutritionTitle')}
                </Text>
              </View>

              <View style={styles.nutritionGrid}>
                <View style={[styles.macroCard, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.macroValue, { color: colors.macroCalories }]}>
                    {Math.round(nutrition.calories)}
                  </Text>
                  <Text style={[styles.macroUnit, { color: colors.textMuted }]}>kcal</Text>
                  <Text style={[styles.macroName, { color: colors.text }]}>
                    {t('recipes.detail.caloriesLabel')}
                  </Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: colors.cardHighlight }]}>
                  <Text style={[styles.macroValue, { color: colors.macroProtein }]}>
                    {Math.round(nutrition.protein)}
                  </Text>
                  <Text style={[styles.macroUnit, { color: colors.textMuted }]}>g</Text>
                  <Text style={[styles.macroName, { color: colors.text }]}>
                    {t('recipes.detail.proteinLabel')}
                  </Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.macroValue, { color: colors.macroCarbs }]}>
                    {Math.round(nutrition.carbs)}
                  </Text>
                  <Text style={[styles.macroUnit, { color: colors.textMuted }]}>g</Text>
                  <Text style={[styles.macroName, { color: colors.text }]}>
                    {t('recipes.detail.carbsLabel')}
                  </Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.macroValue, { color: colors.macroFat }]}>
                    {Math.round(nutrition.fat)}
                  </Text>
                  <Text style={[styles.macroUnit, { color: colors.textMuted }]}>g</Text>
                  <Text style={[styles.macroName, { color: colors.text }]}>
                    {t('recipes.detail.fatLabel')}
                  </Text>
                </View>

                <View style={[styles.macroCard, { backgroundColor: colors.surfaceAlt }]}>
                  <Text style={[styles.macroValue, { color: colors.macroFiber }]}>
                    {Math.round(nutrition.fiber)}
                  </Text>
                  <Text style={[styles.macroUnit, { color: colors.textMuted }]}>g</Text>
                  <Text style={[styles.macroName, { color: colors.text }]}>
                    {t('recipes.detail.fiberLabel')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Servings Scaler & Scaled Ingredients List */}
            <View style={[styles.cardSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="basket-outline" size={20} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('recipes.detail.ingredientsTitle')}
                </Text>
              </View>

              <RecipeServingsScaler
                servings={currentServings}
                onServingsChange={setCurrentServings}
              />

              {/* Ingredients list */}
              <View style={styles.ingredientsList}>
                {scaledIngredients.length === 0 ? (
                  <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                    No ingredients listed.
                  </Text>
                ) : (
                  scaledIngredients.map((item, index) => (
                    <View
                      key={item.id || `ing-${index}`}
                      testID={`ingredient-row-${index}`}
                      style={[
                        styles.ingredientRow,
                        {
                          borderBottomColor: colors.border,
                          borderBottomWidth:
                            index < scaledIngredients.length - 1 ? StyleSheet.hairlineWidth : 0,
                        },
                      ]}
                    >
                      <View style={styles.ingredientDot} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.ingredientName, { color: colors.text }]}>
                          {item.food_name || 'Ingredient'}
                          {item.note ? (
                            <Text style={[styles.ingredientNote, { color: colors.textMuted }]}>
                              {' '}
                              ({item.note})
                            </Text>
                          ) : null}
                        </Text>
                      </View>
                      <Text style={[styles.ingredientQuantity, { color: colors.accent }]}>
                        {formatQuantity(item.scaled_quantity)} {item.unit}
                      </Text>
                    </View>
                  ))
                )}
              </View>
            </View>

            {/* Instructions Steps */}
            <View style={[styles.cardSection, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <View style={styles.sectionHeader}>
                <Ionicons name="list-outline" size={20} color={colors.accent} />
                <Text style={[styles.sectionTitle, { color: colors.text }]}>
                  {t('recipes.detail.stepsTitle')}
                </Text>
              </View>

              <View style={styles.stepsList}>
                {recipe.steps.map((step, idx) => (
                  <View key={`step-${idx}`} style={styles.stepRow}>
                    <View
                      style={[
                        styles.stepBadge,
                        { backgroundColor: colors.accent },
                      ]}
                    >
                      <Text style={[styles.stepBadgeText, { color: colors.onAccent }]}>
                        {idx + 1}
                      </Text>
                    </View>
                    <Text style={[styles.stepText, { color: colors.text }]}>
                      {step}
                    </Text>
                  </View>
                ))}
              </View>
            </View>

            {/* Chef Tips */}
            {recipe.tips && recipe.tips.length > 0 && (
              <View
                style={[
                  styles.cardSection,
                  { backgroundColor: colors.cardHighlight, borderColor: colors.border },
                ]}
              >
                <View style={styles.sectionHeader}>
                  <Ionicons name="bulb-outline" size={20} color={colors.accent} />
                  <Text style={[styles.sectionTitle, { color: colors.accent }]}>
                    {t('recipes.detail.tipsTitle')}
                  </Text>
                </View>
                <View style={styles.tipsList}>
                  {recipe.tips.map((tip, idx) => (
                    <View key={`tip-${idx}`} style={styles.tipRow}>
                      <Ionicons name="sparkles" size={14} color={colors.accent} style={{ marginTop: 3 }} />
                      <Text style={[styles.tipText, { color: colors.text }]}>{tip}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Report an error action link */}
            <Pressable
              testID="btn-recipe-report-issue"
              onPress={() => setShowReportModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.detail.reportErrorCta')}
              style={styles.reportBtn}
            >
              <Ionicons name="flag-outline" size={15} color={colors.textMuted} />
              <Text style={[styles.reportBtnText, { color: colors.textMuted }]}>
                {t('recipes.detail.reportErrorCta')}
              </Text>
            </Pressable>
          </ScrollView>

          {/* Sticky Bottom Action CTA */}
          <View
            style={[
              styles.bottomBar,
              {
                backgroundColor: colors.surface,
                borderTopColor: colors.border,
              },
            ]}
          >
            <Pressable
              testID="btn-open-log-recipe"
              onPress={() => setShowLogModal(true)}
              accessibilityRole="button"
              accessibilityLabel={t('recipes.detail.logRecipeCta')}
              style={({ pressed }) => [
                styles.logCtaBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: pressed ? 0.9 : 1,
                },
              ]}
            >
              <Ionicons name="add-circle-outline" size={22} color={colors.onAccent} />
              <Text style={[styles.logCtaText, { color: colors.onAccent }]}>
                {t('recipes.detail.logRecipeCta')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Log Recipe Sheet */}
      <LogRecipeModal
        visible={showLogModal}
        recipe={recipe}
        defaultMealSection={defaultMealSection}
        localDate={localDate}
        onClose={() => setShowLogModal(false)}
        onLogged={() => {
          setShowLogModal(false);
          onRecipeLogged?.();
          onClose();
        }}
      />

      {/* Report Error Modal */}
      <RecipeReportModal
        visible={showReportModal}
        recipe={recipe}
        onClose={() => setShowReportModal(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  topBarTitle: {
    fontSize: fontSize.md,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 8,
  },
  circleBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingBottom: 110,
    gap: spacing.md,
  },
  heroWrap: {
    width: '100%',
    height: 220,
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardSection: {
    marginHorizontal: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  tagsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  tagBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  tagBadgeText: {
    fontSize: 10,
    fontWeight: '700',
  },
  recipeTitle: {
    fontSize: fontSize.lg,
    fontWeight: '800',
    lineHeight: 26,
  },
  description: {
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  timeDetailsRow: {
    flexDirection: 'row',
    gap: 16,
    paddingTop: 4,
  },
  timeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  timeItemText: {
    fontSize: fontSize.xs,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sectionTitle: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  nutritionGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 6,
  },
  macroCard: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 4,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  macroValue: {
    fontSize: fontSize.md,
    fontWeight: '800',
  },
  macroUnit: {
    fontSize: 9,
    fontWeight: '600',
  },
  macroName: {
    fontSize: 10,
    fontWeight: '700',
    marginTop: 2,
  },
  ingredientsList: {
    gap: 4,
    marginTop: 4,
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 10,
  },
  ingredientDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#94A3B8',
  },
  ingredientName: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
  ingredientNote: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
  },
  ingredientQuantity: {
    fontSize: fontSize.xs,
    fontWeight: '700',
  },
  emptyText: {
    fontSize: fontSize.xs,
    fontStyle: 'italic',
    paddingVertical: 8,
  },
  stepsList: {
    gap: 12,
    marginTop: 4,
  },
  stepRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  stepBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  stepBadgeText: {
    fontSize: 11,
    fontWeight: '800',
  },
  stepText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  tipsList: {
    gap: 8,
    marginTop: 4,
  },
  tipRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  tipText: {
    flex: 1,
    fontSize: fontSize.xs,
    lineHeight: 18,
  },
  reportBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  reportBtnText: {
    fontSize: fontSize.xs,
    textDecorationLine: 'underline',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  logCtaBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: radius.md,
  },
  logCtaText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
});
