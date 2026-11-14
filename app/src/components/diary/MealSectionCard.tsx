import { useTheme as useAppearance } from '@calipartner/ui/theme';
import React from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { DiarySectionSummary, FoodEntry, MealSection } from '@calipartner/core';
import { Text, space, radius, captureLayout } from '@calipartner/ui';
import { useSectionSuggestions, type SectionSuggestion } from '@/hooks/useSectionSuggestions';
import { t } from '@/i18n';
import { RepeatPreviousMeal } from './RepeatPreviousMeal';

export interface MealSectionCardProps {
  localDate?: string;
  compact?: boolean;
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

export function MealSectionCard({
  localDate,
  compact = false,
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
  const { colors: dark } = useAppearance();
  const styles = createStyles(dark);

  const { suggestions } = useSectionSuggestions(section, !compact);
  const sectionName = t(`diary.sections.${section}` as Parameters<typeof t>[0]);

  const visibleEntries = summary.entries.slice(0, 3);
  const hasMore = summary.entries.length > 3;

  return (
    <Pressable
      testID={testID ?? `card-section-${section}`}
      accessibilityRole="button"
      onPress={() => onOpenDetail?.(section)}
      style={({ pressed }) => [
        styles.card,
        compact && styles.compact,
        pressed && styles.cardPressed,
      ]}
      accessibilityLabel={t('repairs.mealSummary', {
        section: sectionName,
        calories: summary.calories,
        count: summary.entries.length,
      })}
    >
      {/* Header Row */}
      <View style={styles.headerRow}>
        <View style={styles.headerLeft}>
          <Text variant="heading" color={dark.textHi} style={styles.sectionTitle}>
            {sectionName}
          </Text>
        </View>
        <View style={styles.headerRight}>
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
            accessibilityLabel={t('repairs.addFood', { section: sectionName })}
          >
            <Ionicons
              name="add"
              size={20}
              color={isCurrentMealSuggestion ? dark.onBrand : dark.textHi}
            />
          </Pressable>
        </View>
      </View>

      {summary.entries.length > 0 && (
        <View style={styles.metrics} testID={`meal-metrics-${section}`}>
          {(
            [
              ['calories', 'kcal', t('repairs.calories')],
              ['protein', 'g', t('repairs.protein')],
              ['carbs', 'g', t('repairs.carbs')],
              ['fat', 'g', t('repairs.fat')],
            ] as const
          ).map(([key, unit, label]) => (
            <View key={key} style={styles.metric}>
              <Text nutrient={key} variant="bodyS" color={dark.textMid}>
                {label}
              </Text>
              <Text
                nutrient={key}
                variant="body"
                color={dark.textHi}
                style={styles.metricValue}
                tabular
              >
                {summary[key]} {unit}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* Smart Section Suggestions Bar for non-empty meals (LOG-14) */}
      {!compact && summary.entries.length > 0 && suggestions.length > 0 && (
        <View style={styles.suggestionsContainer}>
          <Text variant="label" color={dark.textLo} style={styles.suggestionLabel}>
            {t('repairs.suggested')}
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
                <Text variant="bodyS" color={dark.textHi}>
                  {s.food_name}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {localDate && (
        <RepeatPreviousMeal
          key={`${localDate}-${section}`}
          localDate={localDate}
          section={section}
        />
      )}
      {/* Entries preview (up to 3 items) */}
      {!compact && visibleEntries.length > 0 ? (
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
              <View style={styles.entryName}>
                <Text variant="bodyS" color={dark.textHi}>
                  {entry.food_name}
                </Text>
                <Text variant="micro" color={dark.textLo}>
                  {entry.quantity} {entry.unit}
                  {entry.brand_name ? ` · ${entry.brand_name}` : ''}
                </Text>
              </View>

              <View style={styles.entryRowRight}>
                <Text nutrient="calories" variant="numeralM" color={dark.textHi}>
                  {entry.calories}
                </Text>
                <Pressable
                  testID={`btn-delete-${entry.id}`}
                  style={styles.deleteButton}
                  accessibilityRole="button"
                  accessibilityLabel={t('repairs.deleteFood', { name: entry.food_name })}
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
              {t('repairs.moreItems', { count: summary.entries.length - 3 })}
            </Text>
          )}
        </View>
      ) : null}
    </Pressable>
  );
}

const createStyles = (dark: ReturnType<typeof useAppearance>['colors']) =>
  StyleSheet.create({
    compact: {
      backgroundColor: dark.bg0,
      borderWidth: 0,
      borderRadius: radius.none,
      paddingHorizontal: 0,
      paddingVertical: space[2],
      borderBottomWidth: StyleSheet.hairlineWidth,
    },
    sectionTitle: { flex: 1, minWidth: 0 },
    metrics: { flexDirection: 'row', gap: space[2] },
    metric: { flex: 1, minWidth: 0, gap: space[1] },
    metricValue: { fontVariant: ['tabular-nums'] },
    entryName: { flexGrow: 1, flexBasis: captureLayout.nutrientMinWidth, minWidth: 0 },
    deleteButton: {
      minWidth: captureLayout.touch,
      minHeight: captureLayout.touch,
      alignItems: 'center',
      justifyContent: 'center',
    },

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
      flex: 1,
      minWidth: 0,
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
      width: captureLayout.touch,
      height: captureLayout.touch,
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
      maxWidth: '100%',
      minHeight: captureLayout.touch,
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
      flexWrap: 'wrap',
      gap: space[2],
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
