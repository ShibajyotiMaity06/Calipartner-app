import React from 'react';
import { View, StyleSheet, ScrollView, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiarySectionSummary, FoodEntry, MealSection } from '@calipartner/core';
import { Sheet, Text, Button, dark, space, radius } from '@calipartner/ui';
import { t } from '@/i18n';

export interface MealDetailSheetProps {
  visible: boolean;
  section: MealSection;
  summary: DiarySectionSummary;
  onClose: () => void;
  onAddFood: (section: MealSection) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onCopyMeal: (section: MealSection) => void;
}

export function MealDetailSheet({
  visible,
  section,
  summary,
  onClose,
  onAddFood,
  onEditEntry,
  onDeleteEntry,
  onCopyMeal,
}: MealDetailSheetProps) {
  const sectionName = t(`diary.sections.${section}` as Parameters<typeof t>[0]);

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      snapPoint="tall"
      testID={`sheet-meal-detail-${section}`}
      accessibilityLabel={`${sectionName} detail, ${summary.calories} calories`}
    >
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text variant="heading" color={dark.textHi}>
                {sectionName}
              </Text>
              <Text variant="bodyS" color={dark.textLo}>
                P {summary.protein}g · C {summary.carbs}g · F {summary.fat}g
              </Text>
            </View>
            <View style={styles.headerRight}>
              <Text variant="numeralM" color={dark.textHi}>
                {summary.calories}{' '}
                <Text variant="label" color={dark.textMid}>
                  kcal
                </Text>
              </Text>
              {summary.entries.length > 0 && (
                <Pressable
                  testID={`btn-sheet-copy-${section}`}
                  onPress={() => onCopyMeal(section)}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  accessibilityLabel={t('diary.copyMeal')}
                  style={styles.copyButton}
                >
                  <Ionicons name="copy-outline" size={18} color={dark.textMid} />
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {/* Entries List */}
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollList}>
          {summary.entries.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Ionicons name="restaurant-outline" size={40} color={dark.textLo} />
              <Text variant="body" color={dark.textMid} style={styles.emptyText}>
                No foods logged in {sectionName} yet.
              </Text>
            </View>
          ) : (
            summary.entries.map((entry) => (
              <Pressable
                key={entry.id}
                testID={`sheet-entry-row-${entry.id}`}
                onPress={() => onEditEntry(entry)}
                style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}
              >
                <View style={{ flex: 1, gap: space[1] }}>
                  <Text variant="body" color={dark.textHi} numberOfLines={1}>
                    {entry.food_name}
                  </Text>
                  <Text variant="bodyS" color={dark.textLo}>
                    {entry.quantity} {entry.unit}
                    {entry.brand_name ? ` · ${entry.brand_name}` : ''}
                    {' · '}P {entry.protein}g · C {entry.carbs}g · F {entry.fat}g
                  </Text>
                </View>

                <View style={styles.entryRowRight}>
                  <Text variant="numeralM" color={dark.textHi}>
                    {entry.calories} kcal
                  </Text>
                  <Pressable
                    testID={`sheet-btn-delete-${entry.id}`}
                    onPress={() => onDeleteEntry(entry.id)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    style={styles.deleteIconButton}
                    accessibilityLabel={t('common.delete')}
                  >
                    <Ionicons name="trash-outline" size={16} color={dark.textLo} />
                  </Pressable>
                </View>
              </Pressable>
            ))
          )}
        </ScrollView>

        {/* Sticky Add Food Button at Bottom */}
        <View style={styles.footer}>
          <Button
            testID={`btn-sheet-add-${section}`}
            variant="primary"
            label={`Add to ${sectionName.toLowerCase()}`}
            onPress={() => {
              onClose();
              onAddFood(section);
            }}
          />
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: space[4],
  },
  header: {
    paddingBottom: space[3],
    borderBottomWidth: 1,
    borderBottomColor: dark.hairline,
  },
  headerTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  copyButton: {
    padding: space[1],
  },
  scrollList: {
    paddingVertical: space[3],
    gap: space[2],
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: space[8],
    gap: space[2],
  },
  emptyText: {
    textAlign: 'center',
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[3],
    borderWidth: 1,
    borderColor: dark.hairline,
  },
  entryRowPressed: {
    backgroundColor: dark.s2,
  },
  entryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  deleteIconButton: {
    padding: space[1],
  },
  footer: {
    paddingVertical: space[4],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
  },
});
