import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  applyNutrientCorrection,
  savedMealTotals,
  scaleNutrients,
  sumNutrientSnapshots,
  type Food,
  type MealSection,
  type MealSelection,
} from '@calipartner/core';
import {
  Chip,
  CloseIcon,
  PlusIcon,
  PrimaryButton,
  SearchIcon,
  Text,
  borders,
  colors,
  fonts,
  layout,
  radius,
  space,
} from '@calipartner/ui/v1';
import { useAuth } from '@/contexts/AuthContext';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';
import { useFoodSearch } from '@/hooks/useFoodSearch';
import { usePreviouslyLogged } from '@/hooks/usePreviouslyLogged';
import { t } from '@/i18n';
import { generateClientUuid } from '@/services/foodService';
import { saveMyMeal } from '@/services/myMealsService';
import { QuantityModal } from './QuantityModal';

export interface CreateMealModalProps {
  visible: boolean;
  initialSelection?: MealSelection[];
  defaultSection?: MealSection;
  onClose: () => void;
  onSaved?: () => void;
}

const DEFAULT_SLOTS: readonly MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks'];

export function CreateMealModal({
  visible,
  initialSelection = [],
  defaultSection = 'breakfast',
  onClose,
  onSaved,
}: CreateMealModalProps) {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { query, setQuery, results: searchResults, loading: searchLoading } = useFoodSearch();
  const { items: historyItems } = usePreviouslyLogged();

  const [name, setName] = useState('');
  const [items, setItems] = useState<MealSelection[]>(initialSelection);
  const [defaultMeal, setDefaultMeal] = useState<MealSection>(
    DEFAULT_SLOTS.includes(defaultSection) ? defaultSection : 'breakfast',
  );
  const [pickingFood, setPickingFood] = useState(false);
  const [quantityFood, setQuantityFood] = useState<Food | null>(null);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const clientMealId = useRef(generateClientUuid());
  const savingRef = useRef(false);

  useEffect(() => {
    if (visible) {
      setItems(initialSelection);
      setDefaultMeal(DEFAULT_SLOTS.includes(defaultSection) ? defaultSection : 'breakfast');
      setName('');
      setErrorMsg(null);
      setPickingFood(false);
      setQuantityFood(null);
      setEditingIndex(null);
      clientMealId.current = generateClientUuid();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleClose = () => {
    if (!savingRef.current) onClose();
  };
  useBrowserModalBack(visible && !pickingFood && !quantityFood, handleClose);

  const computedSnapshots = useMemo(
    () =>
      items.map((item) => {
        const scaled = scaleNutrients(item.food, item.quantity, item.unit);
        return item.nutrientOverrides
          ? applyNutrientCorrection(scaled, item.nutrientOverrides)
          : scaled;
      }),
    [items],
  );

  const totals = useMemo(() => {
    const raw = sumNutrientSnapshots(computedSnapshots);
    return savedMealTotals(
      computedSnapshots.map((s, idx) => ({
        food_id: items[idx]?.food.id ?? String(idx),
        food_name: items[idx]?.food.name ?? 'Food',
        quantity: items[idx]?.quantity ?? 100,
        unit: items[idx]?.unit ?? 'g',
        calories: raw ? s.calories : 0,
        protein: s.protein,
        carbs: s.carbs,
        fat: s.fat,
      })),
    );
  }, [computedSnapshots, items]);

  const handleSave = async () => {
    if (savingRef.current) return;
    if (!user?.id) {
      setErrorMsg(t('common.errorBody'));
      return;
    }
    if (!name.trim()) {
      setErrorMsg(t('foodPolish.nameRequired'));
      return;
    }
    if (items.length === 0) {
      setErrorMsg(t('launch.mealEmpty'));
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setErrorMsg(null);
    try {
      await saveMyMeal(user.id, clientMealId.current, name.trim(), items, defaultMeal);
      onSaved?.();
      onClose();
    } catch {
      setErrorMsg(t('launch.mealError'));
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  const pickerFoods = useMemo(() => {
    if (query.trim().length > 0) return searchResults;
    return historyItems.map((h) => h.food);
  }, [query, searchResults, historyItems]);

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={handleClose}>
      <View style={styles.root} testID="modal-create-meal">
        <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
          <Pressable
            onPress={handleClose}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={t('common.cancel')}
            style={({ pressed }) => [styles.closeCircle, pressed ? styles.circlePressed : null]}
            testID="btn-close-create-meal"
          >
            <CloseIcon size={17} color={colors.textMid} />
          </Pressable>
          <Text
            variant="titleS"
            color="textHi"
            accessibilityRole="header"
            style={styles.headerTitle}
          >
            {t('captureV1.newMealTitle')}
          </Text>
          <Pressable
            onPress={() => void handleSave()}
            disabled={saving}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('captureV1.newFoodSaveOnly')}
            style={styles.topSaveBtn}
            testID="btn-header-save-meal"
          >
            <Text variant="label" color="apricot" style={styles.topSaveText}>
              {saving ? t('common.saving') : t('captureV1.newFoodSaveOnly')}
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.scrollContent, { paddingBottom: space.xl }]}
        >
          <View style={styles.innerWrap}>
            {errorMsg ? (
              <Text variant="meta" color="danger" accessibilityRole="alert">
                {errorMsg}
              </Text>
            ) : null}

            {/* Meal name */}
            <View style={styles.fieldGroup}>
              <Text variant="meta" color="textLo" style={styles.fieldLabel}>
                {t('captureV1.newMealNameLabel')}
              </Text>
              <View style={styles.inputBox}>
                <TextInput
                  testID="input-create-meal-name"
                  value={name}
                  onChangeText={setName}
                  maxLength={100}
                  placeholder={t('captureV1.newMealNamePlaceholder')}
                  placeholderTextColor={colors.textOff}
                  style={styles.textInput}
                />
              </View>
            </View>

            {/* INGREDIENTS */}
            <View style={styles.fieldGroup}>
              <Text variant="eyebrow" color="textLo" style={styles.fieldLabel}>
                {t('captureV1.newMealIngredientsEyebrow')}
              </Text>
              <View style={styles.ingredientsCard}>
                {items.map((item, idx) => {
                  const snap = computedSnapshots[idx];
                  return (
                    <View
                      key={`${item.food.id}-${idx}`}
                      style={[styles.ingredientRow, styles.rowDivider]}
                    >
                      <Pressable
                        onPress={() => {
                          setEditingIndex(idx);
                          setQuantityFood(item.food);
                        }}
                        style={styles.ingredientCopy}
                        testID={`btn-edit-ingredient-${idx}`}
                      >
                        <Text variant="label" color="textHi" style={styles.ingredientTitle}>
                          {item.food.name}
                        </Text>
                        <Text variant="meta" color="textLo" tabular>
                          {`${item.quantity} ${item.unit}`}
                        </Text>
                      </Pressable>

                      <View style={styles.ingredientRight}>
                        <Text variant="label" color="textHi" tabular style={styles.ingredientKcal}>
                          {String(Math.round(snap?.calories ?? 0))}
                          <Text variant="meta" color="textLo">
                            {' kcal'}
                          </Text>
                        </Text>
                        <Pressable
                          onPress={() =>
                            setItems((prev) => prev.filter((_, itemIdx) => itemIdx !== idx))
                          }
                          hitSlop={10}
                          accessibilityRole="button"
                          accessibilityLabel={`Remove ${item.food.name}`}
                          testID={`btn-remove-ingredient-${idx}`}
                        >
                          <CloseIcon size={15} color={colors.textLo} />
                        </Pressable>
                      </View>
                    </View>
                  );
                })}

                <Pressable
                  onPress={() => {
                    setQuery('');
                    setPickingFood(true);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('captureV1.newMealAddFood')}
                  style={({ pressed }) => [styles.addFoodRow, pressed ? styles.rowPressed : null]}
                  testID="btn-create-meal-add-food"
                >
                  <PlusIcon size={16} color={colors.apricot} />
                  <Text variant="label" color="apricot" style={styles.addFoodLabel}>
                    {t('captureV1.newMealAddFood').replace(/^\+\s*/, '')}
                  </Text>
                </Pressable>
              </View>
            </View>

            {/* Total Summary Card */}
            <View style={styles.totalCard}>
              <View style={styles.totalLeft}>
                <Text variant="meta" color="textLo">
                  {t('captureV1.newMealTotalLabel')}
                </Text>
                <View style={styles.totalNumRow}>
                  <Text variant="numM" color="textHi" tabular testID="create-meal-total-kcal">
                    {Math.round(totals.total_calories).toLocaleString('en-US')}
                  </Text>
                  <Text variant="meta" color="textLo" style={styles.unitInline}>
                    {' kcal'}
                  </Text>
                </View>
              </View>

              <View style={styles.macroPillsRow}>
                <View style={styles.macroPill}>
                  <Text variant="meta" color="textHi" tabular>
                    {`P ${Math.round(totals.total_protein)}`}
                  </Text>
                </View>
                <View style={styles.macroPill}>
                  <Text variant="meta" color="textHi" tabular>
                    {`C ${Math.round(totals.total_carbs)}`}
                  </Text>
                </View>
                <View style={styles.macroPill}>
                  <Text variant="meta" color="textHi" tabular>
                    {`F ${Math.round(totals.total_fat)}`}
                  </Text>
                </View>
              </View>
            </View>

            {/* DEFAULT MEAL */}
            <View style={styles.fieldGroup}>
              <Text variant="eyebrow" color="textLo" style={styles.fieldLabel}>
                {t('captureV1.newMealDefaultEyebrow')}
              </Text>
              <View style={styles.defaultMealRow}>
                {DEFAULT_SLOTS.map((slot) => (
                  <Chip
                    key={slot}
                    label={t(`diary.sections.${slot}`)}
                    selected={defaultMeal === slot}
                    onPress={() => setDefaultMeal(slot)}
                    testID={`create-meal-default-${slot}`}
                  />
                ))}
              </View>
            </View>
          </View>
        </ScrollView>

        <View
          style={[
            styles.bottomBar,
            { paddingBottom: Math.max(space.lg, insets.bottom + space.md) },
          ]}
        >
          <View style={styles.innerWrap}>
            <PrimaryButton
              title={saving ? t('common.saving') : t('captureV1.newMealSaveCta')}
              showArrow={!saving}
              loading={saving}
              disabled={saving || !name.trim() || items.length === 0}
              onPress={() => void handleSave()}
              testID="btn-save-create-meal"
            />
          </View>
        </View>

        {/* Inline Food Picker Modal for Ingredients */}
        <Modal
          visible={pickingFood}
          animationType="slide"
          onRequestClose={() => setPickingFood(false)}
        >
          <View style={styles.root}>
            <View style={[styles.topBar, { paddingTop: Math.max(space.sm, insets.top + 6) }]}>
              <Pressable
                onPress={() => setPickingFood(false)}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel={t('common.cancel')}
                style={styles.closeCircle}
              >
                <CloseIcon size={17} color={colors.textMid} />
              </Pressable>
              <Text variant="titleS" color="textHi" style={styles.headerTitle}>
                {t('captureV1.newMealPickFoodTitle')}
              </Text>
              <View style={styles.headerSpacer} />
            </View>

            <View style={styles.pickerSearchWrap}>
              <View style={styles.searchBar}>
                <SearchIcon size={18} color={colors.textLo} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder={t('captureV1.searchYourFoods')}
                  placeholderTextColor={colors.textLo}
                  style={styles.searchInput}
                  testID="input-create-meal-food-search"
                />
              </View>
            </View>

            <ScrollView
              contentContainerStyle={[
                styles.pickerList,
                { paddingBottom: Math.max(space.xl, insets.bottom + space.md) },
              ]}
              keyboardShouldPersistTaps="handled"
            >
              {searchLoading ? (
                <ActivityIndicator color={colors.apricot} style={styles.pickerLoader} />
              ) : pickerFoods.length === 0 ? (
                <Text variant="body" color="textLo" style={styles.emptySearchText}>
                  {t('foodLog.noResultsTitle')}
                </Text>
              ) : (
                pickerFoods.map((f) => {
                  const baseUnit = f.serving_units?.[0];
                  const kcal = baseUnit
                    ? Math.round((f.calories_per_100g * baseUnit.grams) / 100)
                    : Math.round(f.calories_per_100g);
                  return (
                    <Pressable
                      key={f.id}
                      onPress={() => {
                        setPickingFood(false);
                        setEditingIndex(null);
                        setQuantityFood(f);
                      }}
                      style={({ pressed }) => [
                        styles.pickerRow,
                        pressed ? styles.rowPressed : null,
                      ]}
                      testID={`pick-meal-food-${f.id}`}
                    >
                      <View style={styles.ingredientCopy}>
                        <Text variant="label" color="textHi" style={styles.ingredientTitle}>
                          {f.name}
                        </Text>
                        <Text variant="meta" color="textLo">
                          {baseUnit
                            ? `1 ${baseUnit.unit} · ${Math.round(baseUnit.grams)} g`
                            : '100 g'}
                        </Text>
                      </View>
                      <Text variant="label" color="textHi" tabular>
                        {`${kcal} kcal`}
                      </Text>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </View>
        </Modal>

        {quantityFood ? (
          <QuantityModal
            visible
            food={quantityFood}
            defaultSection={defaultMeal}
            initialQuantity={editingIndex != null ? items[editingIndex]?.quantity : undefined}
            initialUnit={editingIndex != null ? items[editingIndex]?.unit : undefined}
            requireMealChoice={false}
            onClose={() => {
              setQuantityFood(null);
              setEditingIndex(null);
            }}
            onSave={async (data) => {
              const entry: MealSelection = {
                food: data.food,
                quantity: data.quantity,
                unit: data.unit,
                nutrientOverrides: data.nutrientOverrides,
              };
              setItems((prev) =>
                editingIndex != null
                  ? prev.map((it, idx) => (idx === editingIndex ? entry : it))
                  : [...prev, entry],
              );
              setQuantityFood(null);
              setEditingIndex(null);
            }}
          />
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg0,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  closeCircle: {
    width: 40,
    height: 40,
    borderRadius: radius.full,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circlePressed: {
    backgroundColor: colors.s2,
  },
  headerTitle: {
    fontFamily: fonts.semibold,
    fontSize: 17,
  },
  headerSpacer: {
    width: 40,
    height: 40,
  },
  topSaveBtn: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  topSaveText: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  scrollContent: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.xs,
  },
  innerWrap: {
    width: '100%',
    maxWidth: 440,
    alignSelf: 'center',
    gap: space.md,
  },
  fieldGroup: {
    gap: space.xs + 2,
  },
  fieldLabel: {
    paddingHorizontal: 2,
  },
  inputBox: {
    height: 50,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
  },
  textInput: {
    flex: 1,
    fontFamily: fonts.medium,
    fontSize: 15,
    color: colors.textHi,
    paddingVertical: 0,
  },
  ingredientsCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    overflow: 'hidden',
  },
  ingredientRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 1,
    gap: space.md,
  },
  rowDivider: {
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
  },
  ingredientCopy: {
    flex: 1,
    gap: 2,
  },
  ingredientTitle: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
  },
  ingredientKcal: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  addFoodRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.md + 2,
    minHeight: 50,
  },
  addFoodLabel: {
    fontFamily: fonts.semibold,
    fontSize: 15,
  },
  rowPressed: {
    backgroundColor: colors.s2,
  },
  totalCard: {
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    borderRadius: radius.card,
    padding: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
  },
  totalLeft: {
    gap: space.xs,
  },
  totalNumRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  unitInline: {
    marginBottom: 2,
  },
  macroPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.xs + 2,
    justifyContent: 'flex-end',
  },
  macroPill: {
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    borderRadius: radius.full,
    backgroundColor: colors.s2,
    borderWidth: borders.width,
    borderColor: colors.hairline,
  },
  defaultMealRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  bottomBar: {
    paddingHorizontal: layout.screenPaddingX,
    paddingTop: space.md,
    backgroundColor: colors.bg0,
  },
  pickerSearchWrap: {
    paddingHorizontal: layout.screenPaddingX,
    paddingBottom: space.md,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.s1,
    borderWidth: borders.width,
    borderColor: colors.hairline,
    paddingHorizontal: space.md,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.textHi,
    paddingVertical: 0,
  },
  pickerList: {
    paddingHorizontal: layout.screenPaddingX,
  },
  pickerLoader: {
    marginTop: space.xl,
  },
  emptySearchText: {
    textAlign: 'center',
    paddingVertical: space.xl,
  },
  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space.md,
    borderBottomWidth: borders.width,
    borderBottomColor: colors.hairline,
    gap: space.md,
  },
});
