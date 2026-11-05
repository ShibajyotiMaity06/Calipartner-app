import { type as inputTypography } from '@calipartner/ui';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import {
  applyNutrientCorrection,
  scaleNutrients,
  type NutrientCorrection,
  type NutrientSnapshot,
  type Food,
  type FoodEntry,
  type MealSection,
} from '@calipartner/core';
import { NutrientEditor, type NutrientDraft } from './NutrientEditor';
import { Sheet, Text, Button, Chip, dark, space, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { AdvancedNutrition } from './AdvancedNutrition';
import { useBrowserModalBack } from '@/hooks/useBrowserModalBack';

export interface QuantityModalProps {
  visible: boolean;
  food: Food | null;
  initialEntry?: FoodEntry | null;
  initialNutrients?: NutrientSnapshot;
  initialQuantity?: number;
  initialUnit?: string;
  defaultSection?: MealSection;
  requireMealChoice?: boolean;
  onClose: () => void;
  onSave: (data: {
    food: Food;
    quantity: number;
    unit: string;
    mealSection: MealSection;
    nutrientOverrides?: NutrientCorrection;
    sharedWithRoom?: boolean;
    taggedPartner?: boolean;
  }) => void | Promise<void>;
  onDelete?: (entryId: string) => void;
}

const COMMON_UNITS = [
  'g',
  'ml',
  'piece',
  'katori',
  'bowl',
  'cup',
  'tbsp',
  'tsp',
  'slice',
  'plate',
  'serving',
];

const PRESET_MULTIPLIERS = [0.5, 1, 1.5, 2];
const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

export function QuantityModal({
  visible,
  food,
  initialEntry,
  initialNutrients,
  initialQuantity,
  initialUnit,
  defaultSection = 'lunch',
  requireMealChoice = false,
  onClose,
  onSave,
  onDelete,
}: QuantityModalProps) {
  useBrowserModalBack(visible, onClose);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const inFlight = useRef(false);
  const [quantityStr, setQuantityStr] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('g');
  const [selectedSection, setSelectedSection] = useState<MealSection | null>(
    requireMealChoice ? null : defaultSection,
  );
  const [nutritionDraft, setNutritionDraft] = useState<NutrientDraft | null>(null);

  useEffect(() => {
    setNutritionDraft(
      initialNutrients
        ? {
            calories: String(initialNutrients.calories),
            protein: String(initialNutrients.protein),
            carbs: String(initialNutrients.carbs),
            fat: String(initialNutrients.fat),
          }
        : null,
    );
    if (initialEntry) {
      setQuantityStr(String(initialEntry.quantity));
      setSelectedUnit(initialEntry.unit);
      setSelectedSection(initialEntry.meal_section);
    } else if (food) {
      setQuantityStr(String(initialQuantity ?? 1));
      const firstUnit = food.serving_units?.[0]?.unit || 'g';
      setSelectedUnit(initialUnit ?? firstUnit);
      setSelectedSection(requireMealChoice ? null : defaultSection);
    }
  }, [
    initialEntry,
    food,
    defaultSection,
    visible,
    initialNutrients,
    initialQuantity,
    initialUnit,
    requireMealChoice,
  ]);
  const overrides = useMemo(
    () =>
      nutritionDraft
        ? (Object.fromEntries(
            Object.entries(nutritionDraft).map(([key, value]) => [
              key,
              value.trim() ? Number(value) : NaN,
            ]),
          ) as NutrientCorrection)
        : undefined,
    [nutritionDraft],
  );

  const parsedQty = parseFloat(quantityStr) || 0;

  // Live Scaled Nutrients Preview
  const preview = useMemo(() => {
    if (!food || parsedQty <= 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 };
    }
    try {
      if (
        food.calories_per_100g === 0 &&
        food.protein_per_100g + food.carbs_per_100g + food.fat_per_100g > 0
      )
        return null;
      return applyNutrientCorrection(scaleNutrients(food, parsedQty, selectedUnit), overrides);
    } catch {
      return null;
    }
  }, [food, parsedQty, selectedUnit, overrides]);

  // Available units for this food (custom serving units + standard)
  const availableUnits = useMemo(() => {
    const list: string[] = [];
    if (food?.serving_units) {
      for (const su of food.serving_units) {
        if (!list.includes(su.unit)) list.push(su.unit);
      }
    }
    for (const u of COMMON_UNITS) {
      if (!list.includes(u)) list.push(u);
    }
    return list;
  }, [food]);

  if (!food) return null;

  const sectionName = selectedSection
    ? t(`diary.sections.${selectedSection}` as Parameters<typeof t>[0])
    : '';
  const actionVerb = initialEntry
    ? t('quantity.saveChanges')
    : selectedSection
      ? t('homeRefresh.addSelection', { meal: sectionName.toLowerCase() })
      : t('foodPolish.chooseMeal');

  const submit = async () => {
    if (inFlight.current || parsedQty <= 0 || !preview || !selectedSection) return;
    inFlight.current = true;
    setSaving(true);
    setSaveFailed(false);
    try {
      await onSave({
        food,
        quantity: parsedQty,
        unit: selectedUnit,
        mealSection: selectedSection,
        ...(overrides ? { nutrientOverrides: overrides } : {}),
        sharedWithRoom: true,
        taggedPartner: false,
      });
      onClose();
    } catch {
      setSaveFailed(true);
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  };
  const handleSave = () => {
    if (inFlight.current || parsedQty <= 0 || !preview || !selectedSection) return;
    if (preview.calories > 3200) {
      if (Platform.OS === 'web') {
        const browser = globalThis as unknown as { confirm?: (message: string) => boolean };
        if (browser.confirm?.(t('homeRefresh.portionQuestion', { calories: preview.calories })))
          void submit();
        return;
      }
      Alert.alert(
        t('homeRefresh.confirmPortion'),
        t('homeRefresh.portionQuestion', { calories: preview.calories }),
        [
          { text: t('homeRefresh.editPortion'), style: 'cancel' },
          { text: t('common.save'), onPress: () => void submit() },
        ],
      );
      return;
    }
    void submit();
  };

  const handleDelete = () => {
    if (!initialEntry || !onDelete) return;
    Alert.alert(t('quantity.deleteButton'), t('quantity.confirmDelete'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('common.delete'),
        style: 'destructive',
        onPress: () => {
          onDelete(initialEntry.id);
          onClose();
        },
      },
    ]);
  };

  return (
    <Sheet
      visible={visible}
      onClose={() => {
        if (!inFlight.current) onClose();
      }}
      snapPoint="tall"
      testID="modal-quantity"
      accessibilityLabel={`Log ${food.name}`}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.header}>
            <Text variant="heading" color={dark.textHi}>
              {food.name}
            </Text>
            {food.brand ? (
              <Text variant="bodyS" color={dark.textMid}>
                {food.brand}
              </Text>
            ) : null}
          </View>

          {/* Meal Section Selector */}
          <View style={styles.sectionPickerWrap}>
            <Text variant="label" color={dark.textLo} style={styles.previewLabel}>
              {t('foodPolish.chooseMeal')}
            </Text>
            <View style={styles.sectionChipsRow}>
              {SECTIONS.map((sec) => (
                <Chip
                  key={sec}
                  label={t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                  selected={selectedSection === sec}
                  onPress={() => setSelectedSection(sec)}
                  testID={`section-picker-${sec}`}
                />
              ))}
            </View>
          </View>

          {/* Big Editable Number (numeralXL) with Preset Multipliers above */}
          <View style={styles.quantitySection}>
            <View style={styles.presetRow}>
              {PRESET_MULTIPLIERS.map((mult) => (
                <Pressable
                  key={mult}
                  testID={`btn-preset-${mult}`}
                  onPress={() => setQuantityStr(String(mult))}
                  style={[
                    styles.presetPill,
                    parseFloat(quantityStr) === mult && styles.presetPillSelected,
                  ]}
                >
                  <Text
                    variant="label"
                    color={parseFloat(quantityStr) === mult ? dark.onBrand : dark.textMid}
                  >
                    {mult}×
                  </Text>
                </Pressable>
              ))}
            </View>

            <View style={styles.bigNumberInputRow}>
              <TextInput
                testID="input-quantity-amount"
                value={quantityStr}
                onChangeText={setQuantityStr}
                keyboardType="decimal-pad"
                placeholder="1"
                placeholderTextColor={dark.textLo}
                style={[styles.bigNumberInput, { fontFamily: inputTypography.body.fontFamily }]}
              />
              <Text variant="heading" color={dark.textMid} style={styles.unitSuffix}>
                {selectedUnit}
              </Text>
            </View>
          </View>

          {/* Unit Selector Chips */}
          <View style={styles.unitScrollWrap}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.unitList}
            >
              {availableUnits.map((u) => {
                const isSelected = selectedUnit.toLowerCase() === u.toLowerCase();
                return (
                  <Chip
                    key={u}
                    label={u}
                    selected={isSelected}
                    onPress={() => setSelectedUnit(u)}
                    testID={`unit-pill-${u}`}
                  />
                );
              })}
            </ScrollView>
          </View>

          <View style={{ gap: space[3] }}>
            <Text variant="heading">{t('foodPolish.nutritionTitle')}</Text>
            <Text variant="bodyS">{t('foodPolish.nutritionHint')}</Text>
            {nutritionDraft ? (
              <>
                <NutrientEditor
                  draft={nutritionDraft}
                  disabled={saving}
                  onChange={(metric, value) =>
                    setNutritionDraft((current) =>
                      current ? { ...current, [metric]: value } : current,
                    )
                  }
                />
                <Button
                  variant="tertiary"
                  label={t('foodPolish.resetNutrition')}
                  onPress={() => setNutritionDraft(null)}
                  testID="reset-nutrition"
                />
                {!preview && (
                  <Text color={dark.danger} accessibilityRole="alert">
                    {t('foodPolish.invalidNutrition')}
                  </Text>
                )}
              </>
            ) : (
              <Button
                variant="secondary"
                label={t('foodPolish.editNutrition')}
                onPress={() => {
                  if (preview)
                    setNutritionDraft({
                      calories: String(preview.calories),
                      protein: String(preview.protein),
                      carbs: String(preview.carbs),
                      fat: String(preview.fat),
                    });
                }}
                testID="edit-nutrition"
              />
            )}
          </View>
          {/* Live Macro Preview */}
          {preview ? (
            <View style={styles.previewBox} testID="preview-nutrients">
              <View style={styles.previewHeader}>
                <Text variant="label" color={dark.textLo} style={styles.previewLabel}>
                  NUTRITION PREVIEW
                </Text>
                <Text nutrient="calories" variant="numeralM" color={dark.textHi}>
                  {preview.calories}{' '}
                  <Text nutrient="calories" variant="bodyS" color={dark.textMid}>
                    kcal
                  </Text>
                </Text>
              </View>

              {/* Three macro segment bars in identity steps */}
              <View style={styles.macroValuesRow}>
                <View style={styles.macroPill}>
                  <View style={[styles.macroDot, { backgroundColor: dark.iris }]} />
                  <Text nutrient="protein" variant="label" color={dark.textMid}>
                    P:{' '}
                    <Text nutrient="protein" variant="bodyS" color={dark.textHi}>
                      {preview.protein}g
                    </Text>
                  </Text>
                </View>

                <View style={styles.macroPill}>
                  <View style={[styles.macroDot, { backgroundColor: dark.teal }]} />
                  <Text nutrient="carbs" variant="label" color={dark.textMid}>
                    C:{' '}
                    <Text nutrient="carbs" variant="bodyS" color={dark.textHi}>
                      {preview.carbs}g
                    </Text>
                  </Text>
                </View>

                <View style={styles.macroPill}>
                  <View style={[styles.macroDot, { backgroundColor: dark.rose }]} />
                  <Text nutrient="fat" variant="label" color={dark.textMid}>
                    F:{' '}
                    <Text nutrient="fat" variant="bodyS" color={dark.textHi}>
                      {preview.fat}g
                    </Text>
                  </Text>
                </View>
              </View>
            </View>
          ) : (
            <Text accessibilityRole="alert">{t('fixNovember.energyMissing')}</Text>
          )}

          {preview && <AdvancedNutrition nutrients={preview} />}

          {saveFailed && (
            <Text color={dark.danger} accessibilityRole="alert" testID="quantity-save-error">
              {t('fixNovember.saveFailed')}
            </Text>
          )}
          {/* Primary Action Button */}
          <View style={styles.footerButtons}>
            <Button
              testID="btn-submit-quantity"
              variant="primary"
              label={actionVerb}
              disabled={parsedQty <= 0 || saving || !preview || !selectedSection}
              loading={saving}
              onPress={handleSave}
            />

            {initialEntry && onDelete && (
              <Button
                testID="btn-delete-entry-modal"
                variant="destructive"
                label={t('quantity.deleteButton')}
                onPress={handleDelete}
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: space[4],
    paddingBottom: space[8],
    gap: space[4],
  },
  header: {
    gap: space[1],
  },
  quantitySection: {
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  presetRow: {
    flexDirection: 'row',
    gap: space[2],
  },
  presetPill: {
    paddingHorizontal: space[3],
    paddingVertical: space[1],
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  presetPillSelected: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  bigNumberInputRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'center',
    gap: space[2],
  },
  bigNumberInput: {
    fontSize: 44,
    fontWeight: '800',
    color: dark.textHi,
    textAlign: 'center',
    minWidth: 100,
    paddingVertical: space[1],
  },
  unitSuffix: {
    paddingBottom: space[2],
  },
  unitScrollWrap: {
    flexDirection: 'row',
  },
  unitList: {
    gap: space[2],
  },
  previewBox: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  previewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewLabel: {
    letterSpacing: 1,
  },
  macroValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  macroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[2],
    backgroundColor: dark.s2,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    borderRadius: radius.full,
  },
  macroDot: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  sectionPickerWrap: {
    gap: space[2],
  },
  sectionChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  switchRowsContainer: {
    gap: space[1],
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    paddingVertical: space[2],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  footerButtons: {
    gap: space[2],
    paddingTop: space[2],
  },
});
