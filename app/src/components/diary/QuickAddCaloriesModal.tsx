import React, { useState } from 'react';
import { View, StyleSheet, TextInput, ScrollView } from 'react-native';
import type { Food, MealSection } from '@calipartner/core';
import { Sheet, Text, Button, Chip, dark, space, radius } from '@calipartner/ui';
import { generateClientUuid } from '@/services/foodService';
import { t } from '@/i18n';

export interface QuickAddCaloriesModalProps {
  visible: boolean;
  defaultSection: MealSection;
  onClose: () => void;
  onSave: (food: Food, quantity: number, unit: string, section: MealSection) => Promise<void>;
}

const SECTIONS: MealSection[] = ['breakfast', 'lunch', 'dinner', 'snacks', 'extra'];

export function QuickAddCaloriesModal({
  visible,
  defaultSection,
  onClose,
  onSave,
}: QuickAddCaloriesModalProps) {
  const [caloriesStr, setCaloriesStr] = useState('');
  const [proteinStr, setProteinStr] = useState('');
  const [carbsStr, setCarbsStr] = useState('');
  const [fatStr, setFatStr] = useState('');
  const [selectedSection, setSelectedSection] = useState<MealSection>(defaultSection);
  const [isSaving, setIsSaving] = useState(false);

  const calNumber = parseInt(caloriesStr, 10) || 0;
  const pNumber = parseFloat(proteinStr) || 0;
  const cNumber = parseFloat(carbsStr) || 0;
  const fNumber = parseFloat(fatStr) || 0;

  const sectionName = t(`diary.sections.${selectedSection}` as Parameters<typeof t>[0]);

  const handleSave = async () => {
    if (calNumber <= 0 || isSaving) return;
    setIsSaving(true);
    try {
      const quickFood: Food = {
        id: generateClientUuid(),
        source: 'user',
        name: 'Quick add',
        brand: null,
        barcode: null,
        serving_units: [{ unit: 'serving', grams: 100 }],
        calories_per_100g: calNumber,
        protein_per_100g: pNumber,
        carbs_per_100g: cNumber,
        fat_per_100g: fNumber,
        fiber_per_100g: 0,
        sugar_per_100g: 0,
        sodium_mg_per_100g: 0,
        owner_id: null,
        attribution: null,
      };

      await onSave(quickFood, 1, 'serving', selectedSection);
      onClose();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      testID="sheet-quick-add-calories"
      accessibilityLabel={`Quick add calories to ${sectionName}`}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text variant="heading" color={dark.textHi}>
            Quick Add
          </Text>
          <Text variant="bodyS" color={dark.textMid}>
            {"Log calories directly when you don't know the exact food"}
          </Text>
        </View>

        {/* Meal Selector Chips */}
        <View style={styles.sectionRow}>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.chipScroll}
          >
            {SECTIONS.map((sec) => (
              <Chip
                key={sec}
                label={t(`diary.sections.${sec}` as Parameters<typeof t>[0])}
                selected={selectedSection === sec}
                onPress={() => setSelectedSection(sec)}
                testID={`chip-quick-section-${sec}`}
              />
            ))}
          </ScrollView>
        </View>

        {/* Calories Input */}
        <View style={styles.fieldBox}>
          <Text variant="label" color={dark.textMid}>
            CALORIES (KCAL) *
          </Text>
          <TextInput
            testID="input-quick-calories"
            value={caloriesStr}
            onChangeText={setCaloriesStr}
            placeholder="e.g. 350"
            placeholderTextColor={dark.textLo}
            keyboardType="number-pad"
            style={styles.numericInput}
          />
        </View>

        {/* Optional Macros Inputs */}
        <View style={styles.fieldBox}>
          <Text variant="label" color={dark.textMid}>
            OPTIONAL MACROS (GRAMS)
          </Text>
          <View style={styles.macroInputsRow}>
            <View style={styles.macroField}>
              <Text variant="bodyS" color={dark.textLo}>
                Protein (g)
              </Text>
              <TextInput
                testID="input-quick-protein"
                value={proteinStr}
                onChangeText={setProteinStr}
                placeholder="0"
                placeholderTextColor={dark.textLo}
                keyboardType="decimal-pad"
                style={styles.macroInput}
              />
            </View>

            <View style={styles.macroField}>
              <Text variant="bodyS" color={dark.textLo}>
                Carbs (g)
              </Text>
              <TextInput
                testID="input-quick-carbs"
                value={carbsStr}
                onChangeText={setCarbsStr}
                placeholder="0"
                placeholderTextColor={dark.textLo}
                keyboardType="decimal-pad"
                style={styles.macroInput}
              />
            </View>

            <View style={styles.macroField}>
              <Text variant="bodyS" color={dark.textLo}>
                Fat (g)
              </Text>
              <TextInput
                testID="input-quick-fat"
                value={fatStr}
                onChangeText={setFatStr}
                placeholder="0"
                placeholderTextColor={dark.textLo}
                keyboardType="decimal-pad"
                style={styles.macroInput}
              />
            </View>
          </View>
        </View>

        {/* Submit Button */}
        <View style={styles.buttonWrap}>
          <Button
            testID="btn-submit-quick-add"
            variant="primary"
            label={`Add to ${sectionName.toLowerCase()}`}
            disabled={calNumber <= 0 || isSaving}
            onPress={handleSave}
          />
        </View>
      </ScrollView>
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
  sectionRow: {
    flexDirection: 'row',
  },
  chipScroll: {
    gap: space[2],
  },
  fieldBox: {
    gap: space[2],
  },
  numericInput: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[4],
    paddingVertical: space[3],
    fontSize: 22,
    color: dark.textHi,
  },
  macroInputsRow: {
    flexDirection: 'row',
    gap: space[3],
  },
  macroField: {
    flex: 1,
    gap: space[1],
  },
  macroInput: {
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    borderRadius: radius.control,
    paddingHorizontal: space[3],
    paddingVertical: space[2],
    fontSize: 16,
    color: dark.textHi,
  },
  buttonWrap: {
    paddingTop: space[4],
  },
});
