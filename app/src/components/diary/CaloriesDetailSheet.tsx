import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import type { FoodEntry } from '@calipartner/core';
import { Sheet, Text, CalorieRing, dark, space, radius, type IdentityHue } from '@calipartner/ui';
import { t } from '@/i18n';

export interface CaloriesDetailSheetProps {
  visible: boolean;
  onClose: () => void;
  eatenCalories: number;
  targetCalories: number;
  proteinGrams: number;
  targetProtein: number;
  carbGrams: number;
  targetCarbs: number;
  fatGrams: number;
  targetFat: number;
  fiberGrams?: number;
  sugarGrams?: number;
  sodiumMg?: number;
  entries?: FoodEntry[];
  identityHue?: IdentityHue;
}

type MacroType = 'protein' | 'carbs' | 'fat' | null;

export function CaloriesDetailSheet({
  visible,
  onClose,
  eatenCalories,
  targetCalories,
  proteinGrams,
  targetProtein,
  carbGrams,
  targetCarbs,
  fatGrams,
  targetFat,
  fiberGrams = 0,
  sugarGrams = 0,
  sodiumMg = 0,
  entries = [],
  identityHue = 'iris',
}: CaloriesDetailSheetProps) {
  const [selectedMacro, setSelectedMacro] = useState<MacroType>(null);

  const remainingCalories = Math.max(0, targetCalories - eatenCalories);
  const isOver = eatenCalories > targetCalories && targetCalories > 0;
  const overAmount = isOver ? eatenCalories - targetCalories : 0;

  // Filter top contributing foods for selected macro
  const contributingFoods = React.useMemo(() => {
    if (!selectedMacro || entries.length === 0) return [];
    return [...entries]
      .sort((a, b) => {
        const valA = a[selectedMacro] ?? 0;
        const valB = b[selectedMacro] ?? 0;
        return valB - valA;
      })
      .slice(0, 5);
  }, [entries, selectedMacro]);

  const handleToggleMacro = (macro: MacroType) => {
    setSelectedMacro((prev) => (prev === macro ? null : macro));
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      testID="sheet-calories-detail"
      accessibilityLabel={t('diary.calorieRingA11y', {
        eaten: eatenCalories,
        target: targetCalories,
        remaining: isOver ? overAmount : remainingCalories,
      })}
    >
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* Title */}
        <View style={styles.header}>
          <Text variant="heading" color={dark.textHi}>
            {t('diary.today')} · Calories & Macros
          </Text>
          <Text variant="bodyS" color={dark.textMid}>
            Tap any macro to view top contributing foods
          </Text>
        </View>

        {/* Ring Center Hero */}
        <View style={styles.ringHero}>
          <CalorieRing
            eaten={eatenCalories}
            target={targetCalories}
            identityHue={identityHue}
            size={160}
            strokeWidth={14}
            testID="detail-calorie-ring"
          />
        </View>

        {/* Summary Pill */}
        <View style={styles.calorieStatRow}>
          <View style={styles.statBox}>
            <Text variant="label" color={dark.textMid}>
              {t('diary.caloriesEaten')}
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {eatenCalories}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text variant="label" color={dark.textMid}>
              {t('diary.caloriesTarget')}
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {targetCalories}
            </Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statBox}>
            <Text variant="label" color={dark.textMid}>
              {isOver ? t('diary.caloriesOver') : t('diary.caloriesRemaining')}
            </Text>
            <Text variant="numeralM" color={isOver ? dark.cream : dark.textHi}>
              {isOver ? `${overAmount} over` : remainingCalories}
            </Text>
          </View>
        </View>

        {/* Macros Section */}
        <View style={styles.macroSection}>
          <Text variant="label" color={dark.textLo} style={styles.sectionTitle}>
            MACRONUTRIENTS
          </Text>

          {/* Protein Row */}
          <Pressable
            testID="row-macro-protein"
            onPress={() => handleToggleMacro('protein')}
            style={[styles.macroRow, selectedMacro === 'protein' && styles.macroRowSelected]}
          >
            <View style={styles.macroLeft}>
              <View style={[styles.macroDot, { backgroundColor: dark.iris }]} />
              <View>
                <Text variant="body" color={dark.textHi}>
                  Protein
                </Text>
                <Text variant="bodyS" color={dark.textLo}>
                  Target: {targetProtein}g
                </Text>
              </View>
            </View>
            <View style={styles.macroRight}>
              <Text variant="numeralM" color={dark.textHi}>
                {proteinGrams}g
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                {Math.max(0, targetProtein - proteinGrams)}g left
              </Text>
            </View>
          </Pressable>

          {/* Carbs Row */}
          <Pressable
            testID="row-macro-carbs"
            onPress={() => handleToggleMacro('carbs')}
            style={[styles.macroRow, selectedMacro === 'carbs' && styles.macroRowSelected]}
          >
            <View style={styles.macroLeft}>
              <View style={[styles.macroDot, { backgroundColor: dark.teal }]} />
              <View>
                <Text variant="body" color={dark.textHi}>
                  Carbohydrates
                </Text>
                <Text variant="bodyS" color={dark.textLo}>
                  Target: {targetCarbs}g
                </Text>
              </View>
            </View>
            <View style={styles.macroRight}>
              <Text variant="numeralM" color={dark.textHi}>
                {carbGrams}g
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                {Math.max(0, targetCarbs - carbGrams)}g left
              </Text>
            </View>
          </Pressable>

          {/* Fat Row */}
          <Pressable
            testID="row-macro-fat"
            onPress={() => handleToggleMacro('fat')}
            style={[styles.macroRow, selectedMacro === 'fat' && styles.macroRowSelected]}
          >
            <View style={styles.macroLeft}>
              <View style={[styles.macroDot, { backgroundColor: dark.rose }]} />
              <View>
                <Text variant="body" color={dark.textHi}>
                  Fat
                </Text>
                <Text variant="bodyS" color={dark.textLo}>
                  Target: {targetFat}g
                </Text>
              </View>
            </View>
            <View style={styles.macroRight}>
              <Text variant="numeralM" color={dark.textHi}>
                {fatGrams}g
              </Text>
              <Text variant="bodyS" color={dark.textMid}>
                {Math.max(0, targetFat - fatGrams)}g left
              </Text>
            </View>
          </Pressable>
        </View>

        {/* Contributing Foods List when a macro is tapped */}
        {selectedMacro && (
          <View style={styles.contributorsSection} testID="section-macro-contributors">
            <Text variant="label" color={dark.textLo} style={styles.sectionTitle}>
              TOP {selectedMacro.toUpperCase()} CONTRIBUTORS
            </Text>
            {contributingFoods.length === 0 ? (
              <Text variant="bodyS" color={dark.textLo} style={styles.emptyNote}>
                No logged foods contributing to {selectedMacro} today.
              </Text>
            ) : (
              contributingFoods.map((entry) => (
                <View key={entry.id} style={styles.contributorRow}>
                  <View style={{ flex: 1 }}>
                    <Text variant="bodyS" color={dark.textHi} numberOfLines={1}>
                      {entry.food_name}
                    </Text>
                    <Text variant="micro" color={dark.textLo}>
                      {entry.quantity} {entry.unit}
                    </Text>
                  </View>
                  <Text variant="numeralM" color={dark.textHi}>
                    {entry[selectedMacro]}g
                  </Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* Additional Micronutrients Section (LOG-16) */}
        <View style={styles.microSection}>
          <Text variant="label" color={dark.textLo} style={styles.sectionTitle}>
            MICRONUTRIENTS (LOG-16)
          </Text>
          <View style={styles.microRow}>
            <Text variant="bodyS" color={dark.textMid}>
              Fibre
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {fiberGrams}g
            </Text>
          </View>
          <View style={styles.microRow}>
            <Text variant="bodyS" color={dark.textMid}>
              Sugar
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {sugarGrams}g
            </Text>
          </View>
          <View style={styles.microRow}>
            <Text variant="bodyS" color={dark.textMid}>
              Sodium
            </Text>
            <Text variant="numeralM" color={dark.textHi}>
              {sodiumMg} mg
            </Text>
          </View>
        </View>
      </ScrollView>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: space[4],
    paddingBottom: space[8],
    gap: space[4],
  },
  header: {
    alignItems: 'center',
    gap: space[1],
    paddingTop: space[2],
  },
  ringHero: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[2],
  },
  calorieStatRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    paddingVertical: space[3],
    paddingHorizontal: space[4],
  },
  statBox: {
    alignItems: 'center',
    gap: space[1],
  },
  statDivider: {
    width: 1,
    height: 32,
    backgroundColor: dark.hairlineLit,
  },
  macroSection: {
    gap: space[2],
  },
  sectionTitle: {
    letterSpacing: 1,
    marginBottom: space[1],
  },
  macroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderRadius: radius.control,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  macroRowSelected: {
    borderColor: dark.apricot,
    backgroundColor: dark.s2,
  },
  macroLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  macroDot: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
  macroRight: {
    alignItems: 'flex-end',
    gap: space[1],
  },
  contributorsSection: {
    backgroundColor: dark.s2,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[2],
  },
  contributorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[2],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  emptyNote: {
    fontStyle: 'italic',
    paddingVertical: space[2],
  },
  microSection: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    gap: space[2],
  },
  microRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[1],
  },
});
