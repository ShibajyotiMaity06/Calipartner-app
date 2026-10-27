import React, { useEffect, useMemo, useState } from 'react';
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
import { scaleNutrients, type Food, type FoodEntry, type MealSection } from '@calipartner/core';
import { Sheet, Text, Button, Chip, SwitchRow, dark, space, radius } from '@calipartner/ui';
import { t } from '@/i18n';
import { AdvancedNutrition } from './AdvancedNutrition';

export interface QuantityModalProps {
  visible: boolean;
  food: Food | null;
  initialEntry?: FoodEntry | null;
  defaultSection?: MealSection;
  onClose: () => void;
  onSave: (data: {
    food: Food;
    quantity: number;
    unit: string;
    mealSection: MealSection;
    sharedWithRoom?: boolean;
    taggedPartner?: boolean;
  }) => void;
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
  defaultSection = 'lunch',
  onClose,
  onSave,
  onDelete,
}: QuantityModalProps) {
  const [quantityStr, setQuantityStr] = useState('1');
  const [selectedUnit, setSelectedUnit] = useState('g');
  const [selectedSection, setSelectedSection] = useState<MealSection>(defaultSection);
  const [shareWithRoom, setShareWithRoom] = useState(true);
  const [someoneElseAte, setSomeoneElseAte] = useState(false);

  useEffect(() => {
    if (initialEntry) {
      setQuantityStr(String(initialEntry.quantity));
      setSelectedUnit(initialEntry.unit);
      setSelectedSection(initialEntry.meal_section);
    } else if (food) {
      setQuantityStr('1');
      const firstUnit = food.serving_units?.[0]?.unit || 'g';
      setSelectedUnit(firstUnit);
      setSelectedSection(defaultSection);
      setShareWithRoom(true);
      setSomeoneElseAte(false);
    }
  }, [initialEntry, food, defaultSection, visible]);

  const parsedQty = parseFloat(quantityStr) || 0;

  // Live Scaled Nutrients Preview
  const preview = useMemo(() => {
    if (!food || parsedQty <= 0) {
      return { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, sugar: 0, sodium_mg: 0 };
    }
    return scaleNutrients(food, parsedQty, selectedUnit);
  }, [food, parsedQty, selectedUnit]);

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

  const sectionName = t(`diary.sections.${selectedSection}` as Parameters<typeof t>[0]);
  const actionVerb = initialEntry
    ? t('quantity.saveChanges')
    : `Add to ${sectionName.toLowerCase()}`;

  const handleSave = () => {
    if (parsedQty <= 0) return;

    if (preview.calories > 3200) {
      Alert.alert('Confirm Portion', `That is ${preview.calories} kcal. Is that right?`, [
        { text: 'Edit portion', style: 'cancel' },
        {
          text: 'Yes, save',
          onPress: () => {
            onSave({
              food,
              quantity: parsedQty,
              unit: selectedUnit,
              mealSection: selectedSection,
              sharedWithRoom: shareWithRoom,
              taggedPartner: someoneElseAte,
            });
            onClose();
          },
        },
      ]);
      return;
    }

    onSave({
      food,
      quantity: parsedQty,
      unit: selectedUnit,
      mealSection: selectedSection,
      sharedWithRoom: shareWithRoom,
      taggedPartner: someoneElseAte,
    });
    onClose();
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
      onClose={onClose}
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
                style={styles.bigNumberInput}
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

          {/* Live Macro Preview Box with CMP-13 Identity Steps */}
          <View style={styles.previewBox} testID="preview-nutrients">
            <View style={styles.previewHeader}>
              <Text variant="label" color={dark.textLo} style={styles.previewLabel}>
                NUTRITION PREVIEW
              </Text>
              <Text variant="numeralM" color={dark.textHi}>
                {preview.calories}{' '}
                <Text variant="bodyS" color={dark.textMid}>
                  kcal
                </Text>
              </Text>
            </View>

            {/* Three macro segment bars in identity steps */}
            <View style={styles.macroValuesRow}>
              <View style={styles.macroPill}>
                <View style={[styles.macroDot, { backgroundColor: dark.iris }]} />
                <Text variant="label" color={dark.textMid}>
                  P:{' '}
                  <Text variant="bodyS" color={dark.textHi}>
                    {preview.protein}g
                  </Text>
                </Text>
              </View>

              <View style={styles.macroPill}>
                <View style={[styles.macroDot, { backgroundColor: dark.teal }]} />
                <Text variant="label" color={dark.textMid}>
                  C:{' '}
                  <Text variant="bodyS" color={dark.textHi}>
                    {preview.carbs}g
                  </Text>
                </Text>
              </View>

              <View style={styles.macroPill}>
                <View style={[styles.macroDot, { backgroundColor: dark.rose }]} />
                <Text variant="label" color={dark.textMid}>
                  F:{' '}
                  <Text variant="bodyS" color={dark.textHi}>
                    {preview.fat}g
                  </Text>
                </Text>
              </View>
            </View>
          </View>

          <AdvancedNutrition nutrients={preview} />

          {/* Meal Section Selector */}
          <View style={styles.sectionPickerWrap}>
            <Text variant="label" color={dark.textLo} style={styles.previewLabel}>
              MEAL SECTION
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

          {/* Switch Rows (D03, SHR-1) */}
          <View style={styles.switchRowsContainer}>
            <SwitchRow
              title="Share with my room"
              consequence="Partners can see this meal in the room feed."
              value={shareWithRoom}
              onValueChange={setShareWithRoom}
              testID="switch-share-room"
            />
            <SwitchRow
              title="Someone else ate this too"
              consequence="Send a pending meal suggestion to your partner."
              value={someoneElseAte}
              onValueChange={setSomeoneElseAte}
              testID="switch-someone-else-ate"
            />
          </View>

          {/* Primary Action Button */}
          <View style={styles.footerButtons}>
            <Button
              testID="btn-submit-quantity"
              variant="primary"
              label={actionVerb}
              disabled={parsedQty <= 0}
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
