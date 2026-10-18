import React, { useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { scaleLoggedRecipeNutrients, type MealSection, type Recipe } from '@calipartner/core';
import { useAuth } from '@/contexts/AuthContext';
import { getDb } from '@/db';
import { t } from '@/i18n';
import { logRecipe } from '@/services/recipeService';
import { fontSize, radius, spacing } from '@/theme/tokens';
import { useTheme } from '@/theme/useTheme';

export interface LogRecipeModalProps {
  visible: boolean;
  recipe: Recipe | null;
  defaultMealSection?: MealSection;
  localDate?: string;
  onClose: () => void;
  onLogged?: () => void;
}

const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];
const QUICK_SERVINGS = [0.5, 1, 1.5, 2];

export function LogRecipeModal({
  visible,
  recipe,
  defaultMealSection,
  localDate = new Date().toISOString().slice(0, 10),
  onClose,
  onLogged,
}: LogRecipeModalProps) {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [servings, setServings] = useState<number>(1);
  const [mealSection, setMealSection] = useState<MealSection>(() => {
    if (defaultMealSection) return defaultMealSection;
    if (recipe?.meal_type === 'snack') return 'snacks';
    if (recipe?.meal_type && SECTIONS.includes(recipe.meal_type as MealSection)) {
      return recipe.meal_type as MealSection;
    }
    return 'lunch';
  });
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!recipe) return null;

  // Live scaled nutrients preview (RCP-6)
  const scaledNutrients = scaleLoggedRecipeNutrients(recipe.nutrition_per_serving, servings);

  const handleDecrement = () => {
    setServings((s) => Math.max(0.5, Math.round((s - 0.5) * 10) / 10));
  };

  const handleIncrement = () => {
    setServings((s) => Math.min(10, Math.round((s + 0.5) * 10) / 10));
  };

  const handleLog = async () => {
    if (!user?.id) {
      setErrorMsg('Please sign in to log recipes to your diary.');
      return;
    }

    setSubmitting(true);
    setErrorMsg(null);

    try {
      const db = await getDb();

      await logRecipe(db, {
        userId: user.id,
        recipeId: recipe.id,
        servings,
        mealSection,
        localDate,
      });

      onLogged?.();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to log recipe.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      testID="modal-log-recipe"
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>
                {t('recipes.logSheet.title')}
              </Text>
              <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
                {recipe.title}
              </Text>
            </View>
            <Pressable
              testID="btn-close-log-recipe"
              onPress={onClose}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              accessibilityRole="button"
              accessibilityLabel={t('common.cancel')}
            >
              <Ionicons name="close" size={24} color={colors.textMuted} />
            </Pressable>
          </View>

          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            {errorMsg && (
              <View
                style={[
                  styles.errorBox,
                  { backgroundColor: '#FEE2E2', borderColor: colors.danger },
                ]}
              >
                <Text style={[styles.errorText, { color: colors.danger }]}>{errorMsg}</Text>
              </View>
            )}

            {/* Servings Stepper & Quick presets */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {t('recipes.logSheet.servingsLabel')}
              </Text>

              <View style={styles.stepperContainer}>
                <Pressable
                  testID="stepper-log-servings-dec"
                  onPress={handleDecrement}
                  disabled={servings <= 0.5}
                  accessibilityRole="button"
                  accessibilityLabel="Decrease servings by 0.5"
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      opacity: servings <= 0.5 ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="remove" size={20} color={colors.text} />
                </Pressable>

                <View style={styles.stepperValueWrap}>
                  <Text
                    testID="text-log-servings-value"
                    style={[styles.stepperValueText, { color: colors.text }]}
                  >
                    {servings}
                  </Text>
                  <Text style={[styles.stepperValueSub, { color: colors.textMuted }]}>
                    {t('recipes.card.servings', { servings })}
                  </Text>
                </View>

                <Pressable
                  testID="stepper-log-servings-inc"
                  onPress={handleIncrement}
                  disabled={servings >= 10}
                  accessibilityRole="button"
                  accessibilityLabel="Increase servings by 0.5"
                  style={({ pressed }) => [
                    styles.stepperBtn,
                    {
                      backgroundColor: colors.surfaceAlt,
                      borderColor: colors.border,
                      opacity: servings >= 10 ? 0.35 : pressed ? 0.7 : 1,
                    },
                  ]}
                >
                  <Ionicons name="add" size={20} color={colors.text} />
                </Pressable>
              </View>

              {/* Quick Preset Pills */}
              <View style={styles.presetsRow}>
                {QUICK_SERVINGS.map((preset) => {
                  const isSelected = servings === preset;
                  return (
                    <Pressable
                      key={preset}
                      testID={`preset-servings-${preset}`}
                      onPress={() => setServings(preset)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.presetChip,
                        {
                          backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.presetChipText,
                          {
                            color: isSelected ? colors.onAccent : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {preset}x
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Meal Section Selector */}
            <View style={styles.sectionWrap}>
              <Text style={[styles.sectionHeading, { color: colors.text }]}>
                {t('recipes.logSheet.mealSectionLabel')}
              </Text>
              <View style={styles.mealSectionsRow}>
                {SECTIONS.map((sec) => {
                  const isSelected = mealSection === sec;
                  return (
                    <Pressable
                      key={sec}
                      testID={`btn-select-meal-section-${sec}`}
                      onPress={() => setMealSection(sec)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isSelected }}
                      style={[
                        styles.mealSectionChip,
                        {
                          backgroundColor: isSelected ? colors.accent : colors.surfaceAlt,
                          borderColor: isSelected ? colors.accent : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.mealSectionChipText,
                          {
                            color: isSelected ? colors.onAccent : colors.text,
                            fontWeight: isSelected ? '700' : '500',
                          },
                        ]}
                      >
                        {t(
                          (sec === 'snacks'
                            ? 'recipes.mealTypes.snack'
                            : `recipes.mealTypes.${sec}`) as Parameters<typeof t>[0],
                        )}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            {/* Live Nutrient Snapshot Preview */}
            <View
              style={[
                styles.nutrientsCard,
                { backgroundColor: colors.surfaceAlt, borderColor: colors.border },
              ]}
            >
              <Text style={[styles.nutrientsTitle, { color: colors.text }]}>
                {t('recipes.logSheet.totalsPreview', { servings })}
              </Text>

              <View style={styles.nutrientsGrid}>
                <View style={styles.nutrientBox}>
                  <Text style={[styles.nutrientVal, { color: colors.macroCalories }]}>
                    {Math.round(scaledNutrients.calories)}
                  </Text>
                  <Text style={[styles.nutrientLabel, { color: colors.textMuted }]}>
                    {t('recipes.detail.caloriesLabel')}
                  </Text>
                </View>

                <View style={styles.nutrientBox}>
                  <Text style={[styles.nutrientVal, { color: colors.macroProtein }]}>
                    {Math.round(scaledNutrients.protein)}g
                  </Text>
                  <Text style={[styles.nutrientLabel, { color: colors.textMuted }]}>
                    {t('recipes.detail.proteinLabel')}
                  </Text>
                </View>

                <View style={styles.nutrientBox}>
                  <Text style={[styles.nutrientVal, { color: colors.macroCarbs }]}>
                    {Math.round(scaledNutrients.carbs)}g
                  </Text>
                  <Text style={[styles.nutrientLabel, { color: colors.textMuted }]}>
                    {t('recipes.detail.carbsLabel')}
                  </Text>
                </View>

                <View style={styles.nutrientBox}>
                  <Text style={[styles.nutrientVal, { color: colors.macroFat }]}>
                    {Math.round(scaledNutrients.fat)}g
                  </Text>
                  <Text style={[styles.nutrientLabel, { color: colors.textMuted }]}>
                    {t('recipes.detail.fatLabel')}
                  </Text>
                </View>

                <View style={styles.nutrientBox}>
                  <Text style={[styles.nutrientVal, { color: colors.macroFiber }]}>
                    {Math.round(scaledNutrients.fiber)}g
                  </Text>
                  <Text style={[styles.nutrientLabel, { color: colors.textMuted }]}>
                    {t('recipes.detail.fiberLabel')}
                  </Text>
                </View>
              </View>
            </View>

            {/* Submit Log Button */}
            <Pressable
              testID="btn-log-recipe-submit"
              onPress={handleLog}
              disabled={submitting}
              accessibilityRole="button"
              accessibilityLabel={`Log ${servings} servings of ${recipe.title}`}
              style={({ pressed }) => [
                styles.submitBtn,
                {
                  backgroundColor: colors.accent,
                  opacity: submitting ? 0.7 : pressed ? 0.9 : 1,
                },
              ]}
            >
              {submitting ? (
                <View style={styles.btnLoadingRow}>
                  <ActivityIndicator size="small" color={colors.onAccent} />
                  <Text style={[styles.submitBtnText, { color: colors.onAccent }]}>
                    {t('recipes.logSheet.submitting')}
                  </Text>
                </View>
              ) : (
                <Text style={[styles.submitBtnText, { color: colors.onAccent }]}>
                  {t('recipes.logSheet.submitButton', {
                    servings,
                    calories: Math.round(scaledNutrients.calories),
                  })}
                </Text>
              )}
            </Pressable>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    borderTopWidth: 1,
    maxHeight: '90%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#CBD5E1',
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: fontSize.xs,
    marginTop: 2,
  },
  body: {
    padding: spacing.md,
    gap: spacing.md,
  },
  sectionWrap: {
    gap: spacing.xs,
  },
  sectionHeading: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    paddingVertical: 6,
  },
  stepperBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperValueWrap: {
    minWidth: 80,
    alignItems: 'center',
  },
  stepperValueText: {
    fontSize: fontSize.xl,
    fontWeight: '800',
  },
  stepperValueSub: {
    fontSize: fontSize.xs,
  },
  presetsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  presetChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  presetChipText: {
    fontSize: fontSize.xs,
  },
  mealSectionsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  mealSectionChip: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mealSectionChipText: {
    fontSize: fontSize.xs,
  },
  nutrientsCard: {
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 8,
  },
  nutrientsTitle: {
    fontSize: fontSize.xs,
    fontWeight: '700',
    textAlign: 'center',
  },
  nutrientsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  nutrientBox: {
    alignItems: 'center',
    gap: 2,
  },
  nutrientVal: {
    fontSize: fontSize.sm,
    fontWeight: '800',
  },
  nutrientLabel: {
    fontSize: 10,
    fontWeight: '600',
  },
  submitBtn: {
    paddingVertical: 14,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  btnLoadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  submitBtnText: {
    fontSize: fontSize.sm,
    fontWeight: '700',
  },
  errorBox: {
    padding: 10,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  errorText: {
    fontSize: fontSize.xs,
    fontWeight: '600',
  },
});
