import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiarySectionSummary, FoodEntry, MealSection } from '@calipartner/core';
import { Text, dark, space, radius } from '@calipartner/ui';
import { useSectionSuggestions, type SectionSuggestion } from '@/hooks/useSectionSuggestions';
import { t } from '@/i18n';

export interface MealSectionCardProps {
  section: MealSection;
  summary: DiarySectionSummary;
  isCurrentMealSuggestion?: boolean;
  onAddFood: (section: MealSection) => void;
  onOpenDetail?: (section: MealSection) => void;
  onEditEntry: (entry: FoodEntry) => void;
  onDeleteEntry: (entryId: string) => void;
  onCopyMeal: (section: MealSection) => void;
  onSelectSuggestion?: (suggestion: SectionSuggestion, section: MealSection) => void;
  testID?: string;
}

const SECTION_ICONS: Record<MealSection, keyof typeof Ionicons.glyphMap> = {
  breakfast: 'sunny-outline',
  lunch: 'restaurant-outline',
  dinner: 'moon-outline',
  snacks: 'cafe-outline',
  extra: 'flash-outline',
};

export function MealSectionCard({
  section,
  summary,
  isCurrentMealSuggestion = false,
  onAddFood,
  onOpenDetail,
  onEditEntry,
  onDeleteEntry,
  onCopyMeal,
  onSelectSuggestion,
  testID,
}: MealSectionCardProps) {
  const { suggestions } = useSectionSuggestions(section);
  const sectionName = t(`diary.sections.${section}` as Parameters<typeof t>[0]);
  const iconName = SECTION_ICONS[section] ?? 'fast-food-outline';

  const visibleEntries = summary.entries.slice(0, 3);
  const hasMore = summary.entries.length > 3;

  return (
    <Pressable
      testID={testID ?? `card-section-${section}`}
      onPress={() => onOpenDetail?.(section)}
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${sectionName}, ${summary.calories} calories, ${summary.entries.length} items`}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <View
            style={[styles.iconWrapper, isCurrentMealSuggestion && styles.iconWrapperSuggested]}
          >
            <Ionicons
              name={iconName}
              size={18}
              color={isCurrentMealSuggestion ? dark.onBrand : dark.textMid}
            />
          </View>
          <View>
            <Text variant="heading" color={dark.textHi}>
              {sectionName}
            </Text>
            {summary.entries.length > 0 ? (
              <Text variant="bodyS" color={dark.textLo}>
                P {summary.protein}g · C {summary.carbs}g · F {summary.fat}g
              </Text>
            ) : null}
          </View>
        </View>

        <View style={styles.headerRight}>
          <Text variant="numeralM" color={summary.calories > 0 ? dark.textHi : dark.textLo}>
            {summary.calories}{' '}
            <Text variant="bodyS" color={dark.textLo}>
              kcal
            </Text>
          </Text>

          {/* Trailing 32 Circle ＋ Button (Spec C01) */}
          <Pressable
            testID={`btn-add-food-${section}`}
            onPress={(e) => {
              e.stopPropagation();
              onAddFood(section);
            }}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={[styles.addPlusButton, isCurrentMealSuggestion && styles.addPlusButtonSuggested]}
            accessibilityRole="button"
            accessibilityLabel={`Add food to ${sectionName}`}
          >
            <Ionicons
              name="add"
              size={20}
              color={isCurrentMealSuggestion ? dark.onBrand : dark.textHi}
            />
          </Pressable>
        </View>
      </View>

      {/* Smart Section Suggestions Bar for non-empty meals (LOG-14) */}
      {summary.entries.length > 0 && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text variant="label" color={dark.textLo} style={styles.suggestionLabel}>
            SUGGESTED
          </Text>
          <View style={styles.suggestionsRow}>
            {suggestions.slice(0, 3).map((s) => (
              <Pressable
                key={s.food_id}
                testID={`suggestion-${section}-${s.food_id}`}
                onPress={(e) => {
                  e.stopPropagation();
                  onSelectSuggestion?.(s, section);
                }}
                style={styles.suggestionPill}
              >
                <Ionicons name="add" size={12} color={dark.apricot} />
                <Text variant="bodyS" color={dark.textHi} numberOfLines={1}>
                  {s.food_name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Entries preview (up to 3 items) */}
      {visibleEntries.length > 0 ? (
        <View style={styles.entriesList}>
          {visibleEntries.map((entry) => (
            <Pressable
              key={entry.id}
              testID={`entry-row-${entry.id}`}
              onPress={(e) => {
                e.stopPropagation();
                onEditEntry(entry);
              }}
              onLongPress={(e) => {
                e.stopPropagation();
                onCopyMeal(section);
              }}
              style={({ pressed }) => [styles.entryRow, pressed && styles.entryRowPressed]}
            >
              <View style={{ flex: 1 }}>
                <Text variant="bodyS" color={dark.textHi} numberOfLines={1}>
                  {entry.food_name}
                </Text>
                <Text variant="micro" color={dark.textLo}>
                  {entry.quantity} {entry.unit}
                  {entry.brand_name ? ` · ${entry.brand_name}` : ''}
                </Text>
              </View>

              <View style={styles.entryRowRight}>
                <Text variant="numeralM" color={dark.textHi}>
                  {entry.calories}
                </Text>
                <Pressable
                  testID={`btn-delete-${entry.id}`}
                  onPress={(e) => {
                    e.stopPropagation();
                    onDeleteEntry(entry.id);
                  }}
                  hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                >
                  <Ionicons name="trash-outline" size={15} color={dark.textLo} />
                </Pressable>
              </View>
            </Pressable>
          ))}

          {hasMore && (
            <Text variant="bodyS" color={dark.apricot} style={styles.viewMoreText}>
              +{summary.entries.length - 3} more items · tap to view all
            </Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: dark.s1,
    borderRadius: radius.card,
    padding: space[4],
    borderWidth: 1,
    borderColor: dark.hairline,
    gap: space[3],
  },
  cardPressed: {
    backgroundColor: dark.s2,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  iconWrapper: {
    width: 36,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: dark.s2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapperSuggested: {
    backgroundColor: dark.apricot,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  addPlusButton: {
    width: 32,
    height: 32,
    borderRadius: radius.full,
    backgroundColor: dark.s2,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addPlusButtonSuggested: {
    backgroundColor: dark.apricot,
    borderColor: dark.apricot,
  },
  suggestionsContainer: {
    gap: space[1],
  },
  suggestionLabel: {
    letterSpacing: 0.5,
  },
  suggestionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space[2],
  },
  suggestionPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[1],
    backgroundColor: dark.s2,
    paddingHorizontal: space[2],
    paddingVertical: space[1],
    borderRadius: radius.full,
    borderWidth: 1,
    borderColor: dark.hairlineLit,
  },
  entriesList: {
    gap: space[1],
    borderTopWidth: 1,
    borderTopColor: dark.hairline,
    paddingTop: space[2],
  },
  entryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: space[1],
  },
  entryRowPressed: {
    opacity: 0.7,
  },
  entryRowRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space[3],
  },
  viewMoreText: {
    paddingTop: space[1],
    fontWeight: '600',
  },
});
